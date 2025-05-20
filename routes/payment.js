const express = require('express');
const router = express.Router();
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rendixApi = require('../services/rendixApi');

router.post('/', async (req, res) => {
  try {
    const { amountCLP, customer } = req.body;
    
    // Validar datos de entrada
    if (!amountCLP || !customer || !customer.name || !customer.email || !customer.phone || !customer.cpf) {
      return res.status(400).json({
        success: false,
        error: "Datos incompletos. Se requiere monto y datos del cliente"
      });
    }

    // Cargar tasa de cambio
    const rateFile = './db/rate.json';
    const rateCLPperUSD = fs.existsSync(rateFile) ? JSON.parse(fs.readFileSync(rateFile)).rate : 945;
    
    // Calcular monto en USD
    const amountUSD = (parseFloat(amountCLP) / rateCLPperUSD).toFixed(2);
    
    // Generar ID único para la transacción
    const controlNumber = uuidv4();

    // Obtener credenciales de los headers
    const credentials = {
      email: req.headers['x-renpix-email'],
      password: req.headers['x-renpix-password'],
      merchant_id: req.headers['x-renpix-merchant'],
      rateCLPperUSD
    };

    console.log(`📊 Nueva cotización: ${amountCLP} CLP (${amountUSD} USD) para ${customer.name}`);

    // Llamar a la API de Rendix
    const result = await rendixApi.createPixChargeLink({ amountUSD, customer, controlNumber }, credentials);

    // Guardar transacción en pendientes
    const pendingFile = './db/pending.json';
    const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile)) : [];

    // Crear registro de transacción
    const transaction = {
      id: controlNumber,
      email: customer.email,
      cpf: customer.cpf,
      name: customer.name,
      phone: customer.phone,
      amountCLP,
      amountUSD,
      amountBRL: result.amountBRL || (parseFloat(amountUSD) * 5.3).toFixed(2), // Valor por defecto si no viene
      date: new Date().toISOString(),
      status: "PENDIENTE"
    };

    pending.push(transaction);
    fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
    console.log("📌 Transacción guardada en pending.json:", controlNumber);

    // Enviar respuesta al cliente
    res.json({
      success: true,
      transactionId: controlNumber,
      amountUSD,
      rateCLPperUSD,
      qrData: result.qrData || {
        qrCodeBase64: result.qrCodeBase64,
        pixCopyPast: result.pixCopyPast
      },
      vetTax: result.vetTax || 5.3,
      amountBRL: result.amountBRL || (parseFloat(amountUSD) * 5.3).toFixed(2)
    });
  } catch (err) {
    console.error("❌ Error al generar QR:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: "Error generando QR: " + (err.message || "Error desconocido")
    });
  }
});

module.exports = router;