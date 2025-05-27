const express = require('express');
const router = express.Router();
const userRepository = require('../repositories/userRepository');

// Middleware auth básica para proteger /admin y /api/users
function adminAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const [type, credentials] = auth.split(' ');
  if (type !== 'Basic' || !credentials) return res.status(401).set('WWW-Authenticate', 'Basic').end('Auth required');
  const [user, pass] = Buffer.from(credentials, 'base64').toString().split(':');
  if (user === 'admin' && pass === 'admin') return next();
  res.status(403).end('Forbidden');
}

// Obtener todos los usuarios
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await userRepository.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ success: false, error: 'Error al cargar usuarios' });
  }
});

// Crear nuevo usuario
router.post('/', adminAuth, async (req, res) => {
  try {
    // Validaciones
    if (!req.body.email || !req.body.password || !req.body.merchant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios (email, password, merchant_id)' 
      });
    }
    if (req.body.allowCLP === false && req.body.allowUSD !== true) {
      return res.status(400).json({
        success: false,
        error: 'El usuario debe tener al menos una moneda habilitada'
      });
    }
    if (req.body.allowQR === false && req.body.allowLink !== true) {
      return res.status(400).json({
        success: false,
        error: 'El usuario debe tener al menos un método de pago habilitado'
      });
    }
    // Verificar si el email ya existe
    const existingUser = await userRepository.findByEmail(req.body.email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe un usuario con este email'
      });
    }
    await userRepository.create(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ success: false, error: 'Error al crear usuario' });
  }
});

// Actualizar usuario por índice (para mantener compatibilidad)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    // Validaciones
    if (!req.body.email || !req.body.password || !req.body.merchant_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Faltan campos obligatorios (email, password, merchant_id)' 
      });
    }
    // Para mantener compatibilidad con el admin actual que usa índices
    const users = await userRepository.findAll();
    const idx = parseInt(req.params.id);
    if (isNaN(idx) || idx < 0 || idx >= users.length) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    const targetEmail = users[idx].email;
    // Verificar duplicados de email (excepto el mismo usuario)
    if (req.body.email !== targetEmail) {
      const existingUser = await userRepository.findByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Ya existe otro usuario con este email'
        });
      }
    }
    await userRepository.update(targetEmail, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario por índice (para mantener compatibilidad)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const users = await userRepository.findAll();
    const idx = parseInt(req.params.id);
    if (isNaN(idx) || idx < 0 || idx >= users.length) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }
    const targetEmail = users[idx].email;
    await userRepository.delete(targetEmail);
    res.json({ success: true });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar usuario' });
  }
});

module.exports = router;