
const express = require('express');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

router.post('/', (req, res) => {
  const { amountCLP, customer } = req.body;
  const rate = JSON.parse(fs.readFileSync('./db/rate.json')).rate || 945;
  const amountUSD = (amountCLP / rate).toFixed(2);
  const id = uuidv4();

  const pendingFile = './db/pending.json';
  const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile)) : [];
  pending.push({ id, ...customer, amountCLP, amountUSD, date: new Date().toISOString(), status: "PENDIENTE" });
  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));

  res.json({
    success: true,
    transactionId: id,
    amountUSD,
    rateCLPperUSD: rate,
    qrData: { qrCodeBase64: "fake-base64-image" }, // placeholder
    vetTax: 5.87,
    amountBRL: (amountUSD * 5.87).toFixed(2)
  });
});
module.exports = router;
