
const express = require('express');
const fs = require('fs');
const router = express.Router();

router.get('/', (req, res) => {
  const pending = fs.existsSync('./db/pending.json') ? JSON.parse(fs.readFileSync('./db/pending.json')) : [];
  res.json(pending);
});
module.exports = router;
