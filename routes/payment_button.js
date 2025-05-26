const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const rendixApi = require('../services/rendixApi');

// Función para verificar si un transactionId ya existe
function isTransactionIdUnique(transactionId) {
  const externalFile = path.join(__dirname, '../db/external_transactions.json');
  if (!fs.existsSync(externalFile)) {
    return true;
  }
  try {
    const transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
    const existingTransaction = transactions.find(
      tx => tx.internalId === transactionId ||
            tx.transactionId === transactionId
    );
    return !existingTransaction;
  } catch (error) {
    console.error('Error al verificar transactionId único:', error);
    return false;
  }
}

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

// Función para obtener la última transacción de un usuario con logging detallado e insensible a mayúsculas/minúsculas
function getLatestTransactionForUser(userEmail) {
  console.log(`🔍 Buscando última transacción para email: ${userEmail}`);
  const externalFile = path.join(__dirname, '../db/external_transactions.json');
  if (!fs.existsSync(externalFile)) {
    console.log(`❌ Archivo de transacciones no encontrado: ${externalFile}`);
    return null;
  }
  try {
    const transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
    console.log('📊 Total de transacciones:', transactions.length);
    const userTransactions = transactions.filter(t => {
      const match = t.userEmail &&
        t.userEmail.trim().toLowerCase() === userEmail.trim().toLowerCase();
      if (match) {
        console.log('🎯 Transacción encontrada:', {
          internalId: t.internalId,
          userEmail: t.userEmail,
          amountUSD: t.amountUSD,
          createdAt: t.createdAt
        });
      }
      return match;
    });
    const sortedTransactions = userTransactions.sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    if (sortedTransactions.length > 0) {
      console.log('✅ Última transacción encontrada:', {
        internalId: sortedTransactions[0].internalId,
        userEmail: sortedTransactions[0].userEmail,
        amountUSD: sortedTransactions[0].amountUSD
      });
      return sortedTransactions[0];
    } else {
      console.warn(`⚠️ No se encontraron transacciones para ${userEmail}`);
      return null;
    }
  } catch (error) {
    console.error(`❌ Error al buscar transacciones para ${userEmail}:`, error);
    return null;
  }
}

// Nuevo endpoint para obtener la última transacción de un usuario
router.get('/latest-transaction', (req, res) => {
  const userEmail = req.query.userEmail;
  if (!userEmail) {
    return res.status(400).json({ success: false, error: 'Se requiere un email de usuario' });
  }
  const latestTransaction = getLatestTransactionForUser(userEmail);
  if (latestTransaction) {
    res.json({ success: true, transaction: latestTransaction });
  } else {
    res.json({ success: false, error: 'No se encontraron transacciones para este usuario' });
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

    // Validación 2: Unicidad del transactionId
    if (!isTransactionIdUnique(transactionId)) {
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
    const transaction = {
      internalId: transactionId,
      userEmail: userEmail,
      amountUSD,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'PENDIENTE',
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        cpf: customerCpf
      },
      qrData: {
        pixCopyPast: pixResult.pixCopyPast || '',
        qrCodeBase64: pixResult.qrCodeBase64 || ''
      },
      vetTax: pixResult.vetTax,
      priceNationalCurrency: pixResult.priceNationalCurrency
    };

    // Guardar transacción en archivo
    const externalFile = path.join(__dirname, '../db/external_transactions.json');
    let transactions = [];
    if (fs.existsSync(externalFile)) {
      try {
        transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
      } catch (readError) {
        console.error('❌ Error al leer archivo de transacciones:', readError);
      }
    }
    transactions.push(transaction);
    try {
      fs.writeFileSync(externalFile, JSON.stringify(transactions, null, 2));
      console.log('💾 Transacción guardada exitosamente');
    } catch (writeError) {
      console.error('❌ Error al guardar transacción:', writeError);
    }

    res.json({
      success: true,
      paymentUrl: `/payment-window/${transactionId}`,
      transactionId,
      amountUSD,
      userEmail,
      qrData: transaction.qrData,
      expiresAt: transaction.expiresAt
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
router.get('/transaction/:id', (req, res) => {
  try {
    const { id } = req.params;
    const externalFile = path.join(__dirname, '../db/external_transactions.json');
    if (!fs.existsSync(externalFile)) {
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }
    const externalTransactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
    const transaction = externalTransactions.find(t =>
      t.internalId === id ||
      t.transactionId === id
    );
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
router.get('/all', (req, res) => {
  try {
    const externalFile = path.join(__dirname, '../db/external_transactions.json');
    if (!fs.existsSync(externalFile)) {
      return res.json({ success: true, transactions: [] });
    }
    const transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
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