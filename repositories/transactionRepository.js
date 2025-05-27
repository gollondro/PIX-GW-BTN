const db = require('../services/database');
const fs = require('fs');
const path = require('path');

class TransactionRepository {
  constructor() {
    this.pendingFile = path.join(__dirname, '../db/pending.json');
    this.paidFile = path.join(__dirname, '../db/paid.json');
  }

  // Obtener todas las transacciones pendientes
  async findPending() {
    if (db.isEnabled()) {
      return this.findByStatusFromDB('PENDIENTE');
    }
    return this.findPendingFromJSON();
  }

  // Obtener todas las transacciones pagadas
  async findPaid() {
    if (db.isEnabled()) {
      return this.findByStatusFromDB('PAGADO');
    }
    return this.findPaidFromJSON();
  }

  // Buscar transacción por ID
  async findById(transactionId) {
    if (db.isEnabled()) {
      return this.findByIdFromDB(transactionId);
    }
    return this.findByIdFromJSON(transactionId);
  }

  // Crear nueva transacción
  async create(transactionData) {
    console.log('USE_DATABASE:', process.env.USE_DATABASE, 'db.isEnabled():', db.isEnabled());
    if (db.isEnabled()) {
      console.log('🟢 db.isEnabled()=true, usando createInDB');
      return this.createInDB(transactionData);
    }
    console.log('🟡 db.isEnabled()=false, usando createInJSON');
    return this.createInJSON(transactionData);
  }

  // Actualizar estado a pagado
  async markAsPaid(transactionId, webhookData = null) {
    if (db.isEnabled()) {
      return this.markAsPaidInDB(transactionId, webhookData);
    }
    return this.markAsPaidInJSON(transactionId, webhookData);
  }

  // Agregar ID de venta tienda
  async addIdVentaTienda(transactionId, idVentaTienda, userEmail) {
    if (db.isEnabled()) {
      return this.addIdVentaTiendaInDB(transactionId, idVentaTienda, userEmail);
    }
    return this.addIdVentaTiendaInJSON(transactionId, idVentaTienda, userEmail);
  }

  // ===== MÉTODOS PARA POSTGRESQL =====

  async findByStatusFromDB(status) {
    try {
      const query = `
        SELECT * FROM transactions 
        WHERE status = $1 
        ORDER BY created_at DESC
      `;
      const result = await db.query(query, [status]);
      return result.rows.map(this.mapDBToJSON);
    } catch (error) {
      console.error(`Error al obtener transacciones ${status} de DB:`, error);
      throw error;
    }
  }

  async findByIdFromDB(transactionId) {
    try {
      const query = 'SELECT * FROM transactions WHERE transaction_id = $1';
      const result = await db.query(query, [transactionId]);
      return result.rows[0] ? this.mapDBToJSON(result.rows[0]) : null;
    } catch (error) {
      console.error('Error al buscar transacción en DB:', error);
      throw error;
    }
  }

