const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const pool = require('../db/pool');
const { requireAdmin, requireCustomer } = require('../middleware/auth');
const PostgresRateLimitStore = require('../utils/postgres-rate-limit-store');
const {
    SLOT_MINUTES,
    CANCEL_CUTOFF_MINUTES,
    closingTime,
    toMinutes,
    isOnSlotGrid,
    fitsBusinessHours,
    nowInShop,
    isBeforeCancelCutoff,
    isInPast,
    hasFreeBarber,
    getDaySlots,
} = require('../utils/schedule');

const MAX_POSTGRES_INT = 2147483647;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 1000000;
const MAX_ACTIVE_BOOKINGS = 2;
const MY_BOOKINGS_LIMIT = 50;
const CANCELLABLE_STATUSES = ['pending', 'approved'];
// Kunci tetap buat pg_advisory_xact_lock, jadi pengecekan bentrok + insert jalan satu per satu.
const BOOKING_LOCK_KEY = 20261104;

const createBookingLimiter = rateLimit({
    store: new PostgresRateLimitStore('create-booking'),
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Terlalu banyak percobaan booking, coba lagi nanti' }
});

function parsePositiveInt(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= MAX_POSTGRES_INT ? number : null;
}

function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidTime(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

async function getBookedIntervals(db, date) {
    const result = await db.query(
        `SELECT bookings.booking_time, services.duration_minutes
         FROM bookings
         JOIN services ON bookings.service_id = services.id
         WHERE bookings.booking_date = $1 AND bookings.status NOT IN ('rejected', 'cancelled')`,
        [date]
    );
    return result.rows.map((row) => {
        const start = toMinutes(row.booking_time);
        return { start, end: start + row.duration_minutes };
    });
}

router.get('/availability', requireCustomer, async (req, res, next) => {
    const { date, service_id } = req.query;
    const serviceId = parsePositiveInt(service_id);
    if (!isValidDate(date)) {
        return res.status(400).json({ error: 'Tanggal tidak valid' });
    }
    if (serviceId === null) {
        return res.status(400).json({ error: 'Layanan tidak valid' });
    }
    try {
        const service = await pool.query('SELECT duration_minutes FROM services WHERE id = $1', [serviceId]);
        if (service.rows.length === 0) {
            return res.status(404).json({ error: 'Layanan tidak ditemukan' });
        }
        const booked = await getBookedIntervals(pool, date);
        res.json({ slots: getDaySlots(date, service.rows[0].duration_minutes, booked) });
    } catch (err) {
        next(err);
    }
});

router.get('/mine', requireCustomer, async (req, res, next) => {
    try {
        // booking_date dibikin teks: kalau jadi Date JS, tanggalnya bisa mundur sehari di server WIB.
        const result = await pool.query(
            `SELECT bookings.id, to_char(bookings.booking_date, 'YYYY-MM-DD') AS booking_date,
                    bookings.booking_time, bookings.status,
                    services.name AS service_name, services.price AS service_price,
                    services.duration_minutes
             FROM bookings
             JOIN services ON bookings.service_id = services.id
             WHERE bookings.customer_id = $1
             ORDER BY bookings.booking_date DESC, bookings.booking_time DESC, bookings.id DESC
             LIMIT $2`,
            [req.auth.id, MY_BOOKINGS_LIMIT]
        );
        res.json(result.rows.map((booking) => ({
            ...booking,
            is_past: isInPast(booking.booking_date, booking.booking_time.slice(0, 5)),
            can_cancel: CANCELLABLE_STATUSES.includes(booking.status)
                && isBeforeCancelCutoff(booking.booking_date, booking.booking_time),
        })));
    } catch (err) {
        next(err);
    }
});

router.post('/:id/cancel', requireCustomer, async (req, res, next) => {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
        return res.status(400).json({ error: 'ID booking tidak valid' });
    }
    try {
        // Booking orang lain dijawab "nggak ditemukan", biar ID booking nggak bisa ditebak-tebak.
        const found = await pool.query(
            `SELECT status, to_char(booking_date, 'YYYY-MM-DD') AS booking_date, booking_time
             FROM bookings
             WHERE id = $1 AND customer_id = $2`,
            [id, req.auth.id]
        );
        if (found.rows.length === 0) {
            return res.status(404).json({ error: 'Booking tidak ditemukan' });
        }
        const booking = found.rows[0];
        if (!CANCELLABLE_STATUSES.includes(booking.status)) {
            return res.status(409).json({ error: 'Booking ini sudah nggak bisa dibatalkan' });
        }
        if (!isBeforeCancelCutoff(booking.booking_date, booking.booking_time)) {
            return res.status(409).json({
                error: `Pembatalan paling lambat ${CANCEL_CUTOFF_MINUTES / 60} jam sebelum jadwal`,
            });
        }

        // Status dicek lagi di sini, kalau-kalau admin baru aja memproses booking yang sama.
        const updated = await pool.query(
            "UPDATE bookings SET status = 'cancelled' WHERE id = $1 AND status = ANY($2) RETURNING id, status",
            [id, CANCELLABLE_STATUSES]
        );
        if (updated.rows.length === 0) {
            return res.status(409).json({ error: 'Booking ini sudah nggak bisa dibatalkan' });
        }
        res.json(updated.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.post('/', requireCustomer, createBookingLimiter, async (req, res, next) => {
    const { service_id, booking_date, booking_time } = req.body ?? {};
    if (!service_id || !booking_date || !booking_time) {
        return res.status(400).json({ error: 'Semua field wajib diisi' });
    }
    const serviceId = parsePositiveInt(service_id);
    if (serviceId === null) {
        return res.status(400).json({ error: 'Layanan tidak valid' });
    }
    if (!isValidDate(booking_date)) {
        return res.status(400).json({ error: 'Tanggal tidak valid' });
    }
    if (!isValidTime(booking_time)) {
        return res.status(400).json({ error: 'Jam tidak valid' });
    }
    if (!isOnSlotGrid(booking_time)) {
        return res.status(400).json({ error: `Jam booking harus per ${SLOT_MINUTES} menit` });
    }
    if (isInPast(booking_date, booking_time)) {
        return res.status(400).json({ error: 'Tanggal dan jam tidak boleh sudah lewat' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [BOOKING_LOCK_KEY]);

        const customer = await client.query('SELECT name, phone FROM customers WHERE id = $1', [req.auth.id]);
        if (customer.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(401).json({ error: 'Akun tidak ditemukan, silakan login ulang' });
        }

        const service = await client.query('SELECT duration_minutes FROM services WHERE id = $1', [serviceId]);
        if (service.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Layanan tidak ditemukan' });
        }

        const duration = service.rows[0].duration_minutes;
        const start = toMinutes(booking_time);
        if (!fitsBusinessHours(start, duration)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Layanan ini harus selesai sebelum jam tutup (${closingTime})` });
        }

        const now = nowInShop();
        const active = await client.query(
            `SELECT COUNT(*)::int AS total
             FROM bookings
             WHERE customer_id = $1
               AND status NOT IN ('rejected', 'cancelled')
               AND booking_date + booking_time > $2::timestamp`,
            [req.auth.id, `${now.date} ${now.time}`]
        );
        if (active.rows[0].total >= MAX_ACTIVE_BOOKINGS) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: `Kamu sudah punya ${MAX_ACTIVE_BOOKINGS} booking aktif. Cek di Booking Saya, atau booking lagi setelah jadwalnya lewat.`,
            });
        }

        const booked = await getBookedIntervals(client, booking_date);
        if (!hasFreeBarber(booked, start, duration)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Jadwal itu sudah penuh, pilih jam lain' });
        }

        const result = await client.query(
            `INSERT INTO bookings (customer_id, customer_name, customer_phone, service_id, booking_date, booking_time)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.auth.id, customer.rows[0].name, customer.rows[0].phone, serviceId, booking_date, booking_time]
        );
        await client.query('COMMIT');
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        next(err);
    } finally {
        if (client) client.release();
    }
});

router.get('/', requireAdmin, async (req, res, next) => {
    try {
        const page = Math.min(Math.max(parseInt(req.query.page) || 1, 1), MAX_PAGE);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), MAX_PAGE_SIZE);
        const offset = (page - 1) * limit;

        const countResult = await pool.query('SELECT COUNT(*)::int AS total FROM bookings');
        // booking_date dibikin teks: kalau jadi Date JS, tanggalnya bisa mundur sehari di server WIB.
        const result = await pool.query(
            `SELECT bookings.id, bookings.customer_name, bookings.customer_phone, bookings.service_id,
                    to_char(bookings.booking_date, 'YYYY-MM-DD') AS booking_date,
                    bookings.booking_time, bookings.status, bookings.created_at,
                    services.name AS service_name, services.price AS service_price
             FROM bookings
             JOIN services ON bookings.service_id = services.id
             ORDER BY bookings.created_at DESC, bookings.id DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        res.set('X-Total-Count', String(countResult.rows[0].total));
        res.status(200).json(result.rows);
    } catch (err) {
        next(err);
    }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
    const id = parsePositiveInt(req.params.id);
    const { status } = req.body ?? {};
    if (id === null) {
        return res.status(400).json({ error: 'ID booking tidak valid' });
    }
    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status harus approved atau rejected' });
    }
    try {
        const result = await pool.query(
            "UPDATE bookings SET status = $1 WHERE id = $2 AND status = 'pending' RETURNING *",
            [status, id]
        );
        if (result.rows.length === 0) {
            const existing = await pool.query('SELECT 1 FROM bookings WHERE id = $1', [id]);
            return existing.rows.length === 0
                ? res.status(404).json({ error: 'Booking tidak ditemukan' })
                : res.status(409).json({ error: 'Booking ini sudah diproses' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
