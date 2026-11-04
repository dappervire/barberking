const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { runCleanup } = require('../db/cleanup-bookings');

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest();
}

// Vercel Cron ngirim CRON_SECRET lewat header Authorization. Tanpa secret, endpoint ini ditutup.
function isAuthorized(req) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const header = req.headers.authorization || '';
    return crypto.timingSafeEqual(sha256(header), sha256(`Bearer ${secret}`));
}

router.get('/cleanup', async (req, res, next) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        res.json({ deleted: await runCleanup() });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