  async createInDB(data) {
    try {
      const query = `
        INSERT INTO transactions (
          transaction_id, user_email, name, email, phone, cpf,
          amount_clp, amount_usd, amount_brl, status, original_currency,
          payment_method, url_webhook, rate_clp_per_usd, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
      
      const values = [
        data.id || data.transactionId,
        data.userEmail,
        data.name,
        data.email,
        data.phone,
        data.cpf,
        data.amountCLP,
        data.amountUSD,
        data.amountBRL,
        data.status || 'PENDIENTE',
        data.originalCurrency,
        data.paymentMethod,
        data.UrlWebhook || data.urlWebhook,
        data.rateCLPperUSD,
        data.date || new Date()
      ];

      const result = await db.query(query, values);
      console.log('✅ Transacción insertada en DB:', result.rows[0]); // <-- LOG DE INSERCIÓN
      return this.mapDBToJSON(result.rows[0]);
    } catch (error) {
      console.error('Error al crear transacción en DB:', error);
      throw error;
    }
  }

  async markAsPaidInDB(transactionId, webhookData) {
    try {
      const query = `
        UPDATE transactions 
        SET status = 'PAGADO',
            paid_at = CURRENT_TIMESTAMP,
            webhook_data = $2
        WHERE transaction_id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [transactionId, webhookData]);
      return result.rows[0] ? this.mapDBToJSON(result.rows[0]) : null;
    } catch (error) {
      console.error('Error al marcar como pagada en DB:', error);
      throw error;
    }
  }

  async addIdVentaTiendaInDB(transactionId, idVentaTienda, userEmail) {
    try {
      const query = `
        UPDATE transactions 
        SET id_venta_tienda = $2,
            id_venta_tienda_fecha = CURRENT_TIMESTAMP,
            id_venta_tienda_usuario = $3
        WHERE transaction_id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [transactionId, idVentaTienda, userEmail]);
      return result.rows[0] ? this.mapDBToJSON(result.rows[0]) : null;
    } catch (error) {
      console.error('Error al agregar ID venta tienda en DB:', error);
      throw error;
    }
  }

  // ===== MÉTODOS PARA JSON (compatibilidad) =====

  findPendingFromJSON() {
    if (fs.existsSync(this.pendingFile)) {
      return JSON.parse(fs.readFileSync(this.pendingFile, 'utf8'));
    }
    return [];
  }

  findPaidFromJSON() {
    if (fs.existsSync(this.paidFile)) {
      return JSON.parse(fs.readFileSync(this.paidFile, 'utf8'));
    }
    return [];
  }

  findByIdFromJSON(transactionId) {
    // Buscar en pending
    const pending = this.findPendingFromJSON();
    let transaction = pending.find(t => t.id === transactionId);
    if (transaction) {
      transaction.status = 'PENDIENTE';
      return transaction;
    }

    // Buscar en paid
    const paid = this.findPaidFromJSON();
    transaction = paid.find(t => t.id === transactionId);
    if (transaction) {
      transaction.status = 'PAGADO';
      return transaction;
    }

    return null;
  }

  createInJSON(data) {
    const pending = this.findPendingFromJSON();
    const newTransaction = {
      ...data,
      id: data.id || data.transactionId,
      date: data.date || new Date().toISOString(),
      status: 'PENDIENTE'
    };
    pending.push(newTransaction);
    fs.writeFileSync(this.pendingFile, JSON.stringify(pending, null, 2));
    return newTransaction;
  }

  markAsPaidInJSON(transactionId, webhookData) {
    // Buscar en pending
    let pending = this.findPendingFromJSON();
    const index = pending.findIndex(t => t.id === transactionId);
    
    if (index !== -1) {
      // Mover de pending a paid
      const transaction = pending.splice(index, 1)[0];
      transaction.status = 'PAGADO';
      transaction.paid_at = new Date().toISOString();
      if (webhookData) transaction.webhook_data = webhookData;

      // Actualizar archivos
      fs.writeFileSync(this.pendingFile, JSON.stringify(pending, null, 2));
      
      const paid = this.findPaidFromJSON();
      paid.push(transaction);
      fs.writeFileSync(this.paidFile, JSON.stringify(paid, null, 2));
      
      return transaction;
    }
    
    return null;
  }

  addIdVentaTiendaInJSON(transactionId, idVentaTienda, userEmail) {
    // Buscar en ambos archivos
    let updated = false;
    
    // Buscar en paid
    const paid = this.findPaidFromJSON();
    const paidIndex = paid.findIndex(t => t.id === transactionId);
    if (paidIndex !== -1) {
      paid[paidIndex].idVentaTienda = idVentaTienda;
      paid[paidIndex].idVentaTienda_fecha = new Date().toISOString();
      paid[paidIndex].idVentaTienda_usuario = userEmail;
      fs.writeFileSync(this.paidFile, JSON.stringify(paid, null, 2));
      return paid[paidIndex];
    }

    // Buscar en pending
    const pending = this.findPendingFromJSON();
    const pendingIndex = pending.findIndex(t => t.id === transactionId);
    if (pendingIndex !== -1) {
      pending[pendingIndex].idVentaTienda = idVentaTienda;
      pending[pendingIndex].idVentaTienda_fecha = new Date().toISOString();
      pending[pendingIndex].idVentaTienda_usuario = userEmail;
      fs.writeFileSync(this.pendingFile, JSON.stringify(pending, null, 2));
      return pending[pendingIndex];
    }

    return null;
  }

  // ===== MAPEO =====

  mapDBToJSON(row) {
    if (!row) return null;
    
    return {
      id: row.transaction_id,
      transactionId: row.transaction_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      cpf: row.cpf,
      amountCLP: row.amount_clp,
      amountUSD: row.amount_usd,
      amountBRL: row.amount_brl,
      date: row.created_at,
      status: row.status,
      originalCurrency: row.original_currency,
      paymentMethod: row.payment_method,
      UrlWebhook: row.url_webhook,
      urlWebhook: row.url_webhook, // compatibilidad
      userEmail: row.user_email,
      rateCLPperUSD: row.rate_clp_per_usd,
      paid_at: row.paid_at,
      webhook_data: row.webhook_data,
      idVentaTienda: row.id_venta_tienda,
      idVentaTienda_fecha: row.id_venta_tienda_fecha,
      idVentaTienda_usuario: row.id_venta_tienda_usuario
    };
  }
}

module.exports = new TransactionRepository();