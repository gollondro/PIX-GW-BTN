const axios = require('axios');

async function loginToRendix(email, password) {
  const res = await axios.post(`${process.env.RENPIX_API_URL}/login`, {
    email,
    password
  });
  return res.data.token;
}

async function createPixChargeLink({ amountUSD, customer, controlNumber }, credentials) {
  const token = await loginToRendix(credentials.email, credentials.password);

  const payload = {
    MerchantId: credentials.merchant_id,
    Purchase: parseFloat(amountUSD),
    Description: "Cobro con PIX desde Afex",
    "E-mail": customer.email,
    Webhook: process.env.RENPIX_WEBHOOK,
    CurrencyCode: "USD",
    OperationCode: 1,
    ControlNumber: controlNumber,
    Beneficiary: customer.name
  };

  const res = await axios.post(`${process.env.RENPIX_API_URL}/link`, payload, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  return {
    transactionId: controlNumber,
    qrData: res.data,
    amountUSD,
    rateCLPperUSD: credentials.rateCLPperUSD,
    vetTax: res.data.vetTax,
    amountBRL: res.data.priceNationalCurrency
  };
}

module.exports = {
  createPixChargeLink
};