// services/exchangeRateService.js
const axios = require('axios');
const db = require('./database');

// Cache en memoria (mantener por compatibilidad)
let cachedRate = null;
let cacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Obtiene la tasa de cambio CLP/USD
 * Primero intenta desde la DB, luego desde la API
 */
async function getExchangeRate() {
  try {
    // Si la DB está habilitada, intentar obtener de ahí primero
    if (db.isEnabled()) {
      const dbRate = await getFromDatabase();
      if (dbRate) {
        console.log('💵 Usando tasa de cambio desde DB:', dbRate);
        return dbRate;
      }
    }

    // Si no hay en DB o no está habilitada, verificar cache en memoria
    if (cachedRate && cacheExpiry && new Date() < cacheExpiry) {
      console.log('💵 Usando tasa de cambio en cache memoria:', cachedRate);
      return cachedRate;
    }

    // Si no hay cache válido, obtener de la API
    console.log('🔄 Obteniendo tasa de cambio desde API...');
    
    const response = await axios.get(
      'https://59a2paf39k.execute-api.us-east-1.amazonaws.com/PROD/CotizarTasaDolar',
      {
        timeout: 5000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PIX-Gateway/1.0'
        }
      }
    );

    // Parsear respuesta
    let rate;
    if (typeof response.data === 'number') {
      rate = response.data;
    } else if (response.data && typeof response.data === 'object') {
      if (response.data.body && typeof response.data.body === 'string') {
        try {
          const bodyObj = JSON.parse(response.data.body);
          if (bodyObj && typeof bodyObj.tasa_dolar === 'number') {
            rate = bodyObj.tasa_dolar;
          } else if (bodyObj && typeof bodyObj.tasa_dolar === 'string' && !isNaN(Number(bodyObj.tasa_dolar))) {
            rate = Number(bodyObj.tasa_dolar);
          }
        } catch (e) {
          console.warn('⚠️ No se pudo parsear response.data.body:', response.data.body);
        }
      }
      if (rate === undefined) {
        rate = response.data.rate ?? 
               response.data.valor ?? 
               response.data.price ?? 
               response.data.tasa ?? 
               response.data.exchange_rate ??
               response.data.dolar ??
               response.data.clp_per_usd ??
               response.data.result;
      }
    }

    if (rate === undefined || isNaN(rate) || rate <= 0) {
      console.warn('⚠️ Respuesta de API inválida:', response.data);
      throw new Error('Tasa de cambio inválida recibida de la API');
    }

    const finalRate = parseFloat(rate);
    console.log('✅ Tasa de cambio obtenida:', finalRate);

    // Guardar en cache de memoria
    cachedRate = finalRate;
    cacheExpiry = new Date(Date.now() + CACHE_DURATION);
    
    // Guardar en DB si está habilitada
    if (db.isEnabled()) {
      await saveToDatabase(finalRate);
    }
    
    return finalRate;

  } catch (error) {
    console.error('❌ Error al obtener tasa de cambio:', error.message);
    
    // Si hay un error, usar el cache anterior si existe
    if (cachedRate) {
      console.log('⚠️ Usando última tasa conocida:', cachedRate);
      return cachedRate;
    }
    
    // Si no hay cache, buscar la última en DB
    if (db.isEnabled()) {
      const lastRate = await getLastFromDatabase();
      if (lastRate) {
        console.log('⚠️ Usando última tasa de DB:', lastRate);
        return lastRate;
      }
    }
    
    // Si no hay nada disponible, lanzar error
    throw new Error('No hay tasa de cambio disponible');
  }
}

/**
 * Obtener tasa desde la base de datos
 */
async function getFromDatabase() {
  try {
    const query = `
      SELECT rate 
      FROM exchange_rates 
      WHERE currency_pair = 'CLP/USD' 
        AND expires_at > NOW()
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query);
    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].rate);
    }
    return null;
  } catch (error) {
    console.error('Error al obtener tasa de DB:', error);
    return null;
  }
}

/**
 * Obtener última tasa de la DB (incluso expirada)
 */
async function getLastFromDatabase() {
  try {
    const query = `
      SELECT rate 
      FROM exchange_rates 
      WHERE currency_pair = 'CLP/USD'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    const result = await db.query(query);
    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].rate);
    }
    return null;
  } catch (error) {
    console.error('Error al obtener última tasa de DB:', error);
    return null;
  }
}

/**
 * Guardar tasa en la base de datos
 */
async function saveToDatabase(rate) {
  try {
    const query = `
      INSERT INTO exchange_rates (currency_pair, rate, source, expires_at)
      VALUES ($1, $2, $3, $4)
    `;
    
    const expiresAt = new Date(Date.now() + CACHE_DURATION);
    const values = ['CLP/USD', rate, 'API Externa', expiresAt];
    
    await db.query(query, values);
    console.log('💾 Tasa guardada en DB');
  } catch (error) {
    console.error('Error al guardar tasa en DB:', error);
  }
}

/**
 * Fuerza la actualización de la tasa ignorando el cache
 */
async function forceRefreshRate() {
  cachedRate = null;
  cacheExpiry = null;
  return await getExchangeRate();
}

/**
 * Obtiene información sobre el estado del cache
 */
function getCacheInfo() {
  return {
    rate: cachedRate,
    expiry: cacheExpiry,
    isValid: cachedRate && cacheExpiry && new Date() < cacheExpiry,
    timeRemaining: cacheExpiry ? Math.max(0, cacheExpiry - new Date()) : 0
  };
}

/**
 * Obtiene el historial de tasas (útil para el admin)
 */
async function getRateHistory(days = 7) {
  if (!db.isEnabled()) {
    return [];
  }

  try {
    const query = `
      SELECT currency_pair, rate, source, created_at, expires_at
      FROM exchange_rates
      WHERE currency_pair = 'CLP/USD'
        AND created_at > NOW() - INTERVAL '${days} days'
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return [];
  }
}

module.exports = {
  getExchangeRate,
  forceRefreshRate,
  getCacheInfo,
  getRateHistory
};