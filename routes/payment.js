const express = require('express');
const router = express.Router();
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rendixApi = require('../services/rendixApi');

router.post('/', async (req, res) => {
  const { amountCLP, customer } = req.body;
  const rateFile = './db/rate.json';
  const rateCLPperUSD = fs.existsSync(rateFile) ? JSON.parse(fs.readFileSync(rateFile)).rate : 945;
  const amountUSD = (parseFloat(amountCLP) / rateCLPperUSD).toFixed(2);
  const controlNumber = uuidv4();

  const credentials = {
    email: req.headers['x-renpix-email'],
    password: req.headers['x-renpix-password'],
    merchant_id: req.headers['x-renpix-merchant'],
    rateCLPperUSD
  };

  try {
    const result = await rendixApi.createPixChargeLink({ amountUSD, customer, controlNumber }, credentials);

    const pendingFile = './db/pending.json';
    const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile)) : [];

    pending.push({
        id: controlNumber,
		//id: result.transactionId,
      email: customer.email,
      cpf: customer.cpf,
      name: customer.name,
      phone: customer.phone,
      amountCLP,
      amountUSD,
      amountBRL: result.amountBRL,
      date: new Date().toISOString(),
      status: "PENDIENTE"
    });

    fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
    console.log("📌 Guardado en pending.json:", result.transactionId);

    res.json({
      success: true,
      transactionId: result.transactionId,
      amountUSD: result.amountUSD,
      rateCLPperUSD: result.rateCLPperUSD,
      qrData: result.qrData,
      vetTax: result.vetTax,
      amountBRL: result.amountBRL
    });
  } catch (err) {
    console.error("Error al generar QR:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: "Error generando QR" });
  }
});

module.exports = router;