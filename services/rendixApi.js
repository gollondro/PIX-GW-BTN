const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let token = null;
let tokenExpiry = null;

// Modifica authenticate para aceptar credenciales personalizadas
async function authenticate({ renpix_email, renpix_password, userEmail } = {}) {
  console.log('🔐 Autenticando en Rendix...');
  let email = renpix_email;
  let password = renpix_password;

  // Si no se pasan credenciales, busca por userEmail en users.json
  if ((!email || !password) && userEmail) {
    const usersFile = path.join(__dirname, '../db/users.json');
    if (fs.existsSync(usersFile)) {
      const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      const user = users.find(u => u.email === userEmail);
      if (user && user.renpix_email && user.renpix_password) {
        email = user.renpix_email;
        password = user.renpix_password;
        console.log(`🔑 Usando credenciales de usuario: ${email}`);
      }
    }
  }

  // Si aún no hay credenciales, usa las de entorno
  if (!email || !password) {
    email = process.env.RENPIX_EMAIL;
    password = process.env.RENPIX_PASSWORD;
    console.log('🔑 Usando credenciales de entorno por defecto');
  }

  try {
    const res = await axios.post(`${process.env.RENPIX_API_URL}/login`, {
      email,
      password
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (res.data && res.data.data && res.data.data.token) {
      token = res.data.data.token;
      tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 horas
      console.log('✅ Token obtenido, válido hasta:', tokenExpiry);
      return token;
    } else {
      throw new Error('Formato de respuesta de autenticación inválido');
    }
  } catch (error) {
    console.error('❌ Error de autenticación:', error.message);
    throw error;
  }
}

// Verificar si el token es válido o está próximo a expirar
function isTokenValid() {
  if (!token || !tokenExpiry) return false;
  // Renovar si faltan menos de 30 minutos para expirar
  return tokenExpiry > new Date(Date.now() + 30 * 60 * 1000);
}

async function createPixChargeLink({ amountUSD, customer, controlNumber, operationCode = 1 }) {
  try {
    // Verificar si necesitamos obtener o renovar el token
    if (!isTokenValid()) {
      console.log('🔑 Token no disponible o próximo a expirar, obteniendo uno nuevo...');
      await authenticate();
    }

    console.log('💰 Generando solicitud de cobro para:', customer.name, 'Monto:', amountUSD, 'USD');
    console.log('🔑 Control Number:', controlNumber);
    console.log('🔑 Merchant ID:', process.env.RENPIX_MERCHANT_ID);
    
    // Verificar que tenemos una URL de webhook configurada
    if (!process.env.RENPIX_WEBHOOK) {
      console.warn('⚠️ ADVERTENCIA: No se ha configurado RENPIX_WEBHOOK en variables de entorno');
      console.warn('⚠️ Las notificaciones de pago no se recibirán correctamente');
    } else {
      console.log('📡 Webhook URL:', process.env.RENPIX_WEBHOOK);
    }

    // Asegurarse de que el monto es un número
    const purchase = parseFloat(amountUSD);
    if (isNaN(purchase) || purchase <= 0) {
      throw new Error(`Monto inválido: ${amountUSD}`);
    }

    // Construir el payload con operationCode recibido
    const payload = {
      merchantId: Number(process.env.RENPIX_MERCHANT_ID),
      purchase: purchase,
      cpf: customer.cpf,
      controlNumber: controlNumber,
      phone: customer.phone,
      email: customer.email,
      UrlWebhook: process.env.RENPIX_WEBHOOK || "http://localhost:3000/api/webhook",
      currencyCode: 'USD',
      operationCode: operationCode, // Usar operationCode recibido
      beneficiary: customer.name
    };

    console.log('📦 Payload completo:', JSON.stringify(payload));
    
    // Destacar el webhook en los logs
    console.log('📣 URL del webhook enviada:', payload.webhook);

    const res = await axios.post(`${process.env.RENPIX_API_URL}/sell`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 Respuesta API (status):', res.status);
    
    // Loguear las propiedades para debug
    if (res.data && res.data.data) {
      const responseData = res.data.data;
      console.log('📊 Propiedades de la respuesta:');
      Object.keys(responseData).forEach(key => {
        console.log(`  - ${key}: ${JSON.stringify(responseData[key])}`);
      });
      
      // Buscar específicamente propiedades relacionadas con taxRate o vetTax
      const taxRelatedKeys = Object.keys(responseData).filter(key => 
        key.toLowerCase().includes('tax') || 
        key.toLowerCase().includes('rate') || 
        key.toLowerCase().includes('vet')
      );
      
      if (taxRelatedKeys.length > 0) {
        console.log('💲 Propiedades relacionadas con impuestos encontradas:', taxRelatedKeys);
      } else {
        console.warn('⚠️ No se encontraron propiedades relacionadas con impuestos en la respuesta');
      }
    }

    if (!res.data || !res.data.data) {
      console.error('❌ Respuesta inválida de la API:', res.data);
      throw new Error('Formato de respuesta inválido');
    }

    console.log('✅ Cobro generado exitosamente');
    
    // Combinar la respuesta con el controlNumber original y añadir el webhook usado
    return {
      ...res.data.data,
      transactionId: controlNumber,
      controlNumber,
      webhookUrl: payload.webhook // Incluir la URL del webhook en la respuesta para referencia
    };
  } catch (error) {
    console.error('❌ Error al generar cobro PIX:', error.message);
    if (error.response) {
      console.error('Detalles respuesta:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // En caso de error de token expirado, intentar renovar token y reintentar
      if (error.response.status === 401) {
        console.log('🔄 Token expirado, renovando...');
        token = null;
        tokenExpiry = null;
        await authenticate();
        return createPixChargeLink({ amountUSD, customer, controlNumber });
      }
    } else if (error.request) {
      console.error('Error en la solicitud (no se recibió respuesta)');
    } else {
      console.error('Error en la configuración de la solicitud:', error.message);
    }
    
    throw error;
  }
}

// Nueva función para generar enlaces de pago vía API
async function createPaymentLink({ amountUSD, customer, controlNumber, description, operationCode = 1 }) {
  try {
    if (!isTokenValid()) {
      console.log('🔑 Token no disponible o próximo a expirar, obteniendo uno nuevo...');
      await authenticate();
    }

    console.log('🔗 Generando enlace de pago para:', customer.name, 'Monto:', amountUSD, 'USD');
    console.log('🔑 Control Number:', controlNumber);
    console.log('🔑 Merchant ID:', process.env.RENPIX_MERCHANT_ID);
    
    // Verificar que tenemos una URL de webhook configurada
    if (!process.env.RENPIX_WEBHOOK) {
      console.warn('⚠️ ADVERTENCIA: No se ha configurado RENPIX_WEBHOOK en variables de entorno');
      console.warn('⚠️ Las notificaciones de pago no se recibirán correctamente');
    } else {
      console.log('📡 Webhook URL:', process.env.RENPIX_WEBHOOK);
    }

    // Asegurarse de que el monto es un número
    const purchase = parseFloat(amountUSD);
    if (isNaN(purchase) || purchase <= 0) {
      throw new Error(`Monto inválido: ${amountUSD}`);
    }

    // Construir el payload para el enlace de pago con operationCode recibido
    const payload = {
      merchantId: Number(process.env.RENPIX_MERCHANT_ID),
      purchase: purchase,
      description: description || 'Pago PIX Internacional',
      controlNumber: controlNumber,
      email: customer.email,
      UrlWebhook: process.env.RENPIX_WEBHOOK || "http://localhost:3000/api/webhook",
      currencyCode: 'USD',
      operationCode: operationCode, // Usar operationCode recibido
      beneficiary: customer.name
    };

    console.log('📦 Payload para enlace:', JSON.stringify(payload));

    // Llamar al endpoint de enlace (v1/external/link según la documentación)
    const res = await axios.post(`${process.env.RENPIX_API_URL.replace('/v2/', '/v1/')}/link`, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔍 Respuesta API enlace (status):', res.status);
    
    if (!res.data || !res.data.success) {
      console.error('❌ Respuesta inválida de la API de enlace:', res.data);
      throw new Error('Formato de respuesta inválido al generar enlace');
    }

    console.log('✅ Enlace de pago generado exitosamente');
    
    // Retornar respuesta incluyendo el ID de venta de la API
    return {
      success: true,
      transactionId: controlNumber,
      id: res.data.data?.ID || controlNumber,
      UrlWebhook: payload.webhook,
      vetTax: 5.3 // Valor por defecto, ya que la API de enlace podría no devolverlo
    };
  } catch (error) {
    console.error('❌ Error al generar enlace de pago PIX:', error.message);
    
    if (error.response) {
      console.error('Detalles respuesta enlace:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
      
      // En caso de error de token expirado, intentar renovar token y reintentar
      if (error.response.status === 401) {
        console.log('🔄 Token expirado, renovando...');
        token = null;
        tokenExpiry = null;
        await authenticate();
        return createPaymentLink({ amountUSD, customer, controlNumber, description });
      }
    }
    
    throw error;
  }
}

module.exports = { authenticate, createPixChargeLink, createPaymentLink };