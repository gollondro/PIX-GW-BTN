const db = require('../services/database');
const fs = require('fs');
const path = require('path');

class UserRepository {
  constructor() {
    this.jsonFile = path.join(__dirname, '../db/users.json');
  }

  // Método principal: decide si usar DB o JSON
  async findAll() {
    if (db.isEnabled()) {
      return this.findAllFromDB();
    }
    return this.findAllFromJSON();
  }

  async findByEmail(email) {
    if (db.isEnabled()) {
      return this.findByEmailFromDB(email);
    }
    return this.findByEmailFromJSON(email);
  }

  async create(userData) {
    if (db.isEnabled()) {
      return this.createInDB(userData);
    }
    return this.createInJSON(userData);
  }

  async update(email, userData) {
    if (db.isEnabled()) {
      return this.updateInDB(email, userData);
    }
    return this.updateInJSON(email, userData);
  }

  async delete(email) {
    if (db.isEnabled()) {
      return this.deleteFromDB(email);
    }
    return this.deleteFromJSON(email);
  }

  // Métodos para PostgreSQL
  async findAllFromDB() {
    try {
      const result = await db.query('SELECT * FROM users ORDER BY created_at DESC');
      return result.rows.map(this.mapDBToJSON);
    } catch (error) {
      console.error('Error al obtener usuarios de DB:', error);
      throw error;
    }
  }

  async findByEmailFromDB(email) {
    try {
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      return result.rows[0] ? this.mapDBToJSON(result.rows[0]) : null;
    } catch (error) {
      console.error('Error al buscar usuario en DB:', error);
      throw error;
    }
  }

  async createInDB(userData) {
    try {
      const query = `
        INSERT INTO users (
          email, name, password, merchant_id, renpix_email, renpix_password,
          require_id_venta_tienda, allow_clp, allow_usd, default_currency,
          allow_qr, allow_link, operation_code
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      
      const values = [
        userData.email,
        userData.name || null,
        userData.password,
        userData.merchant_id,
        userData.renpix_email || null,
        userData.renpix_password || null,
        userData.requiereIdVentaTienda || userData.ventaTiendaActiva || false,
        userData.allowCLP !== false,
        userData.allowUSD === true,
        userData.defaultCurrency || 'CLP',
        userData.allowQR !== false,
        userData.allowLink === true,
        userData.operationCode || 1
      ];

      const result = await db.query(query, values);
      return this.mapDBToJSON(result.rows[0]);
    } catch (error) {
      console.error('Error al crear usuario en DB:', error);
      throw error;
    }
  }

  async updateInDB(email, userData) {
    try {
      const query = `
        UPDATE users SET
          name = $2,
          password = $3,
          merchant_id = $4,
          renpix_email = $5,
          renpix_password = $6,
          require_id_venta_tienda = $7,
          allow_clp = $8,
          allow_usd = $9,
          default_currency = $10,
          allow_qr = $11,
          allow_link = $12,
          operation_code = $13,
          updated_at = CURRENT_TIMESTAMP
        WHERE email = $1
        RETURNING *
      `;
      
      const values = [
        email,
        userData.name || null,
        userData.password,
        userData.merchant_id,
        userData.renpix_email || null,
        userData.renpix_password || null,
        userData.requiereIdVentaTienda || userData.ventaTiendaActiva || false,
        userData.allowCLP !== false,
        userData.allowUSD === true,
        userData.defaultCurrency || 'CLP',
        userData.allowQR !== false,
        userData.allowLink === true,
        userData.operationCode || 1
      ];

      const result = await db.query(query, values);
      return result.rows[0] ? this.mapDBToJSON(result.rows[0]) : null;
    } catch (error) {
      console.error('Error al actualizar usuario en DB:', error);
      throw error;
    }
  }

  async deleteFromDB(email) {
    try {
      await db.query('DELETE FROM users WHERE email = $1', [email]);
      return true;
    } catch (error) {
      console.error('Error al eliminar usuario de DB:', error);
      throw error;
    }
  }

  // Métodos para JSON (los actuales)
  findAllFromJSON() {
    if (fs.existsSync(this.jsonFile)) {
      return JSON.parse(fs.readFileSync(this.jsonFile, 'utf8'));
    }
    return [];
  }

  findByEmailFromJSON(email) {
    const users = this.findAllFromJSON();
    return users.find(u => u.email === email) || null;
  }

  createInJSON(userData) {
    const users = this.findAllFromJSON();
    users.push(userData);
    fs.writeFileSync(this.jsonFile, JSON.stringify(users, null, 2));
    return userData;
  }

  updateInJSON(email, userData) {
    const users = this.findAllFromJSON();
    const index = users.findIndex(u => u.email === email);
    if (index !== -1) {
      users[index] = { ...users[index], ...userData };
      fs.writeFileSync(this.jsonFile, JSON.stringify(users, null, 2));
      return users[index];
    }
    return null;
  }

  deleteFromJSON(email) {
    const users = this.findAllFromJSON();
    const filtered = users.filter(u => u.email !== email);
    fs.writeFileSync(this.jsonFile, JSON.stringify(filtered, null, 2));
    return true;
  }

  // Mapeo de DB a formato JSON
  mapDBToJSON(dbUser) {
    return {
      email: dbUser.email,
      name: dbUser.name,
      password: dbUser.password,
      merchant_id: dbUser.merchant_id,
      renpix_email: dbUser.renpix_email,
      renpix_password: dbUser.renpix_password,
      requiereIdVentaTienda: dbUser.require_id_venta_tienda,
      ventaTiendaActiva: dbUser.require_id_venta_tienda, // compatibilidad
      allowCLP: dbUser.allow_clp,
      allowUSD: dbUser.allow_usd,
      defaultCurrency: dbUser.default_currency,
      allowQR: dbUser.allow_qr,
      allowLink: dbUser.allow_link,
      operationCode: dbUser.operation_code
    };
  }
}

module.exports = new UserRepository();