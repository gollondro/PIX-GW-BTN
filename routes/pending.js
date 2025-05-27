const express = require('express');
const router = express.Router();
const transactionRepository = require('../repositories/transactionRepository');

router.get('/', async (req, res) => {
  try {
    const pending = await transactionRepository.findPending();
    res.json(pending);
  } catch (error) {
    console.error('Error al obtener transacciones pendientes:', error);
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
});

module.exports = router;
