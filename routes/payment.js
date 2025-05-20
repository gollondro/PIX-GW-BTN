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
        console.error('?? Error al leer el archivo de tasa:', error);
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
    
    // Llamar a la API de Rendix para crear la solicitud de pago
    console.log('?? Conectando con API de RENPIX...');
    
    const pixResponse = await rendixApi.createPixChargeLink({
      amountUSD: parseFloat(amountUSD),
      customer,
      controlNumber: transactionId
    });
    
    console.log('?? Respuesta API RENPIX:', pixResponse);
    
    // Calcular monto en BRL (usando datos reales de la API si estan disponibles)
   let amountBRL = pixResponse.amount || pixResponse.amountBRL;
// Obtener el vetTax directamente desde la API
let vetTax = pixResponse.vetTax || pixResponse.tax || pixResponse.taxRate;

// Si no hay formato de porcentaje y es un numero, formatearlo
if (typeof vetTax === 'number') {
  vetTax = (vetTax * 100).toFixed(2) + '%';
} else if (typeof vetTax === 'string' && !vetTax.includes('%')) {
  // Si es un string pero no contiene %, agregar el simbolo
  vetTax = vetTax + '%';
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
      originalCurrency
    };
    
    // Guardar en la base de datos de transacciones pendientes
    const pendingFile = path.join(__dirname, '../db/pending.json');
    let pendingTransactions = [];
    
    if (fs.existsSync(pendingFile)) {
      try {
        pendingTransactions = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      } catch (error) {
        console.error('?? Error al leer el archivo de transacciones pendientes:', error);
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
      vetTax: '1.2%',
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