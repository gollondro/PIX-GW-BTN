const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

let token = null;

async function authenticate() {
  console.log('🔐 Autenticando en Rendix...');
  const res = await axios.post(`${process.env.RENPIX_API_URL}/login`, {
    email: process.env.RENPIX_EMAIL,
    password: process.env.RENPIX_PASSWORD
  }, {
    headers: { 'Content-Type': 'application/json' }
  });

  token = res.data.data.token;
  console.log('✅ Token obtenido');
  return token;
}

async function createPixChargeLink({ amountUSD, customer, controlNumber }) {
  if (!token) await authenticate();

  console.log('💰 Generando solicitud de cobro con token...');
  const res = await axios.post(`${process.env.RENPIX_API_URL}/sell`, {
    merchantId: Number(process.env.RENPIX_MERCHANT_ID),
    purchase: Number(amountUSD),
    cpf: customer.cpf,
    controlNumber: uuidv4(),
    phone: customer.phone,
    email: customer.email,
    webhook: process.env.RENPIX_WEBHOOK,
    currencyCode: 'USD',
    operationCode: 1,
    beneficiary: customer.name
  }, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('✅ Cobro generado');
  return res.data.data;
  // 👇 Devolver también el controlNumber para guardarlo correctamente
  return {
    ...res.data.data,
    controlNumber
  };
}

module.exports = { createPixChargeLink };
