const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const rendixApi = require('../services/rendixApi'); // Importar el servicio de API

// Endpoint público para generar QR desde comercio externo 
router.post('/generate', async (req, res) => {
  try {
    const transactionId = 'DEMO-' + Date.now();

    // Llama a RENPIX/Rendix para obtener el QR y el código
    const pixResult = await rendixApi.createPixChargeLink({
      amountUSD: req.body.amountUSD,
      customer: {
        name: req.body.customerName,
        email: req.body.customerEmail,
        phone: req.body.customerPhone,
        cpf: req.body.customerCpf
      },
      controlNumber: uuidv4(),
      webhook: 'https://pix-gateway-dev2.onrender.com/api/webhook'
    });

    // Crear la transacción sin almacenar el QR base64
    const transaction = {
      internalId: transactionId,
      userEmail: req.body.userEmail,
      amountUSD: req.body.amountUSD,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      status: 'PENDIENTE',
      customer: {
        name: req.body.customerName,
        email: req.body.customerEmail,
        phone: req.body.customerPhone,
        cpf: req.body.customerCpf
      },
      // Omitir pixQrBase64 y pixCode para no almacenarlos
      vetTax: pixResult.vetTax,
      priceNationalCurrency: pixResult.priceNationalCurrency,
      // Agregar información del QR para la respuesta
      qrData: {
        pixCopyPast: pixResult.pixCopyPast || '',
        qrCodeBase64: pixResult.qrCodeBase64 || ''
      }
    };

    // Guardar transacción sin QR
    const externalFile = path.join(__dirname, '../db/external_transactions.json');
    let transactions = [];
    if (fs.existsSync(externalFile)) {
      transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
    }
    transactions.push(transaction);
    fs.writeFileSync(externalFile, JSON.stringify(transactions, null, 2));

    res.json({
      success: true,
      paymentUrl: `/payment-window/${transactionId}`,
      transactionId,
      amountUSD: transaction.amountUSD,
      qrData: transaction.qrData, // Incluir datos del QR en la respuesta
      expiresAt: transaction.expiresAt
    });
  } catch (error) {
    console.error('❌ Error en /generate:', error);
    res.status(500).json({ success: false, error: 'Error al generar QR' });
  }
});

// Endpoint para obtener datos de una transacción externa (para la ventana de pago)
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
    const transaction = externalTransactions.find(t => t.internalId === id);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transacción no encontrada'
      });
    }

    // Agregar llamada a la API para obtener QR fresco
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
    res.json({ success: true, transactions });
  } catch (error) {
    console.error('❌ Error al obtener transacciones botón:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

module.exports = router;