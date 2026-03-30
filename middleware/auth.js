// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

// Middleware to check if user is admin
function isAdmin(req, res, next) {
    if (req.session && req.session.userId && req.session.userRole === 'admin') {
        return next();
    }
    res.status(403).send('Access denied. Admin only.');
}

// Middleware to redirect if already logged in
function redirectIfAuthenticated(req, res, next) {
    if (req.session && req.session.userId) {
        return res.redirect('/dashboard');
    }
    next();
}

// Track visitors
async function trackVisitor(req, res, next) {
    const db = require('../config/db');
    try {
        await db.query(
            'INSERT INTO visitors (ip_address, user_agent, page_visited, session_id) VALUES (?, ?, ?, ?)',
            [
                req.ip || req.connection.remoteAddress,
                req.headers['user-agent'] || null,
                req.originalUrl,
                req.sessionID || null
            ]
        );
    } catch (err) {
        console.error('Visitor tracking error:', err.message);
    }
    next();
}

module.exports = { isAuthenticated, isAdmin, redirectIfAuthenticated, trackVisitor };