// services/exchangeRateService.js
const axios = require('axios');

// Cache para la tasa
let cachedRate = null;
let cacheExpiry = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache

/**
 * Obtiene la tasa de cambio CLP/USD desde la API externa
 * con sistema de cache para evitar llamadas excesivas
 */
async function getExchangeRate() {
  try {
    // Verificar si tenemos cache válido
    if (cachedRate && cacheExpiry && new Date() < cacheExpiry) {
      console.log('💵 Usando tasa de cambio en cache:', cachedRate);
      return cachedRate;
    }

    console.log('🔄 Obteniendo tasa de cambio desde API...');
    
    // Llamar a la API
    const response = await axios.get(
      'https://59a2paf39k.execute-api.us-east-1.amazonaws.com/PROD/CotizarTasaDolar',
      {
        timeout: 5000, // Timeout de 5 segundos
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PIX-Gateway/1.0'
        }
      }
    );

    // Parsear respuesta - ajustar según el formato real de la API
    let rate;

    if (typeof response.data === 'number') {
      rate = response.data;
    } else if (response.data && typeof response.data === 'object') {
      // Si la tasa viene en un string JSON dentro de body
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
      // Solo buscar en otras propiedades si rate aún no es válido
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

    // Log para depuración
    console.log('🔎 Tasa encontrada antes de validar:', rate, typeof rate);

    // Validar que obtuvimos un valor numérico válido
    if (rate === undefined || isNaN(rate) || rate <= 0) {
      console.warn('⚠️ Respuesta de API inválida:', response.data);
      throw new Error('Tasa de cambio inválida recibida de la API');
    }

    console.log('🔎 Tasa encontrada:', rate);

    // Guardar en cache
    cachedRate = parseFloat(rate);
    cacheExpiry = new Date(Date.now() + CACHE_DURATION);
    
    console.log('✅ Tasa de cambio obtenida:', cachedRate);
    console.log('📅 Cache válido hasta:', cacheExpiry.toLocaleString());
    
    return cachedRate;

  } catch (error) {
    console.error('❌ Error al obtener tasa de cambio:', error.message);
    
    // Si hay un error, usar el cache anterior si existe
    if (cachedRate) {
      console.log('⚠️ Usando última tasa conocida:', cachedRate);
      return cachedRate;
    }
    
    // Si no hay cache, lanzar error
    throw new Error('No hay tasa de cambio disponible');
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

module.exports = {
  getExchangeRate,
  forceRefreshRate,
  getCacheInfo
};