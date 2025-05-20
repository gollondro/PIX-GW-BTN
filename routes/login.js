
const express = require('express');
const fs = require('fs');
const router = express.Router();

router.post('/', (req, res) => {
  const { email, password } = req.body;
  const users = JSON.parse(fs.readFileSync('./db/users.json'));
  const user = users.find(u => u.email === email && u.password === password);
  if (user) {
    res.json({
      success: true,
      renpix_email: user.renpix_email,
      renpix_password: user.renpix_password,
      merchant_id: user.merchant_id,
      requiereIdVentaTienda: user.requiereIdVentaTienda
    });
  } else {
    res.json({ success: false });
  }
});
module.exports = router;
