const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // <-- ESTA LÍNEA DEBE ESTAR AQUÍ
const router = express.Router();
const { createPixChargeLink } = require('../services/rendixApi');
const fetch = require('node-fetch'); // npm install node-fetch
const { getExchangeRate } = require('../services/exchangeRateService'); // Agrega esta línea
const transactionRepository = require('../repositories/transactionRepository');

// Ruta para procesar pagos PIX
router.post('/', async (req, res) => {
  console.log('📦 Recibida solicitud de pago:', req.body);
  
  try {
    // Validar campos requeridos
    const { name, email, phone, cpf } = req.body;
    let { amountCLP, amountUSD, currency, amount } = req.body;
    
    // Capturar información del usuario que genera la cotización
    const userEmail = req.body.userEmail;

    // Buscar el usuario para obtener su operationCode
    const usersFile = path.join(__dirname, '../db/users.json');
    let operationCode = 1; // Valor por defecto
    if (fs.existsSync(usersFile) && userEmail) {
      try {
        const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        const user = users.find(u => u.email === userEmail);
        if (user && user.operationCode) {
          operationCode = user.operationCode;
        }
      } catch (e) {
        console.warn('No se pudo leer operationCode del usuario, usando valor por defecto');
      }
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
      console.error('❌ No se especifico ningun monto (CLP o USD)');
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un monto valido'
      });
    }
    
    // OBTENER TASA DE CAMBIO DESDE LA API EN LÍNEA
    const rateCLPperUSD = await getExchangeRate();
    console.log('💱 Usando tasa de cambio CLP/USD:', rateCLPperUSD);

    // Calcular valor en USD si se proporcionó CLP
    if (amountCLP && !amountUSD) {
      amountUSD = (parseFloat(amountCLP) / rateCLPperUSD).toFixed(2);
    }

    // Calcular valor en CLP si se proporcionó USD
    if (amountUSD && !amountCLP) {
      amountCLP = (parseFloat(amountUSD) * rateCLPperUSD).toFixed(0);
    }
    
    // Registrar moneda original para estadisticas
    const originalCurrency = currency || (amountCLP && !amountUSD ? 'CLP' : 'USD');
    
    // Generar ID unico para la transaccion
    const transactionId = uuidv4();

    const customer = { name, email, phone, cpf };
    const UrlWebhook = process.env.RENPIX_WEBHOOK || 'http://localhost:3000/api/webhook';

    // Construir el payload usando operationCode
    const payload = {
      merchantId: Number(process.env.RENPIX_MERCHANT_ID),
      purchase: parseFloat(amountUSD),
      cpf: cpf,
      controlNumber: transactionId,
      phone: phone,
      email: email,
      UrlWebhook: process.env.RENPIX_WEBHOOK || "http://localhost:3000/api/webhook",
      currencyCode: 'USD',
      operationCode: operationCode, // Usar el operationCode del usuario
      beneficiary: name
    };

    // LOG del payload que se enviará a Renpix (QR)
    console.log('➡️ Payload enviado a Renpix (QR):', JSON.stringify(payload, null, 2));

    const { renpix_email, renpix_password } = req.user || req.body || {};
    const pixCharge = await createPixChargeLink({
      amountUSD,
      customer,
      controlNumber: transactionId,
      renpix_email,
      renpix_password
    });

    // LOG de la respuesta de Renpix (QR)
    console.log('⬅️ Respuesta de Renpix (QR):', JSON.stringify(pixCharge, null, 2));
    
    // Loguear todas las propiedades de la respuesta para debugging
    if (pixCharge) {
      console.log('📊 Lista de todas las propiedades en la respuesta:');
      Object.keys(pixCharge).forEach(key => {
        console.log(`  - ${key}: ${JSON.stringify(pixCharge[key])}`);
      });
    }
    
    // Obtener el tipo de cambio USD -> BRL (tasa Brasil)
    // La API devuelve diferentes formatos segun la implementacion
    let usdToBrlRate;
    
    // Intentar obtener la tasa desde diferentes propiedades posibles
    if (pixCharge.exchangeRate) {
      usdToBrlRate = pixCharge.exchangeRate;
      console.log('💲 Tasa encontrada en exchangeRate:', usdToBrlRate);
    } else if (pixCharge.rate) {
      usdToBrlRate = pixCharge.rate;
      console.log('💲 Tasa encontrada en rate:', usdToBrlRate);
    } else if (pixCharge.vetTax) {
      // Asegurarse de que es un numero
      if (typeof pixCharge.vetTax === 'number') {
        usdToBrlRate = pixCharge.vetTax;
      } else if (typeof pixCharge.vetTax === 'string') {
        // Intentar convertir a numero quitando % si existe
        usdToBrlRate = parseFloat(pixCharge.vetTax.replace('%', ''));
      }
      console.log('💲 Tasa encontrada en vetTax:', usdToBrlRate);
    } else {
      // Si no encontramos la tasa, usar un valor por defecto
      usdToBrlRate = 5.3; // Un valor razonable de USD a BRL
      console.warn('⚠️ No se encontró tasa USD->BRL en la respuesta. Usando valor por defecto:', usdToBrlRate);
    }
    
    // Asegurarse de que es un numero valido
    if (isNaN(usdToBrlRate) || usdToBrlRate <= 0) {
      usdToBrlRate = 5.3; // Valor por defecto si no es valido
      console.warn('⚠️ Tasa USD->BRL inválida. Usando valor por defecto:', usdToBrlRate);
    }
    
    // Formatear el valor para mostrar
    const vetTaxFormatted = usdToBrlRate.toFixed(4);
    console.log('💱 Tasa de conversión USD->BRL:', vetTaxFormatted);
    
    // Calcular el monto en BRL
    const parsedUSD = parseFloat(amountUSD);
    let amountBRL;
    if (!isNaN(parsedUSD)) {
      amountBRL = (parsedUSD * usdToBrlRate).toFixed(2);
      console.log('💰 Monto en BRL calculado:', amountBRL);
    } else {
      console.error('❌ Error al calcular monto BRL: valor USD inválido');
      amountBRL = "0.00";
    }
    
    // Si la API ya proporciona el monto en BRL, usarlo en lugar del calculado
    if (pixCharge.amount || pixCharge.amountBRL) {
      const apiProvidedAmount = pixCharge.amount || pixCharge.amountBRL;
      if (!isNaN(parseFloat(apiProvidedAmount))) {
        amountBRL = parseFloat(apiProvidedAmount).toFixed(2);
        console.log('📊 Usando monto BRL proporcionado por la API:', amountBRL);
      }
    }
    
    // Verificar la disponibilidad de datos del QR
    const qrCodeBase64 = pixCharge.qrCodeBase64 || pixCharge.qrCode || pixCharge.qrImage || pixCharge.qr || '';
    const pixCopyPast = pixCharge.pixCopyPast || pixCharge.pixUrl || pixCharge.url || pixCharge.link || pixCharge.paymentLink || pixCharge.externalLink || '';
    
    // Loggear los datos de QR para debugging
    if (qrCodeBase64) {
      console.log('✅ QR Code Base64 encontrado en:', Object.keys(pixCharge).find(key => pixCharge[key] === qrCodeBase64));
      console.log('📏 Longitud del QR Code Base64:', qrCodeBase64.length);
    } else {
      console.error('⚠️ No se encontró QR Code Base64 en la respuesta de la API');
    }
    
    if (pixCopyPast) {
      console.log('✅ Link de pago encontrado en:', Object.keys(pixCharge).find(key => pixCharge[key] === pixCopyPast));
      console.log('📏 Longitud del link de pago:', pixCopyPast.length);
    } else {
      console.error('⚠️ No se encontró link de pago en la respuesta de la API');
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
      UrlWebhook,
      userEmail
    };
    
    // Guarda usando el repositorio (usa DB si está habilitada)
    await transactionRepository.create(transaction);
    
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
      currency: originalCurrency,
      amountCLP,
      amountUSD,
      amountBRL,
      rateCLPperUSD,
      vetTax: vetTaxFormatted, // Usar el formato correcto sin %
      UrlWebhook: pixCharge.UrlWebhook || UrlWebhook, // Incluir la URL del webhook en la respuesta
      qrData: {
        pixCopyPast: pixCopyPast || `https://example.com/pix/${transactionId}`,
        qrCodeBase64: qrCodeBase64 || '' // Si no hay QR, enviar cadena vacía
      },
      expiresAt: pixCharge.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos de validez por defecto
    };
    
    // Si no hay QR o enlace de pago, añadir mensajes de advertencia
    if (!qrCodeBase64 || !pixCopyPast) {
      response.warnings = [];
      
      if (!qrCodeBase64) {
        response.warnings.push('No se pudo obtener el código QR desde la API');
      }
      
      if (!pixCopyPast) {
        response.warnings.push('No se pudo obtener el enlace de pago desde la API');
      }
    }
    
    console.log('✅ Solicitud de pago procesada exitosamente');
    res.json(response);
    
  } catch (error) {
    console.error('❌ Error al procesar la solicitud de pago:', error);
    console.error('Detalles respuesta:', error.response?.data);
    res.status(500).json({
      success: false,
      error: `Error del servidor: ${error.message}`
    });
  }
});

