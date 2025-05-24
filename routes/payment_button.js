const express = require('express');
const router = express.Router();
const { createPixChargeLink } = require('../services/rendixApi');

router.post('/', async (req, res) => {
  try {
    const { amountUSD, customer, userEmail, renpix_email, renpix_password } = req.body;

    // Llama a la función pasando las credenciales del usuario
    const pixCharge = await createPixChargeLink({
      amountUSD,
      customer,
      controlNumber: /* tu lógica para el controlNumber */,
      renpix_email,
      renpix_password,
      userEmail // opcional, si quieres buscar por email
    });

    // ...resto de la lógica y respuesta...
    res.json({
      success: true,
      pixCharge
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;