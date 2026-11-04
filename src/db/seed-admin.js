const bcrypt = require('bcryptjs');
const pool = require('./pool');

const MIN_PASSWORD_LENGTH = 12;

async function seedAdmin(){
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

    try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
        'INSERT INTO admin (username, password) VALUES ($1, $2) RETURNING id, username',
        [username, hashedPassword]
    );

    console.log('admin berhasil dibuat: ', result.rows[0]);
    process.exit(0);

    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

seedAdmin();
