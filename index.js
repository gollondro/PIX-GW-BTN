const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");

// Cargar dotenv primero
dotenv.config();

// Luego acceder a las variables de entorno
console.log('API URL:', process.env.RENPIX_API_URL);

const app = express();
app.use(bodyParser.json());

app.use("/api/login", require("./routes/login"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/webhook", require("./routes/webhook"));
app.use("/api/pending", require("./routes/pending"));
app.use("/api/paid", require("./routes/paid"));
app.use("/api/venta-tienda", require("./routes/ventaTienda"));
const paymentButtonRoute = require('./routes/payment_button');
app.use('/api/payment-button', paymentButtonRoute);
app.use('/admin', express.static(path.join(__dirname, 'public')));

// <-- Aquí pon el static general al final
app.use(express.static(path.join(__dirname, "public")));

app.get('/payment-window/:transactionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'payment_window_html.html'));
});

app.get('/visor_qr.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'visor_qr.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  
  const usersRoutes = require('./routes/users');
  app.use('/api/users', usersRoutes);
});