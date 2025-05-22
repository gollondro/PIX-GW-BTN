const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.post('/', (req, res) => {
  console.log('💾 Solicitud para guardar ID interno:', req.body);
  
  const { transactionId, idVentaTienda, userEmail } = req.body;
  
  // Validar datos de entrada
  if (!transactionId || !idVentaTienda) {
    console.error('❌ Faltan datos: transactionId o idVentaTienda');
    return res.status(400).json({ 
      success: false, 
      error: 'Se requiere transactionId e idVentaTienda' 
    });
  }

  const paidFile = path.join(__dirname, '../db/paid.json');
  const pendingFile = path.join(__dirname, '../db/pending.json');
  
  try {
    // Intentar actualizar en archivo de pagados primero
    if (fs.existsSync(paidFile)) {
      const paid = JSON.parse(fs.readFileSync(paidFile, 'utf8'));
      const match = paid.find(p => p.id === transactionId);
      
      if (match) {
        // Agregar el ID interno como un campo adicional, sin pisar datos existentes
        match.idVentaTienda = idVentaTienda;
        match.idVentaTienda_fecha = new Date().toISOString();
        match.idVentaTienda_usuario = userEmail || 'sistema';
        fs.writeFileSync(paidFile, JSON.stringify(paid, null, 2));
        console.log(`✅ ID interno agregado a transacción pagada: ${transactionId} -> ${idVentaTienda}`);
        return res.json({ success: true, message: 'ID interno guardado correctamente' });
      }
    }

    // Si no se encuentra en pagados, intentar en pendientes (por si acaso)
    if (fs.existsSync(pendingFile)) {
      const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
      const match = pending.find(p => p.id === transactionId);
      
      if (match) {
        // Agregar el ID interno como un campo adicional en pendientes también
        match.idVentaTienda = idVentaTienda;
        match.idVentaTienda_fecha = new Date().toISOString();
        match.idVentaTienda_usuario = userEmail || 'sistema';
        fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
        console.log(`✅ ID interno agregado a transacción pendiente: ${transactionId} -> ${idVentaTienda}`);
        return res.json({ success: true, message: 'ID interno guardado correctamente' });
      }
    }

    // Si no se encuentra en ningún archivo
    console.log(`⚠️ Transacción ${transactionId} no encontrada`);
    return res.status(404).json({ 
      success: false, 
      error: 'Transacción no encontrada' 
    });

  } catch (error) {
    console.error('❌ Error al guardar ID interno:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

module.exports = router;
