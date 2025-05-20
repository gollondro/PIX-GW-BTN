const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../db/users.json');

// Middleware auth básica para proteger /admin y /api/users
function adminAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const [type, credentials] = auth.split(' ');
  if (type !== 'Basic' || !credentials) return res.status(401).set('WWW-Authenticate', 'Basic').end('Auth required');
  const [user, pass] = Buffer.from(credentials, 'base64').toString().split(':');
  if (user === 'admin' && pass === 'admin') return next();
  res.status(403).end('Forbidden');
}

// Leer usuarios
router.get('/', adminAuth, (req, res) => {
  try {
    const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ success: false, error: 'Error al cargar usuarios' });
  }
});

// Crear nuevo usuario
router.post('/', adminAuth, (req, res) => {
  try {
    // Validar campos obligatorios
    if (!req.body.email || !req.body.password || !req.body.merchant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios (email, password, merchant_id)' 
      });
    }
    
    // Validar que al menos una moneda esté habilitada
    if (req.body.allowCLP === false && req.body.allowUSD !== true) {
      return res.status(400).json({
        success: false,
        error: 'El usuario debe tener al menos una moneda habilitada'
      });
    }
    
    // Validar que la moneda por defecto esté habilitada
    if (req.body.defaultCurrency === 'CLP' && req.body.allowCLP === false) {
      return res.status(400).json({
        success: false,
        error: 'No se puede establecer CLP como moneda por defecto si no está habilitada'
      });
    }
    
    if (req.body.defaultCurrency === 'USD' && req.body.allowUSD !== true) {
      return res.status(400).json({
        success: false,
        error: 'No se puede establecer USD como moneda por defecto si no está habilitada'
      });
    }
    
    const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
    
    // Verificar si el email ya existe
    if (users.some(u => u.email === req.body.email)) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un usuario con este email'
      });
    }
    
    users.push(req.body);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ success: false, error: 'Error al crear usuario' });
  }
});

// Editar usuario
router.put('/:id', adminAuth, (req, res) => {
  try {
    // Validar campos obligatorios
    if (!req.body.email || !req.body.password || !req.body.merchant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios (email, password, merchant_id)' 
      });
    }
    
    // Validar que al menos una moneda esté habilitada
    if (req.body.allowCLP === false && req.body.allowUSD !== true) {
      return res.status(400).json({
        success: false,
        error: 'El usuario debe tener al menos una moneda habilitada'
      });
    }
    
    // Validar que la moneda por defecto esté habilitada
    if (req.body.defaultCurrency === 'CLP' && req.body.allowCLP === false) {
      return res.status(400).json({
        success: false,
        error: 'No se puede establecer CLP como moneda por defecto si no está habilitada'
      });
    }
    
    if (req.body.defaultCurrency === 'USD' && req.body.allowUSD !== true) {
      return res.status(400).json({
        success: false,
        error: 'No se puede establecer USD como moneda por defecto si no está habilitada'
      });
    }
    
    const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
    const idx = parseInt(req.params.id);
    
    if (isNaN(idx) || idx < 0 || idx >= users.length) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    // Verificar duplicados de email (excepto el mismo usuario)
    if (users.some((u, i) => i !== idx && u.email === req.body.email)) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe otro usuario con este email'
      });
    }
    
    users[idx] = req.body;
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario
router.delete('/:id', adminAuth, (req, res) => {
  try {
    const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
    const idx = parseInt(req.params.id);
    
    if (isNaN(idx) || idx < 0 || idx >= users.length) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    
    users.splice(idx, 1);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
});

module.exports = router;