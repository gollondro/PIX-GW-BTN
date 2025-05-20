const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.post('/', (req, res) => {
  try {
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
    
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const user = users.find(u => u.email === email && u.password === password);
    
    if (user) {
      console.log(`✅ Login exitoso para: ${email}`);
      res.json({
        success: true,
        email: user.email,
        userName: user.name || user.email, // Nombre para mostrar
        renpix_email: user.renpix_email || process.env.RENPIX_EMAIL,
        renpix_password: user.renpix_password || process.env.RENPIX_PASSWORD,
        merchant_id: user.merchant_id || process.env.RENPIX_MERCHANT_ID,
        requiereIdVentaTienda: user.requiereIdVentaTienda || false,
        // Estos son los nuevos campos para control de moneda
        allowCLP: user.allowCLP !== false, // Por defecto permitido
        allowUSD: user.allowUSD === true, // Por defecto no permitido
        defaultCurrency: user.defaultCurrency || 'CLP' // Moneda por defecto
      });
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
      error: "Error del servidor" 
    });
  }
});

module.exports = router;