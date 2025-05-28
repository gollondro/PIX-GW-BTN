const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const transactionRepository = require('../repositories/transactionRepository');
const externalTransactionRepository = require('../repositories/externalTransactionRepository');

// Webhook para recibir notificaciones de pagos
router.post('/', async (req, res) => {
  console.log('📩 Webhook recibido:', req.body);
  console.log('🔍 Headers:', req.headers);
  console.log('🔍 USE_DATABASE:', process.env.USE_DATABASE);

  try {
    const { transactionId, status } = req.body;

    // Validar que los datos requeridos estén presentes
    if (!transactionId || !status) {
      console.error('❌ Webhook inválido: falta transactionId o status');
      return res.status(400).json({
        success: false,
        error: 'Se requiere transactionId y status'
      });
    }

    console.log(`🔄 Procesando webhook para transacción: ${transactionId} con status: ${status}`);

    // Determinar si es un pago exitoso
    const isPaid = status === 'PAID' || status === 'COMPLETED' || status === 'APROVADO';
    const newStatus = isPaid ? 'PAGADO' : status;

    // 1. BUSCAR EN TRANSACCIONES EXTERNAS (DB o JSON según configuración)
    console.log('🔍 Buscando en transacciones externas...');
    try {
      const externalTransaction = await externalTransactionRepository.findByInternalId(transactionId);
      if (externalTransaction) {
        console.log('✅ Transacción externa encontrada:', externalTransaction.internalId);

        if (isPaid) {
          const updatedTransaction = await externalTransactionRepository.updateStatus(transactionId, newStatus, req.body);
          if (updatedTransaction) {
            console.log(`✅ Transacción externa ${transactionId} actualizada como ${newStatus}`);
            return res.json({ success: true, message: 'Transacción externa actualizada correctamente' });
          } else {
            console.warn(`⚠️ No se pudo actualizar la transacción externa ${transactionId}`);
          }
        }
      } else {
        console.log('❌ Transacción externa no encontrada:', transactionId);
      }
    } catch (error) {
      console.error('❌ Error al buscar/actualizar transacción externa:', error);
      // No hacer return aquí, continuar con la búsqueda normal
    }

    // 2. BUSCAR EN TRANSACCIONES NORMALES (DB o JSON según configuración)
    console.log('🔍 Buscando en transacciones normales...');
    try {
      const transaction = await transactionRepository.findById(transactionId);
      if (transaction) {
        console.log('✅ Transacción normal encontrada:', transactionId);

        if (isPaid) {
          await transactionRepository.markAsPaid(transactionId, req.body);
          console.log(`✅ Transacción normal ${transactionId} actualizada como ${newStatus}`);
          return res.json({ success: true, message: 'Transacción normal actualizada correctamente' });
        }
      }
    } catch (error) {
      console.error('❌ Error al buscar/actualizar transacción normal:', error);
    }

    // 3. BUSCAR EN ARCHIVOS JSON LEGACY (para compatibilidad)
    console.log('🔍 Buscando en archivos JSON legacy...');
    const legacyResult = await updateLegacyJSONFiles(transactionId, newStatus, req.body);
    if (legacyResult.found) {
      return res.json({ success: true, message: legacyResult.message });
    }

    // Si no se encuentra en ningún sistema
    console.warn(`⚠️ Transacción ${transactionId} no encontrada en ningún sistema`);
    return res.status(404).json({
      success: false,
      error: 'Transacción no encontrada'
    });

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Función auxiliar para manejar archivos JSON legacy
async function updateLegacyJSONFiles(transactionId, status, webhookData) {
  const paymentLinksFile = path.join(__dirname, '../db/payment_links.json');
  const pendingFile = path.join(__dirname, '../db/pending.json');
  const paidFile = path.join(__dirname, '../db/paid.json');

  // Función para actualizar transacción
  const updateTransaction = (transactions, index) => {
    if (status === 'PAGADO') {
      transactions[index].status = 'PAGADO';
      transactions[index].paid_at = new Date().toISOString();
      transactions[index].webhook_data = webhookData;
      return true;
    }
    return false;
  };

  try {
    // Verificar en links de pago (payment_links.json)
    if (fs.existsSync(paymentLinksFile)) {
      let transactions = JSON.parse(fs.readFileSync(paymentLinksFile, 'utf8'));
      const transactionIndex = transactions.findIndex(
        tx => 
          (tx.transactionId && String(tx.transactionId).trim().toLowerCase() === String(transactionId).trim().toLowerCase()) ||
          (tx.id && String(tx.id).trim().toLowerCase() === String(transactionId).trim().toLowerCase())
      );

      if (transactionIndex !== -1) {
        if (updateTransaction(transactions, transactionIndex)) {
          fs.writeFileSync(paymentLinksFile, JSON.stringify(transactions, null, 2));
          console.log(`✅ Link de pago ${transactionId} actualizado como PAGADO`);
          return { found: true, message: 'Link de pago actualizado correctamente' };
        }
      }
    }

    // Verificar en transacciones pendientes (pending.json)
    if (fs.existsSync(pendingFile)) {
      let transactions = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      const transactionIndex = transactions.findIndex(
        tx => String(tx.id).trim().toLowerCase() === String(transactionId).trim().toLowerCase()
      );

      if (transactionIndex !== -1) {
        // Eliminar de pendientes y agregar a pagadas
        const paidTransactions = fs.existsSync(paidFile) 
          ? JSON.parse(fs.readFileSync(paidFile, 'utf8')) 
          : [];

        const transaction = transactions.splice(transactionIndex, 1)[0];
        transaction.status = 'PAGADO';
        transaction.paid_at = new Date().toISOString();
        transaction.webhook_data = webhookData;

        paidTransactions.push(transaction);

        fs.writeFileSync(pendingFile, JSON.stringify(transactions, null, 2));
        fs.writeFileSync(paidFile, JSON.stringify(paidTransactions, null, 2));

        console.log(`✅ Transacción QR ${transactionId} actualizada como PAGADO`);
        return { found: true, message: 'Transacción QR actualizada correctamente' };
      }
    }

    return { found: false };
  } catch (error) {
    console.error('❌ Error al procesar archivos JSON legacy:', error);
    return { found: false };
  }
}

module.exports = router;