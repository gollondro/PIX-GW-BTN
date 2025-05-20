const express = require('express');
const router = express.Router();
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const rendixApi = require('../services/rendixApi');

router.post('/', async (req, res) => {
  try {
    const { amountCLP, amountUSD, currency, customer, userName } = req.body;
    
    // Validar datos de entrada seg��n moneda
    if (currency === 'CLP' && !amountCLP) {
      return res.status(400).json({
        success: false,
        error: "Monto en CLP es requerido"
      });
    }
    
    if (currency === 'USD' && !amountUSD) {
      return res.status(400).json({
        success: false,
        error: "Monto en USD es requerido"
      });
    }
    
    if (!customer || !customer.name || !customer.email || !customer.phone || !customer.cpf) {
      return res.status(400).json({
        success: false,
        error: "Datos incompletos del cliente"
      });
    }

    // Cargar tasa de cambio
    const rateFile = './db/rate.json';
    const rateCLPperUSD = fs.existsSync(rateFile) ? JSON.parse(fs.readFileSync(rateFile)).rate : 945;
    
    // Calcular montos seg��n moneda seleccionada
    let finalAmountCLP, finalAmountUSD;
    
    if (currency === 'CLP') {
      finalAmountCLP = parseFloat(amountCLP);
      finalAmountUSD = (finalAmountCLP / rateCLPperUSD).toFixed(2);
    } else {
      finalAmountUSD = parseFloat(amountUSD);
      finalAmountCLP = (finalAmountUSD * rateCLPperUSD).toFixed(0);
    }
    
    // Generar ID ��nico para la transacci��n
    const controlNumber = uuidv4();

    // Capturar informaci��n del usuario que hace la petici��n
    const userEmail = req.headers['x-user-email'] || 'unknown@user.com';

    // Obtener credenciales de los headers
    const credentials = {
      email: req.headers['x-renpix-email'],
      password: req.headers['x-renpix-password'],
      merchant_id: req.headers['x-renpix-merchant'],
      rateCLPperUSD
    };

    console.log(`?? Nueva cotizaci��n: ${finalAmountCLP} CLP (${finalAmountUSD} USD) para ${customer.name} por ${userEmail}`);

    // Llamar a la API de Rendix
    const result = await rendixApi.createPixChargeLink({ 
      amountUSD: finalAmountUSD, 
      customer, 
      controlNumber 
    }, credentials);

    // Guardar transacci��n en pendientes
    const pendingFile = './db/pending.json';
    const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile)) : [];

    // Crear registro de transacci��n
    const transaction = {
      id: controlNumber,
      email: customer.email,
      cpf: customer.cpf,
      name: customer.name,
      phone: customer.phone,
      amountCLP: finalAmountCLP,
      amountUSD: finalAmountUSD,
      originalCurrency: currency,
      amountBRL: result.amountBRL || (parseFloat(finalAmountUSD) * 5.3).toFixed(2),
      date: new Date().toISOString(),
      status: "PENDIENTE",
      createdBy: userEmail, // Guardar qui��n cre�� la transacci��n
      userName: userName || userEmail // Nombre para mostrar en reportes
    };

    pending.push(transaction);
    fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
    console.log("?? Transacci��n guardada en pending.json:", controlNumber);

    // Enviar respuesta al cliente
    res.json({
      success: true,
      transactionId: controlNumber,
      amountCLP: finalAmountCLP,
      amountUSD: finalAmountUSD,
      currency,
      rateCLPperUSD,
      qrData: result.qrData || {
        qrCodeBase64: result.qrCodeBase64,
        pixCopyPast: result.pixCopyPast
      },
      vetTax: result.vetTax || 5.3,
      amountBRL: result.amountBRL || (parseFloat(finalAmountUSD) * 5.3).toFixed(2)
    });
  } catch (err) {
    console.error("? Error al generar QR:", err.response?.data || err.message);
    res.status(500).json({ 
      success: false, 
      error: "Error generando QR: " + (err.message || "Error desconocido")
    });
  }
});

module.exports = router;