const fs = require('fs').promises;
const path = require('path');
const db = require('../services/database');

class ExternalTransactionRepository {
  async create(transactionData) {
    console.log('🔍 ExternalTransactionRepository.create - USE_DATABASE:', process.env.USE_DATABASE);
    console.log('🔍 ExternalTransactionRepository.create - db.isEnabled():', db.isEnabled());
    
    if (db.isEnabled()) {
      console.log('🟢 Usando PostgreSQL para external transactions');
      return this.createInDB(transactionData);
    }
    console.log('🟡 Usando JSON para external transactions');
    return this.createInJSON(transactionData);
  }

  async createInDB(data) {
    try {
      const query = `
        INSERT INTO external_transactions (
          internal_id, user_email, amount_usd, amount_brl, usd_to_brl_rate,
          vet_tax, price_national_currency, expires_at, status,
          customer_name, customer_email, customer_phone, customer_cpf,
          qr_pix_copy_past, webhook_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

      const values = [
        data.internalId,
        data.userEmail,
        data.amountUSD,
        data.amountBRL,
        data.usdToBrlRate,
        data.vetTax,
        data.priceNationalCurrency,
        data.expiresAt,
        data.status || 'PENDIENTE',
        data.customer?.name,
        data.customer?.email,
        data.customer?.phone,
        data.customer?.cpf,
        data.qrData?.pixCopyPast,
        JSON.stringify(data)
      ];

      const result = await db.query(query, values);
      console.log('✅ Transacción externa insertada en PostgreSQL:', result.rows[0].internal_id);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error al crear transacción externa en DB:', error);
      throw error;
    }
  }

  async createInJSON(data) {
    try {
      const filePath = path.join(__dirname, '../db/external_transactions.json');
      let transactions = [];
      
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        transactions = JSON.parse(fileContent);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      const newTransaction = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString()
      };

      transactions.push(newTransaction);
      await fs.writeFile(filePath, JSON.stringify(transactions, null, 2));
      console.log('✅ Transacción externa guardada en JSON');
      return newTransaction;
    } catch (error) {
      console.error('❌ Error al crear transacción externa en JSON:', error);
      throw error;
    }
  }

  async findByInternalId(internalId) {
    if (db.isEnabled()) {
      return this.findByInternalIdFromDB(internalId);
    }
    return this.findByInternalIdFromJSON(internalId);
  }

  async findByInternalIdFromDB(internalId) {
    try {
      const query = 'SELECT * FROM external_transactions WHERE internal_id = $1';
      const result = await db.query(query, [internalId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapDBToJSON(result.rows[0]);
    } catch (error) {
      console.error('Error al buscar transacción externa en DB:', error);
      return null;
    }
  }

  async findByInternalIdFromJSON(internalId) {
    try {
      const filePath = path.join(__dirname, '../db/external_transactions.json');
      const fileContent = await fs.readFile(filePath, 'utf8');
      const transactions = JSON.parse(fileContent);
      return transactions.find(t => t.internalId === internalId) || null;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error('Error al buscar transacción externa en JSON:', error);
      return null;
    }
  }

  async isTransactionIdUnique(transactionId) {
    if (db.isEnabled()) {
      return this.isTransactionIdUniqueFromDB(transactionId);
    }
    return this.isTransactionIdUniqueFromJSON(transactionId);
  }

  async isTransactionIdUniqueFromDB(transactionId) {
    try {
      const query = 'SELECT COUNT(*) FROM external_transactions WHERE internal_id = $1';
      const result = await db.query(query, [transactionId]);
      return parseInt(result.rows[0].count) === 0;
    } catch (error) {
      console.error('Error verificando unicidad en DB:', error);
      return false;
    }
  }

  async isTransactionIdUniqueFromJSON(transactionId) {
    try {
      const filePath = path.join(__dirname, '../db/external_transactions.json');
      const fileContent = await fs.readFile(filePath, 'utf8');
      const transactions = JSON.parse(fileContent);
      return !transactions.some(t => t.internalId === transactionId);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return true;
      }
      console.error('Error verificando unicidad en JSON:', error);
      return false;
    }
  }

  async updateStatus(internalId, status, webhookData) {
    console.log('🔄 Actualizando status de transacción externa:', { internalId, status });
    
    if (this.isDBEnabled()) {
      return this.updateStatusInDB(internalId, status, webhookData);
    }
    return this.updateStatusInJSON(internalId, status, webhookData);
  }

  async updateStatusInDB(internalId, status, webhookData) {
    if (!this.isDBEnabled()) {
      throw new Error('Database not available');
    }

    try {
      const query = `
        UPDATE external_transactions 
        SET status = $1, webhook_data = $2, updated_at = CURRENT_TIMESTAMP
        WHERE internal_id = $3
        RETURNING *
      `;
      
      const result = await db.query(query, [status, JSON.stringify(webhookData), internalId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      console.log('✅ Status actualizado en PostgreSQL:', result.rows[0].internal_id);
      return this.mapDBToJSON(result.rows[0]);
    } catch (error) {
      console.error('❌ Error al actualizar status en DB:', error);
      throw error;
    }
  }

  async updateStatusInJSON(internalId, status, webhookData) {
    try {
      const filePath = path.join(__dirname, '../db/external_transactions.json');
      let transactions = [];
      
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        transactions = JSON.parse(fileContent);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      const transactionIndex = transactions.findIndex(t => t.internalId === internalId);
      
      if (transactionIndex === -1) {
        return null;
      }

      transactions[transactionIndex].status = status;
      transactions[transactionIndex].webhookData = webhookData;
      transactions[transactionIndex].updatedAt = new Date().toISOString();
      
      await fs.writeFile(filePath, JSON.stringify(transactions, null, 2));
      console.log('✅ Status actualizado en JSON:', internalId);
      return transactions[transactionIndex];
    } catch (error) {
      console.error('❌ Error al actualizar status en JSON:', error);
      throw error;
    }
  }

  mapDBToJSON(row) {
    return {
      internalId: row.internal_id,
      userEmail: row.user_email,
      amountUSD: parseFloat(row.amount_usd),
      amountBRL: parseFloat(row.amount_brl),
      usdToBrlRate: parseFloat(row.usd_to_brl_rate),
      vetTax: parseFloat(row.vet_tax),
      priceNationalCurrency: parseFloat(row.price_national_currency),
      expiresAt: row.expires_at,
      status: row.status,
      customer: {
        name: row.customer_name,
        email: row.customer_email,
        phone: row.customer_phone,
        cpf: row.customer_cpf
      },
      qrData: {
        pixCopyPast: row.qr_pix_copy_paste
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = new ExternalTransactionRepository();