const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const rendixApi = require('../services/rendixApi');

// Función para extraer y validar el email del usuario con más logging
function extractUserEmail(req) {
  console.log('🔬 Datos recibidos para extracción de email:', {
    bodyUserEmail: req.body.userEmail,
    bodyEmail: req.body.email,
    reqUser: req.user,
    reqSession: req.session
  });

  // Intentar obtener el email de diferentes fuentes
  const sourceEmails = [
    req.body.userEmail,           // Primer lugar a buscar
    req.body.email,                // Alternativa
    req.user?.email,               // Si hay autenticación
    req.session?.user?.email       // Si hay sesión
  ].filter(Boolean); // Eliminar valores falsy

  // Log de depuración
  console.log('🔍 Fuentes de email encontradas:', sourceEmails);

  // Validar y devolver el primer email válido
  const validEmail = sourceEmails[0];

  if (!validEmail) {
    console.warn('⚠️ No se encontró ningún email de usuario válido');
    return 'desconocido@default.com'; // Email por defecto para evitar errores
  }

  console.log('✅ Email de usuario seleccionado:', validEmail);
  return validEmail;
}

// Función para obtener la última transacción de un usuario con más logging detallado
function getLatestTransactionForUser(userEmail) {
  console.log(`🔍 Buscando última transacción para email: ${userEmail}`);
  
  const externalFile = path.join(__dirname, '../db/external_transactions.json');
  
  if (!fs.existsSync(externalFile)) {
    console.log(`❌ Archivo de transacciones no encontrado: ${externalFile}`);
    return null;
  }

  try {
    // Leer todas las transacciones
    const transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
    
    console.log('📊 Total de transacciones:', transactions.length);
    
    // Filtrar y loguear transacciones del usuario
    const userTransactions = transactions.filter(t => {
      const match = t.userEmail && 
        t.userEmail.toLowerCase() === userEmail.toLowerCase();
      
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

    // Ordenar por fecha de creación
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

  console.log(`🔎 Solicitud de última transacción para: ${userEmail}`);

  // Validar que se proporcione un email
  if (!userEmail) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere un email de usuario'
    });
  }

  try {
    // Buscar la última transacción
    const latestTransaction = getLatestTransactionForUser(userEmail);

    if (latestTransaction) {
      res.json({
        success: true,
        transaction: latestTransaction
      });
    } else {
      console.warn(`⚠️ No se encontró transacción para ${userEmail}`);
      res.json({
        success: false,
        error: 'No se encontraron transacciones para este usuario'
      });
    }
  } catch (error) {
    console.error('❌ Error al obtener última transacción:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
});

// Endpoint público para generar QR desde comercio externo 
router.post('/generate', async (req, res) => {
  try {
    // Extraer y validar el email del usuario
    const userEmail = extractUserEmail(req);

    // Generar un ID de transacción único
    const transactionId = 'DEMO-' + Date.now();

    // Preparar los datos del cliente
    const customerData = {
      name: req.body.customerName,
      email: req.body.customerEmail,
      phone: req.body.customerPhone,
      cpf: req.body.customerCpf
    };

    // Log detallado de los datos recibidos
    console.log('📦 Datos recibidos para generación de QR:', {
      userEmail,
      transactionId,
      customerData,
      amountUSD: req.body.amountUSD
    });

    // Llamar a Rendix/Renpix para obtener el QR
    const pixResult = await rendixApi.createPixChargeLink({
      amountUSD: req.body.amountUSD,
      customer: customerData,
      controlNumber: uuidv4(),
      webhook: process.env.RENPIX_WEBHOOK || 'https://pix-gateway-dev2.onrender.com/api/webhook'
    });

    // Crear la transacción con información detallada
    const transaction = {
      // Información de identificación
      internalId: transactionId,
      userEmail: userEmail,  // Guardar explícitamente el email del usuario
      
      // Detalles de la transacción
      amountUSD: req.body.amountUSD,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'PENDIENTE',
      
      // Información del cliente
      customer: customerData,
      
      // Información adicional de Rendix
      vetTax: pixResult.vetTax,
      priceNationalCurrency: pixResult.priceNationalCurrency,
      
      // Datos del QR
      qrData: {
        pixCopyPast: pixResult.pixCopyPast || '',
        qrCodeBase64: pixResult.qrCodeBase64 || ''
      },
      
      // Metadatos de depuración
      _debug: {
        sourceIP: req.ip,
        requestBody: JSON.stringify(req.body),
        timestamp: new Date().toISOString()
      }
    };

    // Guardar transacción en archivo
    const externalFile = path.join(__dirname, '../db/external_transactions.json');
    let transactions = [];
    
    // Leer archivo existente
    if (fs.existsSync(externalFile)) {
      try {
        transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
      } catch (readError) {
        console.error('❌ Error al leer archivo de transacciones:', readError);
        transactions = [];
      }
    }

    // Añadir nueva transacción
    transactions.push(transaction);

    // Guardar archivo con manejo de errores
    try {
      fs.writeFileSync(externalFile, JSON.stringify(transactions, null, 2));
      console.log('💾 Transacción guardada exitosamente');
      console.log('📝 Detalles de la transacción guardada:', {
        userEmail: transaction.userEmail,
        amountUSD: transaction.amountUSD,
        createdAt: transaction.createdAt
      });
    } catch (writeError) {
      console.error('❌ Error al guardar transacción:', writeError);
    }

    // Respuesta al cliente
    const responseData = {
      success: true,
      paymentUrl: `/payment-window/${transactionId}`,
      transactionId,
      amountUSD: transaction.amountUSD,
      userEmail: userEmail,  // Incluir email en la respuesta
      qrData: transaction.qrData,
      expiresAt: transaction.expiresAt
    };

    // Log final de la respuesta
    console.log('📤 Respuesta generada:', {
      success: responseData.success,
      transactionId: responseData.transactionId,
      userEmail: responseData.userEmail
    });

    res.json(responseData);

  } catch (error) {
    // Manejo de errores detallado
    console.error('❌ Error en /generate:', error);
    
    // Log de detalles del error
    if (error.response) {
      console.error('Detalles de respuesta:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Error al generar QR',
      details: error.message,
      requestData: {
        userEmail: req.body.userEmail,
        customerName: req.body.customerName,
        amountUSD: req.body.amountUSD
      }
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
      t.transactionId === id // Considerar ambos posibles ID
    );

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    // Log de depuración al recuperar transacción
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
    
    // Log de depuración para todas las transacciones
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