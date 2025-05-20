
const express = require('express');
const fs = require('fs');
const router = express.Router();

router.post('/', (req, res) => {
  const { transactionId, idVentaTienda } = req.body;
  const paidFile = './db/paid.json';
  const paid = fs.existsSync(paidFile) ? JSON.parse(fs.readFileSync(paidFile)) : [];

  const match = paid.find(p => p.id === transactionId);
  if (match) {
    match.idVentaTienda = idVentaTienda;
    fs.writeFileSync(paidFile, JSON.stringify(paid, null, 2));
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'No encontrada' });
  }
});
module.exports = router;
