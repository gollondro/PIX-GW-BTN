const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

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
      if (currency === 'CLP') {
        amountCLP = amount;
      } else if (currency === 'USD') {
        amountUSD = amount;
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
    
    // Calcular monto en BRL (ejemplo simplificado)
    const usdToBRL = 5.3; // Tasa USD a BRL de ejemplo
    const amountBRL = (parseFloat(amountUSD) * usdToBRL).toFixed(2);
    
    // Generar ID unico para la transaccion
    const transactionId = uuidv4();
    
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
    
    // En un sistema real, aqui conectariamos con el servicio PIX
    // Vamos a simular una respuesta exitosa
    
    // Generar URL de pago ficticia (en un sistema real esto vendria del proveedor PIX)
    const pixPaymentUrl = `https://example.com/pix/${transactionId}`;
    
    // Generar QR code data ficticio (en base64)
    const mockQRCodeBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFeAJ5jMMdpQAAAABJRU5ErkJggg==';
    
    // Preparar la respuesta
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
        pixCopyPast: pixPaymentUrl,
        qrCodeBase64: mockQRCodeBase64
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutos de validez
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