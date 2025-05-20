
const express = require('express');
const fs = require('fs');
const router = express.Router();

router.post('/', (req, res) => {
  const { transactionId, status } = req.body;
  const pendingFile = './db/pending.json';
  const paidFile = './db/paid.json';

  const pending = fs.existsSync(pendingFile) ? JSON.parse(fs.readFileSync(pendingFile)) : [];
  const paid = fs.existsSync(paidFile) ? JSON.parse(fs.readFileSync(paidFile)) : [];

  const index = pending.findIndex(p => p.id === transactionId);
  if (index !== -1 && status === 'PAID') {
    const record = pending.splice(index, 1)[0];
    paid.push({ ...record, status: 'PAGADO', paid_at: new Date().toISOString() });
    fs.writeFileSync(paidFile, JSON.stringify(paid, null, 2));
    fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
  }
  res.json({ success: true });
});
module.exports = router;
