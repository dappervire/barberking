const pool = require('./pool');

const TABLES = ['services', 'customers', 'bookings', 'admin', 'rate_limits'];

// Aman dijalankan berkali-kali, dan cuma nambah yang belum ada. Data lama tetap utuh.
async function migrate() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS services (
              id SERIAL PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              price INTEGER NOT NULL,
              duration_minutes INTEGER NOT NULL
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
              id SERIAL PRIMARY KEY,
              name VARCHAR(100) NOT NULL,
              phone VARCHAR(20) UNIQUE NOT NULL,
              password VARCHAR(255) NOT NULL,
              created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bookings (
              id SERIAL PRIMARY KEY,
              customer_id INTEGER REFERENCES customers(id),
              customer_name VARCHAR(100) NOT NULL,
              customer_phone VARCHAR(20) NOT NULL,
              service_id INTEGER REFERENCES services(id),
              booking_date DATE NOT NULL,
              booking_time TIME NOT NULL,
              status VARCHAR(20) DEFAULT 'pending',
              created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        await pool.query('ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id)');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin (
              id SERIAL PRIMARY KEY,
              username VARCHAR(50) UNIQUE NOT NULL,
              password VARCHAR(255) NOT NULL
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rate_limits (
              key TEXT PRIMARY KEY,
              hits INTEGER NOT NULL,
              reset_at TIMESTAMPTZ NOT NULL
            )
        `);

        // Supabase ngebuka tabel di schema public lewat Data API. Aplikasi ini cuma konek langsung
        // ke database, jadi akses API ditutup total biar hash password dan nomor HP nggak bisa dibaca.
        for (const table of TABLES) {
            await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        }
        await pool.query(`
            DO $$
            DECLARE
              api_role TEXT;
            BEGIN
              FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
                  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
                  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
                END IF;
              END LOOP;
            END $$
        `);

        console.log('Migrasi selesai');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

migrate();
