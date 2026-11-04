const bcrypt = require('bcryptjs');
const pool = require('./pool');

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_MAX_BYTES = 72;

async function setAdminPassword() {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
        console.error('Error: isi ADMIN_USERNAME dan ADMIN_PASSWORD dulu di .env');
        process.exit(1);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        console.error(`Error: ADMIN_PASSWORD minimal ${MIN_PASSWORD_LENGTH} karakter`);
        process.exit(1);
    }
    if (Buffer.byteLength(password) > BCRYPT_MAX_BYTES) {
        console.error(`Error: ADMIN_PASSWORD maksimal ${BCRYPT_MAX_BYTES} byte`);
        process.exit(1);
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'UPDATE admin SET password = $1 WHERE username = $2 RETURNING username',
            [hashedPassword, username]
        );
        if (result.rows.length === 0) {
            console.error(`Error: admin "${username}" tidak ditemukan`);
            process.exit(1);
        }
        console.log(`Password admin "${username}" berhasil diganti`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

setAdminPassword();
