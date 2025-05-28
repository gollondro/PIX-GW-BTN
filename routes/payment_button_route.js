const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const rendixApi = require('../services/rendixApi');
const externalTransactionRepository = require('../repositories/externalTransactionRepository');

// Función para validar el formato del transactionId
function validateTransactionIdFormat(transactionId) {
  // Ejemplo: alfanumérico, guiones, 10-50 caracteres
  const ID_PATTERN = /^[A-Z0-9-]{10,50}$/i;
  return (
    transactionId &&
    typeof transactionId === 'string' &&
    ID_PATTERN.test(transactionId)
  );
}

// Función para extraer y validar el email del usuario con más logging
function extractUserEmail(req) {
  console.log('🔬 Datos recibidos para extracción de email:', {
    bodyUserEmail: req.body.userEmail,
    bodyEmail: req.body.email,
    reqUser: req.user,
    reqSession: req.session
  });

  const sourceEmails = [
    req.body.userEmail,
    req.body.email,
    req.user?.email,
    req.session?.user?.email
  ].filter(Boolean);

  console.log('🔍 Fuentes de email encontradas:', sourceEmails);

  const validEmail = sourceEmails[0];

  if (!validEmail) {
    console.warn('⚠️ No se encontró ningún email de usuario válido');
    return 'desconocido@default.com';
  }

  console.log('✅ Email de usuario seleccionado:', validEmail);
  return validEmail;
}

// Nuevo endpoint para obtener la última transacción de un usuario
router.get('/latest-transaction', async (req, res) => {
  try {
    const userEmail = req.query.userEmail;
    if (!userEmail) {
      return res.status(400).json({ success: false, error: 'Se requiere un email de usuario' });
    }

    console.log(`🔍 Buscando última transacción para email: ${userEmail}`);
    const latestTransaction = await externalTransactionRepository.findLatestByUserEmail(userEmail);
    
    if (latestTransaction) {
      console.log('✅ Última transacción encontrada:', {
        internalId: latestTransaction.internalId,
        userEmail: latestTransaction.userEmail,
        amountUSD: latestTransaction.amountUSD
      });
      res.json({ success: true, transaction: latestTransaction });
    } else {
      console.warn(`⚠️ No se encontraron transacciones para ${userEmail}`);
      res.json({ success: false, error: 'No se encontraron transacciones para este usuario' });
    }
  } catch (error) {
    console.error('❌ Error al buscar última transacción:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

// Endpoint para generar QR con validaciones
router.post('/generate', async (req, res) => {
  try {
    const {
      transactionId,
      amountUSD,
      customerName,
      customerEmail,
      customerPhone,
      customerCpf
    } = req.body;

    // Validación 1: Formato del transactionId
    if (!validateTransactionIdFormat(transactionId)) {
      console.warn(`❌ ID de transacción inválido: ${transactionId}`);
      return res.status(400).json({
        success: false,
        error: 'El transactionId debe ser una cadena alfanumérica entre 10 y 50 caracteres'
      });
    }

    // Validación 2: Unicidad del transactionId usando repositorio
    const isUnique = await externalTransactionRepository.isTransactionIdUnique(transactionId);
    if (!isUnique) {
      console.warn(`❌ ID de transacción ya existe: ${transactionId}`);
      return res.status(400).json({
        success: false,
        error: 'El transactionId ya ha sido utilizado previamente'
      });
    }

    // Extraer email del usuario
    const userEmail = extractUserEmail(req);

    // Llamar a Rendix usando el transactionId del request
    const pixResult = await rendixApi.createPixChargeLink({
      amountUSD,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        cpf: customerCpf
      },
      controlNumber: transactionId,
      UrlWebhook: process.env.RENPIX_WEBHOOK || 'http://localhost:3000/api/webhook'
    });

    // Preparar datos de la transacción
    const transactionData = {
      internalId: transactionId,
      userEmail: userEmail,
      amountUSD: parseFloat(amountUSD),
      amountBRL: pixResult.priceNationalCurrency,
      usdToBrlRate: pixResult.vetTax,
      vetTax: pixResult.vetTax,
      priceNationalCurrency: pixResult.priceNationalCurrency,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      status: 'PENDIENTE',
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        cpf: customerCpf
      },
      qrData: {
        pixCopyPast: pixResult.pixCopyPast || '',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      },
      webhookUrl: process.env.RENPIX_WEBHOOK,
      controlNumber: transactionId
    };

    // Guardar transacción usando repositorio
    console.log('🔍 USE_DATABASE:', process.env.USE_DATABASE);
    console.log('🔍 db.isEnabled():', require('../services/database').isEnabled());
    
    await externalTransactionRepository.create(transactionData);
    console.log('💾 Transacción guardada exitosamente usando repositorio');

    res.json({
      success: true,
      paymentUrl: `/payment-window/${transactionId}`,
      transactionId,
      amountUSD,
      userEmail,
      qrData: {
        pixCopyPast: pixResult.pixCopyPast || '',
        qrCodeBase64: pixResult.qrCodeBase64 || ''
      },
      expiresAt: transactionData.expiresAt
    });

  } catch (error) {
    console.error('❌ Error en /generate:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar QR',
      details: error.message
    });
  }
});

// Endpoint para obtener datos de una transacción externa
router.get('/transaction/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔍 Buscando transacción: ${id}`);
    const transaction = await externalTransactionRepository.findByInternalId(id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    console.log('🔍 Transacción recuperada:', {
      internalId: transaction.internalId,
      userEmail: transaction.userEmail,
      amountUSD: transaction.amountUSD
    });

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    console.error('❌ Error al obtener transacción externa:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor'
    });
  }
});

// Endpoint para obtener todas las transacciones externas
router.get('/all', async (req, res) => {
  try {
    const transactions = await externalTransactionRepository.findAll();
    
    console.log('📋 Transacciones recuperadas:', transactions.map(t => ({
      internalId: t.internalId,
      userEmail: t.userEmail,
      amountUSD: t.amountUSD
    })));
    
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('❌ Error al obtener transacciones botón:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

module.exports = router;