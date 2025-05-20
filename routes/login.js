const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.post('/', (req, res) => {
  try {
    console.log('Recibida solicitud de login:', req.body);
    const { email, password } = req.body;
    
    // Validar datos de entrada
    if (!email || !password) {
      console.log('❌ Login fallido: datos incompletos');
      return res.status(400).json({ 
        success: false, 
        error: "Email y contraseña son requeridos" 
      });
    }
    
    // Leer archivo de usuarios
    const usersFile = path.join(__dirname, '../db/users.json');
    if (!fs.existsSync(usersFile)) {
      console.log('❌ Login fallido: archivo de usuarios no encontrado');
      return res.status(500).json({ 
        success: false, 
        error: "Error en la configuración del servidor" 
      });
    }
    
    console.log('Leyendo archivo de usuarios:', usersFile);
    const rawData = fs.readFileSync(usersFile, 'utf8');
    console.log('Contenido del archivo:', rawData.substring(0, 100) + '...');
    
    const users = JSON.parse(rawData);
    console.log(`Usuarios encontrados: ${users.length}`);
    
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
      console.log(`✅ Login exitoso para: ${email}`);
      
      // Mantener la estructura de respuesta compatible con la versión anterior
      // pero añadir los nuevos campos con valores por defecto
      const response = {
        success: true,
        email: user.email,
        renpix_email: user.renpix_email || process.env.RENPIX_EMAIL,
        renpix_password: user.renpix_password || process.env.RENPIX_PASSWORD,
        merchant_id: user.merchant_id || process.env.RENPIX_MERCHANT_ID,
        requiereIdVentaTienda: user.requiereIdVentaTienda || false
      };
      
      // Añadir nuevos campos solo si están presentes en el usuario
      if (user.name) response.userName = user.name;
      if (user.allowCLP !== undefined) response.allowCLP = user.allowCLP;
      if (user.allowUSD !== undefined) response.allowUSD = user.allowUSD;
      if (user.defaultCurrency) response.defaultCurrency = user.defaultCurrency;
      
      console.log('Respuesta de login:', response);
      res.json(response);
    } else {
      console.log(`❌ Login fallido para: ${email}`);
      res.json({ 
        success: false, 
        error: "Credenciales inválidas" 
      });
    }
  } catch (error) {
    console.error('❌ Error en login:', error);
    res.status(500).json({ 
      success: false, 
      error: "Error del servidor: " + error.message 
    });
  }
});

module.exports = router;