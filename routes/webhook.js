const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Webhook para recibir notificaciones de pagos
router.post('/', async (req, res) => {
  console.log('📩 Webhook recibido:', req.body);

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

    // Definir rutas de archivos
    const externalFile = path.join(__dirname, '../db/external_transactions.json');
    const paymentLinksFile = path.join(__dirname, '../db/payment_links.json');
    const pendingFile = path.join(__dirname, '../db/pending.json');
    const paidFile = path.join(__dirname, '../db/paid.json');

    // Función para actualizar transacción
    const updateTransaction = (transactions, index) => {
      if (status === 'PAID' || status === 'COMPLETED' || status === 'APROVADO') {
        transactions[index].status = 'PAGADO';
        transactions[index].paid_at = new Date().toISOString();
        transactions[index].webhook_data = req.body;
        return true;
      }
      return false;
    };

    // Verificar en transacciones de botón (external_transactions.json)
    if (fs.existsSync(externalFile)) {
      let transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
      const transactionIndex = transactions.findIndex(
        tx =>
          (tx.internalId && String(tx.internalId).trim().toLowerCase() === String(transactionId).trim().toLowerCase()) ||
          (tx.transactionId && String(tx.transactionId).trim().toLowerCase() === String(transactionId).trim().toLowerCase())
      );

      if (transactionIndex !== -1) {
        if (updateTransaction(transactions, transactionIndex)) {
          fs.writeFileSync(externalFile, JSON.stringify(transactions, null, 2));
          console.log(`✅ Transacción de botón ${transactionId} actualizada como PAGADO`);
          return res.json({ success: true, message: 'Transacción de botón actualizada correctamente' });
        }
      }
    }

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
          return res.json({ success: true, message: 'Link de pago actualizado correctamente' });
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
        transaction.webhook_data = req.body;

        paidTransactions.push(transaction);

        fs.writeFileSync(pendingFile, JSON.stringify(transactions, null, 2));
        fs.writeFileSync(paidFile, JSON.stringify(paidTransactions, null, 2));

        console.log(`✅ Transacción QR ${transactionId} actualizada como PAGADO`);
        return res.json({ success: true, message: 'Transacción QR actualizada correctamente' });
      }
    }

    // Si no se encuentra en ningún tipo de transacción
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

module.exports = router;