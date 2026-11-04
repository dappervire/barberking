const express = require('express');
const path = require('path');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET belum diisi di environment');
}

const pool = require('./src/db/pool');
const { startBookingCleanup } = require('./src/db/cleanup-bookings');

const app = express();

const PORT = process.env.PORT || 3000;

// Di belakang proxy hosting, rate limiter butuh ini buat tahu IP asli pengunjung.
// Vercel selalu lewat satu proxy, jadi di sana otomatis dipakai.
const trustProxyHops = process.env.TRUST_PROXY_HOPS || (process.env.VERCEL ? 1 : null);
if (trustProxyHops) {
    app.set('trust proxy', Number(trustProxyHops));
}

app.use(express.json());

// Di Vercel, isi public/ dilayani langsung oleh CDN dan baris ini diabaikan.
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

const servicesRouter = require('./src/routes/services');
app.use('/services', servicesRouter);

const bookingsRouter = require('./src/routes/bookings');
app.use('/bookings', bookingsRouter);

const authRouter = require('./src/routes/auth');
app.use('/auth', authRouter);

const cronRouter = require('./src/routes/cron');
app.use('/cron', cronRouter);

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan' });
});

app.use((err, req, res, next) =>{
    if (err.status >= 400 && err.status < 500) {
        return res.status(err.status).json({ error: 'Request tidak valid' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
});

// Dijalankan langsung (lokal): nyalain server sendiri. Di Vercel: app-nya yang diekspor.
if (require.main === module) {
    pool.query("SELECT NOW()", (err, result) => {
        if (err) {
            console.error('DB error:', err);
        } else {
            console.log('DB connected:', result.rows[0].now)
        }
    });

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        startBookingCleanup();
    });
}

module.exports = app;
