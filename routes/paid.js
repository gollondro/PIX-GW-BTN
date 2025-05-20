
const express = require('express');
const fs = require('fs');
const router = express.Router();

router.get('/', (req, res) => {
  const paid = fs.existsSync('./db/paid.json') ? JSON.parse(fs.readFileSync('./db/paid.json')) : [];
  res.json(paid);
});
module.exports = router;
