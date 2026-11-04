const pool = require('./pool');
const { nowInShop } = require('../utils/schedule');

const BOOKING_RETENTION_DAYS = 3;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

async function runCleanup() {
    const bookings = await pool.query(
        'DELETE FROM bookings WHERE booking_date < $1::date - $2::int',
        [nowInShop().date, BOOKING_RETENTION_DAYS]
    );
    await pool.query('DELETE FROM rate_limits WHERE reset_at <= NOW()');

    if (bookings.rowCount > 0) {
        console.log(`Booking lama dihapus: ${bookings.rowCount}`);
    }
    return bookings.rowCount;
}

async function runCleanupSafely() {
    // Kalau gagal cukup dicatat dan dicoba lagi nanti, jangan sampai bikin server mati.
    try {
        await runCleanup();
    } catch (err) {
        console.error('Gagal menghapus booking lama:', err.message);
    }
}

// Buat server yang nyala terus, kayak di lokal. Di Vercel tugas ini dijalankan Cron lewat /cron/cleanup.
function startBookingCleanup() {
    runCleanupSafely();
    setInterval(runCleanupSafely, CLEANUP_INTERVAL_MS);
}

module.exports = { runCleanup, startBookingCleanup };
