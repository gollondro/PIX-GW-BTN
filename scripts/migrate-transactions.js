require('dotenv').config();
const db = require('../services/database');
const fs = require('fs');
const path = require('path');

async function migrateTransactions() {
  if (!db.isEnabled()) {
    console.log('❌ USE_DATABASE no está habilitado. Configura USE_DATABASE=true en .env');
    process.exit(1);
  }

  console.log('🔄 Iniciando migración de transacciones...');
  
  let migrated = 0;
  let errors = 0;

  // Migrar transacciones pendientes
  const pendingFile = path.join(__dirname, '../db/pending.json');
  if (fs.existsSync(pendingFile)) {
    const pending = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    console.log(`📊 Encontradas ${pending.length} transacciones pendientes`);
    
    for (const tx of pending) {
      const result = await migrateTransaction(tx, 'PENDIENTE');
      if (result) migrated++; else errors++;
    }
  }

  // Migrar transacciones pagadas
  const paidFile = path.join(__dirname, '../db/paid.json');
  if (fs.existsSync(paidFile)) {
    const paid = JSON.parse(fs.readFileSync(paidFile, 'utf8'));
    console.log(`📊 Encontradas ${paid.length} transacciones pagadas`);
    
    for (const tx of paid) {
      const result = await migrateTransaction(tx, 'PAGADO');
      if (result) migrated++; else errors++;
    }
  }

  console.log('\n📊 Resumen de migración:');
  console.log(`✅ Transacciones migradas: ${migrated}`);
  console.log(`❌ Errores: ${errors}`);
  
  await db.close();
  process.exit(errors > 0 ? 1 : 0);
}

async function migrateTransaction(tx, status) {
  try {
    const query = `
      INSERT INTO transactions (
        transaction_id, user_email, name, email, phone, cpf,
        amount_clp, amount_usd, amount_brl, status, original_currency,
        payment_method, url_webhook, rate_clp_per_usd, created_at, paid_at,
        webhook_data, id_venta_tienda, id_venta_tienda_fecha, id_venta_tienda_usuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (transaction_id) DO UPDATE SET
        status = EXCLUDED.status,
        paid_at = EXCLUDED.paid_at,
        webhook_data = EXCLUDED.webhook_data,
        id_venta_tienda = EXCLUDED.id_venta_tienda
    `;
    
    const values = [
      tx.id || tx.transactionId,
      tx.userEmail || null,
      tx.name,
      tx.email,
      tx.phone,
      tx.cpf,
      parseFloat(tx.amountCLP) || null,
      parseFloat(tx.amountUSD) || null,
      parseFloat(tx.amountBRL) || null,
      status,
      tx.originalCurrency || (tx.currency === 'USD' ? 'USD' : 'CLP'),
      tx.paymentMethod || 'qr',
      tx.UrlWebhook || tx.urlWebhook || null,
      parseFloat(tx.rateCLPperUSD) || null,
      tx.date || tx.created_at,
      tx.paid_at || null,
      tx.webhook_data || null,
      tx.idVentaTienda || null,
      tx.idVentaTienda_fecha || null,
      tx.idVentaTienda_usuario || null
    ];

    await db.query(query, values);
    console.log(`✅ Migrada: ${tx.id} - ${tx.name} (${status})`);
    return true;
  } catch (error) {
    console.error(`❌ Error migrando ${tx.id}:`, error.message);
    return false;
  }
}

migrateTransactions();