// Este es un archivo corregido con el retorno del ID real entregado por Rendix agregado correctamente.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const rendixApi = require('../services/rendixApi'); // Importar el servicio de API

// Ruta para procesar enlaces de pago PIX
router.post('/', async (req, res) => {
  console.log('📦 Recibida solicitud de enlace de pago:', req.body);

  try {
    const { name, email, phone, cpf, description } = req.body;
    let { amountCLP, amountUSD, currency, amount } = req.body;
    const userEmail = req.body.userEmail;

    if (!name || !email || !phone || !cpf || !description) {
      return res.status(400).json({ success: false, error: 'Todos los campos son obligatorios para generar un enlace de pago' });
    }

    if (amount && !amountCLP && !amountUSD) {
      if (currency === 'USD') {
        amountUSD = amount;
      } else {
        amountCLP = amount;
        currency = 'CLP';
      }
    }

    if (!amountCLP && !amountUSD) {
      return res.status(400).json({ success: false, error: 'Debe proporcionar un monto válido' });
    }

    const rateFile = path.join(__dirname, '../db/rate.json');
    let rateCLPperUSD = 945;

    if (fs.existsSync(rateFile)) {
      try {
        const rateData = JSON.parse(fs.readFileSync(rateFile, 'utf8'));
        rateCLPperUSD = rateData.rate || rateCLPperUSD;
      } catch (error) {
        console.error('❌ Error al leer el archivo de tasa:', error);
      }
    }

    if (amountCLP && !amountUSD) {
      amountUSD = (parseFloat(amountCLP) / rateCLPperUSD).toFixed(2);
    }

    if (amountUSD && !amountCLP) {
      amountCLP = (parseFloat(amountUSD) * rateCLPperUSD).toFixed(0);
    }

    const originalCurrency = currency || (amountCLP && !amountUSD ? 'CLP' : 'USD');
    const transactionId = uuidv4();

    const customer = { name, email, phone, cpf };
    const webhookUrl = process.env.RENPIX_WEBHOOK || 'http://localhost:3000/api/webhook';

    const linkResponse = await rendixApi.createPaymentLink({
      amountUSD: parseFloat(amountUSD),
      customer,
      controlNumber: transactionId,
      description
    });

    const parsedUSD = parseFloat(amountUSD);
    let amountBRL;
    const usdToBrlRate = linkResponse.vetTax || 5.3;

    if (!isNaN(parsedUSD)) {
      amountBRL = (parsedUSD * usdToBrlRate).toFixed(2);
    } else {
      amountBRL = "0.00";
    }

    const transaction = {
      id: transactionId,
      name,
      email,
      phone,
      cpf,
      amountCLP,
      amountUSD,
      amountBRL,
      date: new Date().toISOString(),
      status: 'PENDIENTE',
      originalCurrency,
      webhookUrl,
      userEmail,
      description,
      paymentMethod: 'link'
    };

    const pendingFile = path.join(__dirname, '../db/pending.json');
    let pendingTransactions = [];

    if (fs.existsSync(pendingFile)) {
      try {
        pendingTransactions = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      } catch (error) {
        console.error('❌ Error al leer el archivo de transacciones pendientes:', error);
      }
    }

    pendingTransactions.push(transaction);
    fs.writeFileSync(pendingFile, JSON.stringify(pendingTransactions, null, 2));

    const response = {
      success: true,
      transactionId,
      id: linkResponse?.id || transactionId,
      currency: originalCurrency,
      amountCLP,
      amountUSD,
      amountBRL,
      rateCLPperUSD,
      vetTax: usdToBrlRate.toFixed(4),
      name,
      email,
      phone,
      cpf,
      description,
      webhookUrl,
      date: new Date().toISOString()
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Error al procesar la solicitud de enlace de pago:', error);
    res.status(500).json({ success: false, error: `Error del servidor: ${error.message}` });
  }
});

module.exports = router;