async function getAgillitasToken() {
  const loginPayload = {
    email: 'afexlojista@teste.com',
    password: 'Welcome@123456*'
  };

  const response = await fetch('https://apisandbox.agillitas.com.br/efx/v2/external/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginPayload)
  });
  const data = await response.json();
  console.log('🔐 Respuesta login Agillitas:', data);
  // El token está en data.data.token
  return data.data && data.data.token;
}

router.post('/payment-link', async (req, res) => {
  const { amount, name, email, phone, cpf, currency, userEmail } = req.body; // <-- Añadir userEmail aquí

  const UrlWebhook = process.env.RENPIX_WEBHOOK;
  const transactionId = uuidv4();

  const payload = {
    merchantId: 3111,
    purchase: Number(amount),
    description: `Link de pago para ${name}`,
    controlNumber: transactionId,
    email,
    UrlWebhook: UrlWebhook,
    currencyCode: currency,
    operationCode: 1,
    beneficiary: name
  };

  try {
    console.log('🔑 Solicitando token Agillitas...');
    const token = await getAgillitasToken();
    console.log('🔑 Token obtenido:', token);

    if (!token) {
      console.error('❌ No se obtuvo token de Agillitas');
      return res.status(500).json({ success: false, error: 'No se obtuvo token de Agillitas' });
    }

    console.log('➡️ Enviando solicitud a Agillitas con payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://apisandbox.agillitas.com.br/efx/v1/external/link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    console.log('⬅️ Esperando respuesta de Agillitas...');
    const data = await response.json();
    console.log('🌐 Respuesta de Agillitas:', JSON.stringify(data, null, 2));

    if (data.success && data.data && data.data.id) {
      // Guardar la transacción CON el userEmail
      const linkTxFile = path.join(__dirname, '../db/payment_links.json');
      let linkTxs = [];
      if (fs.existsSync(linkTxFile)) {
        try {
          linkTxs = JSON.parse(fs.readFileSync(linkTxFile, 'utf8'));
        } catch (e) { linkTxs = []; }
      }

      linkTxs.push({
        id: data.data.id,
        transactionId,
        name,
        email,
        phone,
        cpf,
        amount,
        currency,
        date: new Date().toISOString(),
        status: 'PENDIENTE',
        userEmail: userEmail || 'desconocido' // <-- IMPORTANTE: Guardar el userEmail
      });

      fs.writeFileSync(linkTxFile, JSON.stringify(linkTxs, null, 2));

      res.json({
        success: true,
        id: data.data.id,
        transactionId
      });
    } else {
      return res.status(400).json({ success: false, error: data.message || 'No se pudo generar el link de pago' });
    }
  } catch (error) {
    console.error('❌ Error en /payment-link:', error);
    return res.status(500).json({ success: false, error: 'Error al conectar con Agillitas' });
  }
});

router.get('/links', (req, res) => {
  const linkTxFile = path.join(__dirname, '../db/payment_links.json');
  let linkTxs = [];
  if (fs.existsSync(linkTxFile)) {
    try {
      linkTxs = JSON.parse(fs.readFileSync(linkTxFile, 'utf8'));
    } catch (e) { linkTxs = []; }
  }
  res.json(linkTxs);
});

router.get('/status/:id', (req, res) => {
  const { id } = req.params;
  const paidFile = path.join(__dirname, '../db/paid.json');
  let paid = [];
  if (fs.existsSync(paidFile)) {
    try {
      paid = JSON.parse(fs.readFileSync(paidFile, 'utf8'));
    } catch (e) { paid = []; }
  }
  const match = paid.find(p => p.id === id);
  if (match) {
    res.json({ paid: true, data: match });
  } else {
    res.json({ paid: false });
  }
});

module.exports = router;

// Supón que tienes el transactionId en una variable
let pollingInterval;
function startPollingPago(transactionId) {
  pollingInterval = setInterval(() => {
    fetch(`/api/payment/status/${transactionId}`)
      .then(res => res.json())
      .then(result => {
        if (result.paid) {
          clearInterval(pollingInterval);
          // Oculta el QR
          document.getElementById('qrResult').innerHTML = `
            <div class="alert alert-success">
              Pago recibido.<br>
              Monto: <b>${result.data.amount}</b> ${result.data.currency}<br>
              Fecha: <b>${result.data.paid_at || ''}</b>
            </div>
          `;
        }
      });
  }, 3000); // cada 3 segundos
}

