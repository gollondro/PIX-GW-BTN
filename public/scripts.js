const axios = require('axios');
require('dotenv').config();

let token = null;

async function authenticate() {
  console.log('🔐 Autenticando en Rendix...');
  try {
    const res = await axios.post(`${process.env.RENPIX_API_URL}/login`, {
      email: process.env.RENPIX_EMAIL,
      password: process.env.RENPIX_PASSWORD
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.data && res.data.data && res.data.data.token) {
      token = res.data.data.token;
      console.log('✅ Token obtenido');
      return token;
    } else {
      console.error('❌ Error en formato de respuesta de autenticación:', res.data);
      throw new Error('Formato de respuesta de autenticación inválido');
    }
  } catch (error) {
    console.error('❌ Error de autenticación:', error.message);
    if (error.response) {
      console.error('Detalles:', error.response.data);
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

    const payload = {
      merchantId: Number(process.env.RENPIX_MERCHANT_ID),
      purchase: Number(amountUSD),
      cpf: customer.cpf,
      controlNumber: controlNumber, // Usar el controlNumber proporcionado
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

    if (!res.data || !res.data.data) {
      console.error('❌ Respuesta inválida de la API:', res.data);
      throw new Error('Formato de respuesta inválido');
    }

    console.log('✅ Cobro generado exitosamente');
    
    // Combinar la respuesta con el controlNumber original
    return {
      ...res.data.data,
      transactionId: controlNumber, // Asegurar que el ID de transacción sea el controlNumber
      controlNumber
    };
  } catch (error) {
    console.error('❌ Error al generar cobro PIX:', error.message);
    if (error.response) {
      console.error('Detalles de error:', error.response.data);
    }
    
    // En caso de error de token expirado, intentar renovar token y reintentar
    if (error.response && error.response.status === 401) {
      console.log('🔄 Token expirado, renovando...');
      token = null;
      await authenticate();
      return createPixChargeLink({ amountUSD, customer, controlNumber });
    }
    
    throw error;
  }
}

module.exports = { createPixChargeLink };