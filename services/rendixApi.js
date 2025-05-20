const axios = require('axios');
require('dotenv').config();

let token = null;
let tokenExpiry = null;

async function authenticate() {
  console.log('🔐 Autenticando en Rendix...');
  try {
    console.log('URL API:', process.env.RENPIX_API_URL);
    console.log('Email:', process.env.RENPIX_EMAIL);
    console.log('Merchant ID:', process.env.RENPIX_MERCHANT_ID);
    
    const res = await axios.post(`${process.env.RENPIX_API_URL}/login`, {
      email: process.env.RENPIX_EMAIL,
      password: process.env.RENPIX_PASSWORD
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('🔍 Respuesta autenticación (status):', res.status);
    
    if (res.data && res.data.data && res.data.data.token) {
      token = res.data.data.token;
      // Establecer expiración del token (podría ser diferente según la API)
      tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 horas
      console.log('✅ Token obtenido, válido hasta:', tokenExpiry);
      return token;
    } else {
      console.error('❌ Error en formato de respuesta de autenticación:', JSON.stringify(res.data));
      throw new Error('Formato de respuesta de autenticación inválido');
    }
  } catch (error) {
    console.error('❌ Error de autenticación:', error.message);
    if (error.response) {
      console.error('Detalles respuesta:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('Error en la solicitud (no se recibió respuesta)');
    } else {
      console.error('Error en la configuración de la solicitud:', error.message);
    }
    throw error;
  }
}

// Verificar si el token es válido o está próximo a expirar
function isTokenValid() {
  if (!token || !tokenExpiry) return false;
  // Renovar si faltan menos de 30 minutos para expirar
  return tokenExpiry > new Date(Date.now() + 30 * 60 * 1000);
}

async function createPixChargeLink({ amountUSD, customer, controlNumber }) {
  try {
    // Verificar si necesitamos obtener o renovar el token
    if (!isTokenValid()) {
      console.log('🔑 Token no disponible o próximo a expirar, obteniendo uno nuevo...');
      await authenticate();
    }

    console.log('💰 Generando solicitud de cobro para:', customer.name, 'Monto:', amountUSD, 'USD');
    console.log('🔑 Control Number:', controlNumber);
    console.log('🔑 Merchant ID:', process.env.RENPIX_MERCHANT_ID);
    
    // Verificar que tenemos una URL de webhook configurada
    if (!process.env.RENPIX_WEBHOOK) {
      console.warn('⚠️ ADVERTENCIA: No se ha configurado RENPIX_WEBHOOK en variables de entorno');
      console.warn('⚠️ Las notificaciones de pago no se recibirán correctamente');
    } else {
      console.log('📡 Webhook URL:', process.env.RENPIX_WEBHOOK);
    }

    // Asegurarse de que el monto es un número
    const purchase = parseFloat(amountUSD);
    if (isNaN(purchase) || purchase <= 0) {
      throw new Error(`Monto inválido: ${amountUSD}`);
    }

    // Construir el payload con el webhook explícito
    const payload = {
      merchantId: Number(process.env.RENPIX_MERCHANT_ID),
      purchase: purchase,
      cpf: customer.cpf,
      controlNumber: controlNumber,
      phone: customer.phone,
      email: customer.email,
      webhook: process.env.RENPIX_WEBHOOK || "http://localhost:3000/api/webhook", // Usar URL por defecto si no está configurada
      currencyCode: 'USD',
      operationCode: 1,
      beneficiary: customer.name
    };

    console.log('📦 Payload completo:', JSON.stringify(payload));
    
    // Destacar el webhook en los logs
    console.log('📣 URL del webhook enviada:', payload.webhook);

    const res = await axios.post(`${process.env.RENPIX_API_URL}/sell`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 Respuesta API (status):', res.status);
    
    // Loguear las propiedades para debug
    if (res.data && res.data.data) {
      const responseData = res.data.data;
      console.log('📊 Propiedades de la respuesta:');
      Object.keys(responseData).forEach(key => {
        console.log(`  - ${key}: ${JSON.stringify(responseData[key])}`);
      });
      
      // Buscar específicamente propiedades relacionadas con taxRate o vetTax
      const taxRelatedKeys = Object.keys(responseData).filter(key => 
        key.toLowerCase().includes('tax') || 
        key.toLowerCase().includes('rate') || 
        key.toLowerCase().includes('vet')
      );
      
      if (taxRelatedKeys.length > 0) {
        console.log('💲 Propiedades relacionadas con impuestos encontradas:', taxRelatedKeys);
      } else {
        console.warn('⚠️ No se encontraron propiedades relacionadas con impuestos en la respuesta');
      }
    }

    if (!res.data || !res.data.data) {
      console.error('❌ Respuesta inválida de la API:', res.data);
      throw new Error('Formato de respuesta inválido');
    }

    console.log('✅ Cobro generado exitosamente');
    
    // Combinar la respuesta con el controlNumber original y añadir el webhook usado
    return {
      ...res.data.data,
      transactionId: controlNumber,
      controlNumber,
      webhookUrl: payload.webhook // Incluir la URL del webhook en la respuesta para referencia
    };
  } catch (error) {
    console.error('❌ Error al generar cobro PIX:', error.message);
    if (error.response) {
      console.error('Detalles respuesta:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // En caso de error de token expirado, intentar renovar token y reintentar
      if (error.response.status === 401) {
        console.log('🔄 Token expirado, renovando...');
        token = null;
        tokenExpiry = null;
        await authenticate();
        return createPixChargeLink({ amountUSD, customer, controlNumber });
      }
    } else if (error.request) {
      console.error('Error en la solicitud (no se recibió respuesta)');
    } else {
      console.error('Error en la configuración de la solicitud:', error.message);
    }
    
    throw error;
  }
}

module.exports = { createPixChargeLink };