// routes/exchangeRate.js
const express = require('express');
const router = express.Router();
const { 
  getExchangeRate, 
  forceRefreshRate, 
  getCacheInfo,
  getRateHistory 
} = require('../services/exchangeRateService');

// Obtener la tasa actual
router.get('/', async (req, res) => {
  try {
    const rate = await getExchangeRate();
    const cacheInfo = getCacheInfo();
    
    res.json({
      success: true,
      rate,
      cacheInfo: {
        isValid: cacheInfo.isValid,
        expiry: cacheInfo.expiry,
        timeRemaining: Math.round(cacheInfo.timeRemaining / 1000) + ' segundos'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al obtener tasa:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tasa de cambio',
      details: error.message
    });
  }
});

// Forzar actualización de la tasa
router.post('/refresh', async (req, res) => {
  try {
    const rate = await forceRefreshRate();
    
    res.json({
      success: true,
      rate,
      message: 'Tasa actualizada exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al actualizar tasa:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar tasa de cambio',
      details: error.message
    });
  }
});

// Obtener historial (nueva ruta)
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const history = await getRateHistory(days);
    
    res.json({
      success: true,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial',
      details: error.message
    });
  }
});

module.exports = router;