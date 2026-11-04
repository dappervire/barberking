const jwt = require('jsonwebtoken');
require('dotenv').config();

// Token pelanggan dan admin ditandatangani pakai secret yang sama,
// jadi role di dalam token wajib dicek biar pelanggan nggak bisa akses fitur admin.
function requireRole(role) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;

        if (!authHeader){
            return res.status(401).json({ error : 'Format header tidak valid' });
        }

        const token = authHeader.split(' ')[1];

        if (!token){
            return res.status(401).json({ error : 'Format header tidak valid' });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        } catch (err) {
            return res.status(401).json({ error: 'Token tidak valid atau expired' })
        }

        if (decoded.role !== role) {
            return res.status(403).json({ error: 'Kamu nggak punya akses ke fitur ini' });
        }

        req.auth = decoded;
        next();
    };
}

module.exports = {
    requireAdmin: requireRole('admin'),
    requireCustomer: requireRole('customer'),
};
