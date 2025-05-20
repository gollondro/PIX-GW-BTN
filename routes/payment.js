const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const rendixApi = require('../services/rendixApi'); // Importar el servicio de API

// Ruta para procesar pagos PIX
router.post('/', async (req, res) => {
  console.log('?? Recibida solicitud de pago:', req.body);
  
  try {
    // Validar campos requeridos
    const { name, email, phone, cpf } = req.body;
    let { amountCLP, amountUSD, currency, amount } = req.body;
    
    if (!name || !email || !phone || !cpf) {
      console.error('? Campos obligatorios faltantes');
      return res.status(400).json({ 
        success: false, 
        error: 'Todos los campos son obligatorios' 
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
      console.error('? No se especifico ningun monto (CLP o USD)');
      return res.status(400).json({
        success: false,
        error: 'Debe proporcionar un monto valido'
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
        console.error('? Error al leer el archivo de tasa:', error);
      }
    }
    
    // Calcular valor en USD si se proporciono CLP
    if (amountCLP && !amountUSD) {
      amountUSD = (parseFloat(amountCLP) / rateCLPperUSD).toFixed(2);
    }
    
    // Calcular valor en CLP si se proporciono USD
    if (amountUSD && !amountCLP) {
      amountCLP = (parseFloat(amountUSD) * rateCLPperUSD).toFixed(0);
    }
    
    // Registrar moneda original para estadisticas
    const originalCurrency = currency || (amountCLP && !amountUSD ? 'CLP' : 'USD');
    
    // Generar ID unico para la transaccion
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
    console.log('?? Webhook URL configurada:', webhookUrl);
    
    // Llamar a la API de Rendix para crear la solicitud de pago
    console.log('?? Conectando con API de RENPIX...');
    
    const pixResponse = await rendixApi.createPixChargeLink({
      amountUSD: parseFloat(amountUSD),
      customer,
      controlNumber: transactionId
    });
    
    console.log('?? Respuesta API RENPIX:', pixResponse);
    
    // Obtener el tipo de cambio USD -> BRL (tasa Brasil)
    // La API devuelve diferentes formatos segun la implementacion
    let usdToBrlRate;
    
    // Intentar obtener la tasa desde diferentes propiedades posibles
    if (pixResponse.exchangeRate) {
      usdToBrlRate = pixResponse.exchangeRate;
    } else if (pixResponse.rate) {
      usdToBrlRate = pixResponse.rate;
    } else if (pixResponse.vetTax) {
      // Asegurarse de que es un numero
      if (typeof pixResponse.vetTax === 'number') {
        usdToBrlRate = pixResponse.vetTax;
      } else if (typeof pixResponse.vetTax === 'string') {
        // Intentar convertir a numero quitando % si existe
        usdToBrlRate = parseFloat(pixResponse.vetTax.replace('%', ''));
      }
    } else {
      // Si no encontramos la tasa, usar un valor por defecto
      usdToBrlRate = 5.3; // Un valor razonable de USD a BRL
      console.warn('?? No se encontro tasa USD->BRL en la respuesta. Usando valor por defecto:', usdToBrlRate);
    }
    
    // Asegurarse de que es un numero valido
    if (isNaN(usdToBrlRate) || usdToBrlRate <= 0) {
      usdToBrlRate = 5.3; // Valor por defecto si no es valido
      console.warn('?? Tasa USD->BRL invalida. Usando valor por defecto:', usdToBrlRate);
    }
    
    // Formatear el valor para mostrar
    const vetTaxFormatted = usdToBrlRate.toFixed(4);
    console.log('?? Tasa de conversion USD->BRL:', vetTaxFormatted);
    
    // Calcular el monto en BRL
    const parsedUSD = parseFloat(amountUSD);
    let amountBRL;
    if (!isNaN(parsedUSD)) {
      amountBRL = (parsedUSD * usdToBrlRate).toFixed(2);
      console.log('?? Monto en BRL calculado:', amountBRL);
    } else {
      console.error('? Error al calcular monto BRL: valor USD invalido');
      amountBRL = "0.00";
    }
    
    // Si la API ya proporciona el monto en BRL, usarlo en lugar del calculado
    if (pixResponse.amount || pixResponse.amountBRL) {
      const apiProvidedAmount = pixResponse.amount || pixResponse.amountBRL;
      if (!isNaN(parseFloat(apiProvidedAmount))) {
        amountBRL = parseFloat(apiProvidedAmount).toFixed(2);
        console.log('?? Usando monto BRL proporcionado por la API:', amountBRL);
      }
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
      webhookUrl // Guardar la URL del webhook para referencia
    };
    
    // Guardar en la base de datos de transacciones pendientes
    const pendingFile = path.join(__dirname, '../db/pending.json');
    let pendingTransactions = [];
    
    if (fs.existsSync(pendingFile)) {
      try {
        pendingTransactions = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      } catch (error) {
        console.error('? Error al leer el archivo de transacciones pendientes:', error);
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
      webhookUrl: pixResponse.webhookUrl || webhookUrl, // Incluir la URL del webhook en la respuesta
      qrData: {
        pixCopyPast: pixResponse.pixCopyPast || pixResponse.url || `https://example.com/pix/${transactionId}`,
        qrCodeBase64: pixResponse.qrCodeBase64 || pixResponse.qrCode
      },
      expiresAt: pixResponse.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos de validez por defecto
    };
    
    console.log('? Solicitud de pago procesada exitosamente');
    res.json(response);
    
  } catch (error) {
    console.error('? Error al procesar la solicitud de pago:', error);
    res.status(500).json({
      success: false,
      error: `Error del servidor: ${error.message}`
    });
  }
});

module.exports = router;