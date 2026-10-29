/* Camada de banco: usa Postgres quando DATABASE_URL existe (nuvem);
   caso contrário, usa SQLite local (chat.db) para rodar no seu computador. */
const path = require('path');

if (process.env.DATABASE_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    query_timeout: 10000,
    statement_timeout: 10000,
    max: 5
  });
  module.exports = {
    tipo: 'postgres',
    async iniciar() {
      await pool.query(`CREATE TABLE IF NOT EXISTS mensagens(
        id SERIAL PRIMARY KEY, autor TEXT NOT NULL, texto TEXT NOT NULL,
        criada_em TIMESTAMPTZ DEFAULT NOW())`);
    },
    async inserir(autor, texto) {
      await pool.query('INSERT INTO mensagens(autor, texto) VALUES ($1, $2)', [autor, texto]);
    },
    async listar() {
      const r = await pool.query(
        'SELECT autor, texto FROM (SELECT id, autor, texto FROM mensagens ORDER BY id DESC LIMIT 50) t ORDER BY id ASC');
      return r.rows;
    },
    async limpar() { return (await pool.query('DELETE FROM mensagens')).rowCount; },
    async fechar() { await pool.end(); }
  };
} else {
  const Database = require('better-sqlite3');
  const db = new Database(process.env.DB_PATH || path.join(__dirname, 'chat.db'));
  module.exports = {
    tipo: 'sqlite',
    async iniciar() {
      db.exec(`CREATE TABLE IF NOT EXISTS mensagens(
        id INTEGER PRIMARY KEY AUTOINCREMENT, autor TEXT NOT NULL, texto TEXT NOT NULL,
        criada_em DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    },
    async inserir(autor, texto) { db.prepare('INSERT INTO mensagens(autor, texto) VALUES (?, ?)').run(autor, texto); },
    async listar() {
      return db.prepare('SELECT autor, texto FROM (SELECT id, autor, texto FROM mensagens ORDER BY id DESC LIMIT 50) ORDER BY id ASC').all();
    },
    async limpar() { return db.prepare('DELETE FROM mensagens').run().changes; },
    async fechar() { db.close(); }
  };
}
