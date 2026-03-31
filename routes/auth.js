const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const db       = require('../config/db');
const path     = require('path');

// ── GET /login ──
router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
});

// ── GET /signup ──
router.get('/signup', (req, res) => {
    if (req.session.userId) return res.redirect('/dashboard');
    res.sendFile(path.join(__dirname, '..', 'views', 'signup.html'));
});

// ── POST /api/signup ──
router.post('/api/signup', async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        const email    = (req.body.email    || '').trim();
        const password = (req.body.password || '').trim();

        // Validate all fields exist
        if (!username || !email || !password) {
            return res.json({ success: false, error: 'All fields are required.' });
        }
        if (password.length < 6) {
            return res.json({ success: false, error: 'Password must be at least 6 characters.' });
        }

        // Check if user already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (existing.length > 0) {
            return res.json({ success: false, error: 'Email or username already taken.' });
        }

        // Hash password and create user
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, email, password) VALUES (?,?,?)',
            [username, email, hash]
        );

        req.session.userId = result.insertId;
        req.session.userName = username;
        req.session.userRole = 'user';

        res.json({ success: true });

    } catch (err) {
        console.error('Signup error:', err);
        res.json({ success: false, error: 'Server error: ' + err.message });
    }
});

// ── POST /api/login ──
router.post('/api/login', async (req, res) => {
    try {
        const email    = (req.body.email    || '').trim();
        const password = (req.body.password || '').trim();

        // Validate fields exist
        if (!email || !password) {
            return res.json({ success: false, error: 'Email and password are required.' });
        }

        // Find user
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (rows.length === 0) {
            return res.json({ success: false, error: 'Invalid email or password.' });
        }

        const user = rows[0];

        // Check password exists in database
        if (!user.password) {
            return res.json({ success: false, error: 'Account error. Please contact admin.' });
        }

        // Compare password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.json({ success: false, error: 'Invalid email or password.' });
        }

        // Set session
        req.session.userId = user.id;
        req.session.userName = user.username;
        req.session.userRole = user.role;

        res.json({ success: true, role: user.role });

    } catch (err) {
        console.error('Login error:', err);
        res.json({ success: false, error: 'Server error: ' + err.message });
    }
});

// ── POST /api/logout ──
router.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

module.exports = router;