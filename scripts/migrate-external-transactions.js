require('dotenv').config();
const db = require('../services/database');
const fs = require('fs');
const path = require('path');

async function migrateExternalTransactions() {
  if (!db.isEnabled()) {
    console.log('❌ USE_DATABASE no está habilitado. Configura USE_DATABASE=true en .env');
    process.exit(1);
  }

  console.log('🔄 Iniciando migración de transacciones externas...');
  
  const externalFile = path.join(__dirname, '../db/external_transactions.json');
  
  if (!fs.existsSync(externalFile)) {
    console.log('❌ Archivo external_transactions.json no encontrado');
    process.exit(1);
  }

  const transactions = JSON.parse(fs.readFileSync(externalFile, 'utf8'));
  console.log(`📊 Se encontraron ${transactions.length} transacciones externas para migrar`);

  let migrated = 0;
  let errors = 0;

  for (const tx of transactions) {
    try {
      const query = `
        INSERT INTO external_transactions (
          internal_id, user_email, transaction_id, amount_usd, amount_brl,
          usd_to_brl_rate, vet_tax, price_national_currency, status, expires_at,
          created_at, paid_at, customer_name, customer_email, customer_phone, 
          customer_cpf, qr_pix_copy_past, qr_expires_at, webhook_data, 
          webhook_url, operation_code, merchant_id, control_number
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT (internal_id) DO UPDATE SET
          status = EXCLUDED.status,
          paid_at = EXCLUDED.paid_at,
          webhook_data = EXCLUDED.webhook_data,
          amount_brl = EXCLUDED.amount_brl,
          usd_to_brl_rate = EXCLUDED.usd_to_brl_rate
      `;
      
      const values = [
        tx.internalId,
        tx.userEmail,
        tx.transactionId || null,
        parseFloat(tx.amountUSD),
        tx.amountBRL ? parseFloat(tx.amountBRL) : (tx.priceNationalCurrency ? parseFloat(tx.priceNationalCurrency) : null),
        tx.usdToBrlRate ? parseFloat(tx.usdToBrlRate) : (tx.vetTax ? parseFloat(tx.vetTax) : null),
        tx.vetTax ? parseFloat(tx.vetTax) : null,
        tx.priceNationalCurrency ? parseFloat(tx.priceNationalCurrency) : null,
        tx.status || 'PENDIENTE',
        tx.expiresAt || null,
        tx.createdAt || new Date().toISOString(),
        tx.paidAt || tx.paid_at || null,
        tx.customer?.name || null,
        tx.customer?.email || null,
        tx.customer?.phone || null,
        tx.customer?.cpf || null,
        tx.qrData?.pixCopyPast || null,
        tx.qrData?.expiresAt || tx.expiresAt || null,
        tx.webhookData || tx.webhook_data || null,
        tx.webhookUrl || null,
        tx.operationCode || 1,
        tx.merchantId || null,
        tx.controlNumber || null
      ];

      await db.query(query, values);
      migrated++;
      console.log(`✅ Transacción externa migrada: ${tx.internalId} - ${tx.userEmail} ($${tx.amountUSD})`);
    } catch (error) {
      errors++;
      console.error(`❌ Error migrando transacción externa ${tx.internalId}:`, error.message);
    }
  }

  console.log('\n📊 Resumen de migración de transacciones externas:');
  console.log(`✅ Transacciones migradas exitosamente: ${migrated}`);
  console.log(`❌ Errores: ${errors}`);
  
  await db.close();
  process.exit(errors > 0 ? 1 : 0);
}

// Ejecutar migración
migrateExternalTransactions().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});