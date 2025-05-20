const axios = require('axios');
require('dotenv').config();

let token = null;

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
      console.log('✅ Token obtenido');
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

async function createPixChargeLink({ amountUSD, customer, controlNumber }) {
  try {
    if (!token) {
      await authenticate();
    }

    console.log('💰 Generando solicitud de cobro para:', customer.name, 'Monto:', amountUSD, 'USD');
    console.log('🔑 Control Number:', controlNumber);
    console.log('🔑 Merchant ID:', process.env.RENPIX_MERCHANT_ID);

    // Asegurarse de que el monto es un número
    const purchase = parseFloat(amountUSD);
    if (isNaN(purchase) || purchase <= 0) {
      throw new Error(`Monto inválido: ${amountUSD}`);
    }

    const payload = {
      merchantId: Number(process.env.RENPIX_MERCHANT_ID),
      purchase: purchase,
      cpf: customer.cpf,
      controlNumber: controlNumber,
      phone: customer.phone,
      email: customer.email,
      webhook: process.env.RENPIX_WEBHOOK,
      currencyCode: 'USD',
      operationCode: 1,
      beneficiary: customer.name
    };

    console.log('📦 Payload:', JSON.stringify(payload));

    const res = await axios.post(`${process.env.RENPIX_API_URL}/sell`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 Respuesta API (status):', res.status);
    console.log('🔍 Respuesta API (data):', JSON.stringify(res.data));

    if (!res.data || !res.data.data) {
      console.error('❌ Respuesta inválida de la API:', res.data);
      throw new Error('Formato de respuesta inválido');
    }

    console.log('✅ Cobro generado exitosamente');
    
    // Combinar la respuesta con el controlNumber original
    return {
      ...res.data.data,
      transactionId: controlNumber,
      controlNumber
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