const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { createPixChargeLink } = require('../services/rendixApi');

router.post('/', async (req, res) => {
  try {
    const { amountUSD, customer, userEmail, renpix_email, renpix_password } = req.body;

    // Obtener operationCode del usuario
    let operationCode = 1; // Valor por defecto
    let user = null;
    const usersFile = path.join(__dirname, '../db/users.json');
    if (fs.existsSync(usersFile) && userEmail) {
      try {
        const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        user = users.find(u => u.email === userEmail);
        if (user && user.operationCode) {
          operationCode = user.operationCode;
        }
      } catch (e) {
        console.warn('No se pudo leer operationCode del usuario, usando valor por defecto');
      }
    }

    // Construir el payload para createPixChargeLink
    const controlNumber = /* tu lógica para el controlNumber */;
    const payload = {
      amountUSD,
      customer,
      controlNumber,
      renpix_email,
      renpix_password,
      userEmail,
      operationCode: operationCode // Usar el operationCode del usuario
    };

    // Llama a la función pasando el payload
    const pixCharge = await createPixChargeLink(payload);

    res.json({
      success: true,
      pixCharge
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

let pendingTransactions = [];
const pendingFile = path.join(__dirname, '../db/pending.json');
if (fs.existsSync(pendingFile)) {
  try {
    pendingTransactions = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
  } catch (e) {
    console.error('❌ Error al leer el archivo de transacciones pendientes:', e);
    // Opcional: Renombra el archivo corrupto para no perderlo
    fs.renameSync(pendingFile, pendingFile + '.bak');
    pendingTransactions = [];
  }
}

fs.writeFileSync(pendingFile, JSON.stringify(pendingTransactions, null, 2));

module.exports = router;