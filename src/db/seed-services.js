const pool = require('./pool');

// Harga dan durasi layanan yang namanya udah ada di database nggak bakal diubah.
const SERVICES = [
    { name: 'Potong Rambut', price: 25000, duration_minutes: 30 },
    { name: 'Cukur Jenggot', price: 15000, duration_minutes: 20 },
    { name: 'Potong + Cukur', price: 35000, duration_minutes: 45 },
    { name: 'Potong Rambut Anak', price: 20000, duration_minutes: 30 },
    { name: 'Cuci + Styling', price: 15000, duration_minutes: 20 },
    { name: 'Cukur Handuk Panas', price: 30000, duration_minutes: 30 },
    { name: 'Creambath', price: 35000, duration_minutes: 45 },
    { name: 'Facial Pria', price: 40000, duration_minutes: 30 },
    { name: 'Hair Tattoo', price: 40000, duration_minutes: 45 },
    { name: 'Semir Rambut', price: 75000, duration_minutes: 60 },
    { name: 'Down Perm', price: 100000, duration_minutes: 90 },
    { name: 'Paket King: Potong + Handuk Panas + Facial', price: 85000, duration_minutes: 90 },
];

async function seedServices() {
    try {
        let added = 0;
        for (const service of SERVICES) {
            const result = await pool.query(
                `INSERT INTO services (name, price, duration_minutes)
                 SELECT $1::varchar, $2::int, $3::int
                 WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = $1::varchar)`,
                [service.name, service.price, service.duration_minutes]
            );
            added += result.rowCount;
        }
        console.log(`Layanan ditambahkan: ${added}, sudah ada: ${SERVICES.length - added}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

seedServices();
