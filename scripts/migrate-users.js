require('dotenv').config();
const db = require('../services/database');
const fs = require('fs');
const path = require('path');

async function migrateUsers() {
  if (!db.isEnabled()) {
    console.log('❌ USE_DATABASE no está habilitado. Configura USE_DATABASE=true en .env');
    process.exit(1);
  }

  console.log('🔄 Iniciando migración de usuarios...');
  const usersFile = path.join(__dirname, '../db/users.json');
  
  if (!fs.existsSync(usersFile)) {
    console.log('❌ Archivo users.json no encontrado');
    process.exit(1);
  }

  const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
  console.log(`📊 Se encontraron ${users.length} usuarios para migrar`);

  let migrated = 0;
  let errors = 0;

  for (const user of users) {
    try {
      const query = `
        INSERT INTO users (
          email, name, password, merchant_id, renpix_email, renpix_password,
          require_id_venta_tienda, allow_clp, allow_usd, default_currency,
          allow_qr, allow_link, operation_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (email) DO UPDATE SET
          name = EXCLUDED.name,
          password = EXCLUDED.password,
          merchant_id = EXCLUDED.merchant_id,
          renpix_email = EXCLUDED.renpix_email,
          renpix_password = EXCLUDED.renpix_password,
          require_id_venta_tienda = EXCLUDED.require_id_venta_tienda,
          allow_clp = EXCLUDED.allow_clp,
          allow_usd = EXCLUDED.allow_usd,
          default_currency = EXCLUDED.default_currency,
          allow_qr = EXCLUDED.allow_qr,
          allow_link = EXCLUDED.allow_link,
          operation_code = EXCLUDED.operation_code,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await db.query(query, [
        user.email,
        user.name || null,
        user.password,
        user.merchant_id,
        user.renpix_email || null,
        user.renpix_password || null,
        user.requiereIdVentaTienda || user.ventaTiendaActiva || false,
        user.allowCLP !== false,
        user.allowUSD === true,
        user.defaultCurrency || 'CLP',
        user.allowQR !== false,
        user.allowLink === true,
        user.operationCode || 1
      ]);
      
      migrated++;
      console.log(`✅ Usuario migrado: ${user.email}`);
    } catch (error) {
      errors++;
      console.error(`❌ Error migrando usuario ${user.email}:`, error.message);
    }
  }

  console.log('\n📊 Resumen de migración:');
  console.log(`✅ Usuarios migrados exitosamente: ${migrated}`);
  console.log(`❌ Errores: ${errors}`);
  
  await db.close();
  process.exit(errors > 0 ? 1 : 0);
}

// Ejecutar migración
migrateUsers().catch(error => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});