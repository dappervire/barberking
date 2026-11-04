const pool = require('../db/pool');

// Di Vercel tiap instance punya memori sendiri, jadi hitungan percobaan harus disimpan di database.
class PostgresRateLimitStore {
    constructor(prefix) {
        this.prefix = prefix;
        this.localKeys = false;
    }

    init(options) {
        this.windowSeconds = options.windowMs / 1000;
    }

    keyFor(key) {
        return `${this.prefix}:${key}`;
    }

    async increment(key) {
        const result = await pool.query(
            `INSERT INTO rate_limits (key, hits, reset_at)
             VALUES ($1, 1, NOW() + make_interval(secs => $2::double precision))
             ON CONFLICT (key) DO UPDATE SET
               hits = CASE WHEN rate_limits.reset_at <= NOW() THEN 1 ELSE rate_limits.hits + 1 END,
               reset_at = CASE WHEN rate_limits.reset_at <= NOW() THEN EXCLUDED.reset_at ELSE rate_limits.reset_at END
             RETURNING hits, reset_at`,
            [this.keyFor(key), this.windowSeconds]
        );
        return { totalHits: result.rows[0].hits, resetTime: result.rows[0].reset_at };
    }

    async decrement(key) {
        await pool.query('UPDATE rate_limits SET hits = GREATEST(hits - 1, 0) WHERE key = $1', [this.keyFor(key)]);
    }

    async resetKey(key) {
        await pool.query('DELETE FROM rate_limits WHERE key = $1', [this.keyFor(key)]);
    }
}

module.exports = PostgresRateLimitStore;
