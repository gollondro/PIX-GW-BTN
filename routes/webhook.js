const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Webhook para recibir notificaciones de pagos
router.post('/', (req, res) => {
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

    // --- Primero intenta actualizar en payment_links.json ---
    const linkTxFile = path.join(__dirname, '../db/payment_links.json');
    let linkTxs = [];
    if (fs.existsSync(linkTxFile)) {
      try {
        linkTxs = JSON.parse(fs.readFileSync(linkTxFile, 'utf8'));
      } catch (e) { linkTxs = []; }
    }
    const idx = linkTxs.findIndex(tx => String(tx.id) === String(transactionId));
    if (idx !== -1) {
      // Solo actualiza si el estado es pagado
      if (status === 'PAID' || status === 'COMPLETED' || status === 'APROVADO') {
        linkTxs[idx].status = 'PAGADO';
        linkTxs[idx].paid_at = new Date().toISOString();
        linkTxs[idx].webhook_data = req.body;
        fs.writeFileSync(linkTxFile, JSON.stringify(linkTxs, null, 2));
        console.log(`✅ Link de pago ${transactionId} actualizado como PAGADO`);
        return res.json({ success: true, message: 'Link de pago actualizado correctamente' });
      } else {
        console.log(`ℹ️ Estado ${status} recibido para link de pago, no requiere actualización`);
        return res.json({ success: true, message: 'Estado recibido pero no requiere actualización' });
      }
    }

    // --- Si no es link de pago, sigue con la lógica QR tradicional ---
    // Rutas de archivos
    const pendingFile = path.join(__dirname, '../db/pending.json');
    const paidFile = path.join(__dirname, '../db/paid.json');

    // Cargar datos actuales
    let pending = [];
    let paid = [];

    try {
      if (fs.existsSync(pendingFile)) {
        pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      }

      if (fs.existsSync(paidFile)) {
        paid = JSON.parse(fs.readFileSync(paidFile, 'utf8'));
      }
    } catch (fileError) {
      console.error('❌ Error al leer archivos de transacciones:', fileError);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }

    // Verificar si ya existe en pagados (evitar duplicados)
    const alreadyPaid = paid.some(p => p.id === transactionId);
    if (alreadyPaid) {
      console.log(`⚠️ La transacción ${transactionId} ya está marcada como pagada`);
      return res.json({
        success: true,
        message: 'La transacción ya está marcada como pagada'
      });
    }

    // Buscar la transacción en pendientes
    const index = pending.findIndex(p => p.id === transactionId);

    if (index === -1) {
      console.log(`⚠️ Transacción ${transactionId} no encontrada en pendientes`);
      return res.json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    // Procesar solo si el estado es PAID (o el que use la API)
    if (status === 'PAID' || status === 'COMPLETED' || status === 'APROVADO') {
      console.log(`✅ Marcando transacción ${transactionId} como pagada`);

      // Extraer la transacción de pendientes
      const record = pending.splice(index, 1)[0];

      // Agregar a pagadas con información adicional
      paid.push({
        ...record,
        status: 'PAGADO',
        paid_at: new Date().toISOString(),
        webhook_data: req.body // Guardar datos completos del webhook
      });

      // Guardar archivos actualizados
      try {
        fs.writeFileSync(paidFile, JSON.stringify(paid, null, 2));
        fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
        console.log('💾 Archivos actualizados correctamente');
      } catch (saveError) {
        console.error('❌ Error al guardar archivos:', saveError);
        return res.status(500).json({
          success: false,
          error: 'Error al actualizar el estado de la transacción'
        });
      }

      // Enviar respuesta exitosa
      return res.json({
        success: true,
        message: 'Transacción actualizada correctamente'
      });
    } else {
      console.log(`ℹ️ Estado ${status} no requiere actualización`);
      return res.json({
        success: true,
        message: 'Estado recibido pero no requiere actualización'
      });
    }
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

module.exports = router;