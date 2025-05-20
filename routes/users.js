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
  const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
  res.json(users);
});

// Crear nuevo usuario
router.post('/', adminAuth, (req, res) => {
  const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
  users.push(req.body);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

// Editar usuario
router.put('/:id', adminAuth, (req, res) => {
  const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
  users[req.params.id] = req.body;
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

// Eliminar usuario
router.delete('/:id', adminAuth, (req, res) => {
  const users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE)) : [];
  users.splice(req.params.id, 1);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

module.exports = router;