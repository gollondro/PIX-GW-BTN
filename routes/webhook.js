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

    // --- Manejar transacciones de botón de pago ---
    const externalFile = path.join(__dirname, '../db/external_transactions.json');
    if (fs.existsSync(externalFile)) {
      let transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));

      // Buscar la transacción por internalId o transactionId (robusto)
      const transactionIndex = transactions.findIndex(
        tx =>
          (tx.internalId && String(tx.internalId).trim().toLowerCase() === String(transactionId).trim().toLowerCase()) ||
          (tx.transactionId && String(tx.transactionId).trim().toLowerCase() === String(transactionId).trim().toLowerCase())
      );

      if (transactionIndex !== -1) {
        // Actualizar estado si es un pago confirmado
        if (status === 'PAID' || status === 'COMPLETED' || status === 'APROVADO') {
          transactions[transactionIndex].status = 'PAGADO';
          transactions[transactionIndex].paid_at = new Date().toISOString();
          transactions[transactionIndex].webhook_data = req.body;

          // Guardar cambios
          fs.writeFileSync(externalFile, JSON.stringify(transactions, null, 2));

          console.log(`✅ Transacción de botón ${transactionId} actualizada como PAGADO`);

          // Opcional: Hacer una solicitud POST al endpoint de confirmación (si lo necesitas)
          // try {
          //   const confirmResponse = await fetch(
          //     `https://pix-gw-btn.onrender.com/api/payment-button/transaction/${transactionId}`, 
          //     {
          //       method: 'POST',
          //       headers: { 'Content-Type': 'application/json' },
          //       body: JSON.stringify({
          //         status: 'PAGADO',
          //         paid_at: new Date().toISOString(),
          //         transactionId
          //       })
          //     }
          //   );
          //   console.log('Respuesta de confirmación:', await confirmResponse.json());
          // } catch (confirmError) {
          //   console.error('Error al confirmar transacción:', confirmError);
          // }

          return res.json({
            success: true,
            message: 'Transacción de botón actualizada correctamente'
          });
        } else {
          console.log(`ℹ️ Estado ${status} no requiere actualización para transacción de botón`);
          return res.json({
            success: true,
            message: 'Estado recibido pero no requiere actualización'
          });
        }
      }
    }

    // Si no se encuentra la transacción en botón, seguir con otros tipos de transacciones
    // (código anterior de links de pago y QR puede ir aquí...)

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