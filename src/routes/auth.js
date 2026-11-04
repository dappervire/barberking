const express = require ('express');
const router = express.Router();
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db/pool.js')
const rateLimit = require('express-rate-limit')
const PostgresRateLimitStore = require('../utils/postgres-rate-limit-store')

const PASSWORD_MIN_LENGTH = 8;
const BCRYPT_MAX_BYTES = 72;
const POSTGRES_UNIQUE_VIOLATION = '23505';

const loginLimiter = rateLimit({
    store: new PostgresRateLimitStore('admin-login'),
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Terlalu banyak percobaan login, coba lagi 15 menit lagi' }
});

// Dibikin terpisah dari admin biar percobaan login pelanggan nggak ngeblok login admin.
const customerLoginLimiter = rateLimit({
    store: new PostgresRateLimitStore('customer-login'),
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Terlalu banyak percobaan login, coba lagi 15 menit lagi' }
});

const registerLimiter = rateLimit({
    store: new PostgresRateLimitStore('customer-register'),
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: { error: 'Terlalu banyak pendaftaran, coba lagi nanti' }
});

// Username yang nggak ada tetap lewat bcrypt, biar waktunya nggak ngasih tahu akun mana yang valid.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-password', 10);

function signCustomerToken(customer) {
    return jwt.sign({ id: customer.id, role: 'customer' }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/login', loginLimiter, async (req, res, next) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        return res.status(400).json({ error: 'Username dan password wajib diisi'});
    }
    try {
        const result = await pool.query('SELECT * FROM admin WHERE username = $1', [username]);
        const admin = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, admin ? admin.password : DUMMY_PASSWORD_HASH);
        if (!admin || !passwordMatches){
            return res.status(401).json({ error: 'Username atau password salah' });
        }
        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        res.json({ token });
    } catch (err) {
        next(err);
    }
})

router.post('/customer/register', registerLimiter, async (req, res, next) => {
    const { name, phone, password } = req.body ?? {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (trimmedName.length < 1 || trimmedName.length > 100) {
        return res.status(400).json({ error: 'Nama wajib diisi, maksimal 100 karakter' });
    }
    if (typeof phone !== 'string' || !/^\d{10,15}$/.test(phone)) {
        return res.status(400).json({ error: 'Nomor HP harus 10-15 digit angka' });
    }
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        return res.status(400).json({ error: `Password minimal ${PASSWORD_MIN_LENGTH} karakter` });
    }
    if (Buffer.byteLength(password) > BCRYPT_MAX_BYTES) {
        return res.status(400).json({ error: 'Password terlalu panjang' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO customers (name, phone, password) VALUES ($1, $2, $3) RETURNING id, name',
            [trimmedName, phone, hashedPassword]
        );
        const customer = result.rows[0];
        res.status(201).json({ token: signCustomerToken(customer), name: customer.name });
    } catch (err) {
        if (err.code === POSTGRES_UNIQUE_VIOLATION) {
            return res.status(409).json({ error: 'Nomor HP ini sudah terdaftar, silakan login' });
        }
        next(err);
    }
});

router.post('/customer/login', customerLoginLimiter, async (req, res, next) => {
    const { phone, password } = req.body ?? {};
    if (typeof phone !== 'string' || typeof password !== 'string' || !phone || !password) {
        return res.status(400).json({ error: 'Nomor HP dan password wajib diisi' });
    }
    try {
        const result = await pool.query('SELECT * FROM customers WHERE phone = $1', [phone]);
        const customer = result.rows[0];
        const passwordMatches = await bcrypt.compare(password, customer ? customer.password : DUMMY_PASSWORD_HASH);
        if (!customer || !passwordMatches) {
            return res.status(401).json({ error: 'Nomor HP atau password salah' });
        }
        res.json({ token: signCustomerToken(customer), name: customer.name });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
