const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const rendixApi = require('../services/rendixApi'); // Importar el servicio de API
const result = await createPaymentLink(...);
res.json(result); // 👈 esto debe incluir el ID

// Ruta para procesar enlaces de pago PIX
router.post('/', async (req, res) => {
  console.log('📦 Recibida solicitud de enlace de pago:', req.body);
  
  try {
    // Validar campos requeridos
    const { name, email, phone, cpf, description } = req.body;
    let { amountCLP, amountUSD, currency, amount } = req.body;
    
    // Capturar información del usuario que genera la cotización
    const userEmail = req.body.userEmail;
    
    if (!name || !email || !phone || !cpf || !description) {
      console.error('❌ Campos obligatorios faltantes');
      return res.status(400).json({ 
        success: false, 
        error: 'Todos los campos son obligatorios para generar un enlace de pago' 
      });
    }
    
    // Manejar compatibilidad con el nuevo formato (donde se envia solo 'amount')
    if (amount && !amountCLP && !amountUSD) {
      if (currency === 'USD') {
        amountUSD = amount;
      } else {
        amountCLP = amount;
        currency = 'CLP';
      }
    }
    
    // Asegurarse de que tenemos al menos un valor de monto
    if (!amountCLP && !amountUSD) {
      console.error('❌ No se especificó ningún monto (CLP o USD)');
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un monto válido'
      });
    }
    
    // Leer archivo de tasa de cambio
    const rateFile = path.join(__dirname, '../db/rate.json');
    let rateCLPperUSD = 945; // Valor por defecto
    
    if (fs.existsSync(rateFile)) {
      try {
        const rateData = JSON.parse(fs.readFileSync(rateFile, 'utf8'));
        rateCLPperUSD = rateData.rate || rateCLPperUSD;
      } catch (error) {
        console.error('❌ Error al leer el archivo de tasa:', error);
      }
    }
    
    // Calcular valor en USD si se proporcionó CLP
    if (amountCLP && !amountUSD) {
      amountUSD = (parseFloat(amountCLP) / rateCLPperUSD).toFixed(2);
    }
    
    // Calcular valor en CLP si se proporcionó USD
    if (amountUSD && !amountCLP) {
      amountCLP = (parseFloat(amountUSD) * rateCLPperUSD).toFixed(0);
    }
    
    // Registrar moneda original para estadísticas
    const originalCurrency = currency || (amountCLP && !amountUSD ? 'CLP' : 'USD');
    
    // Generar ID único para la transacción
    const transactionId = uuidv4();
    
    // Preparar los datos del cliente para la API
    const customer = {
      name,
      email,
      phone,
      cpf
    };

    // Verificar que tenemos configurado el webhook
    const webhookUrl = process.env.RENPIX_WEBHOOK || 'http://localhost:3000/api/webhook';
    console.log('📡 Webhook URL configurada:', webhookUrl);
    
    // Llamar a la API de Rendix para crear la solicitud de pago por enlace
    console.log('🔄 Conectando con API de RENPIX para generar enlace...');
    
    // Llamar a la API específica para enlaces
    const linkResponse = await rendixApi.createPaymentLink({
      amountUSD: parseFloat(amountUSD),
      customer,
      controlNumber: transactionId,
      description
    });
    
    console.log('📥 Respuesta API RENPIX (enlace):', linkResponse);
    
    // Calcular el monto en BRL
    const parsedUSD = parseFloat(amountUSD);
    let amountBRL;
    
    // Usar tasa de cambio de la API si está disponible, o valor por defecto
    const usdToBrlRate = linkResponse.vetTax || 5.3;
    
    if (!isNaN(parsedUSD)) {
      amountBRL = (parsedUSD * usdToBrlRate).toFixed(2);
      console.log('💰 Monto en BRL calculado:', amountBRL);
    } else {
      console.error('❌ Error al calcular monto BRL: valor USD inválido');
      amountBRL = "0.00";
    }
    
    // Preparar registro para almacenar
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
    
    // Guardar en la base de datos de transacciones pendientes
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
    
    // Preparar la respuesta para el cliente
    const response = {
      success: true,
      transactionId,
      id: transactionId,
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
    
    console.log('✅ Solicitud de enlace de pago procesada exitosamente');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error al procesar la solicitud de enlace de pago:', error);
    res.status(500).json({
      success: false,
      error: `Error del servidor: ${error.message}`
    });
  }
});

module.exports = router;