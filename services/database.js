const { Pool } = require('pg');

class Database {
  constructor() {
    this.pool = null;
    this.useDatabase = process.env.USE_DATABASE === 'true';
    
    if (this.useDatabase) {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'pix_gateway',
        user: process.env.DB_USER || 'pix_user',
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      });

      // Test connection
      this.pool.query('SELECT NOW()', (err, res) => {
        if (err) {
          console.error('❌ Error conectando a PostgreSQL:', err.message);
        } else {
          console.log('✅ Conectado a PostgreSQL:', res.rows[0].now);
        }
      });
    } else {
      console.log('📁 Usando archivos JSON (USE_DATABASE=false)');
    }
  }

  async query(text, params) {
    if (!this.useDatabase) {
      throw new Error('Database not enabled');
    }
    return this.pool.query(text, params);
  }

  isEnabled() {
    return process.env.USE_DATABASE === 'true';
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
    }
  }
}

module.exports = new Database();