const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        // Connection pooler Supabase yang ngatur koneksi aslinya, jadi tiap instance cukup pegang sedikit.
        max: 3,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      }
);

// Tanpa handler ini, koneksi idle yang putus bakal bikin seluruh server crash.
pool.on('error', (err) => {
  console.error('DB pool error:', err.message);
});

module.exports = pool;
