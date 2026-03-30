const express = require('express');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import database
const db = require('./config/db');

// Import middleware
const { isAuthenticated, isAdmin, redirectIfAuthenticated, trackVisitor } = require('./middleware/auth');

// =====================
// MIDDLEWARE
// =====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Trust proxy (needed for Render)
app.set('trust proxy', 1);

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production', // true for HTTPS
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Make user data available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.userName || null;
    res.locals.userRole = req.session.userRole || null;
    next();
});

// Visitor tracking
app.use(trackVisitor);

// =====================
// SERVE HTML PAGES
// =====================

// Home page - redirect to login or dashboard
app.get('/', (req, res) => {
    if (req.session.userId) {
        if (req.session.userRole === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/dashboard');
        }
    } else {
        res.redirect('/login');
    }
});

// Login page
app.get('/login', redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// Register page
app.get('/register', redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// User dashboard
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

// Admin dashboard
app.get('/admin', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Contact page
app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

// =====================
// AUTH API ROUTES
// =====================

// Get current user info
app.get('/api/user', isAuthenticated, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, role FROM users WHERE id = ?',
            [req.session.userId]
        );
        if (users.length > 0) {
            res.json({ success: true, username: users[0].username, email: users[0].email, role: users[0].role });
        } else {
            res.json({ success: false, error: 'User not found' });
        }
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Register new user
app.post('/api/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;
    
    // Validation
    if (!username || !email || !password) {
        return res.json({ success: false, error: 'All fields are required' });
    }
    
    if (password !== confirmPassword) {
        return res.json({ success: false, error: 'Passwords do not match' });
    }
    
    if (password.length < 6) {
        return res.json({ success: false, error: 'Password must be at least 6 characters' });
    }
    
    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert user
        await db.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
            [username, email, hashedPassword, 'user']
        );
        
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.json({ success: false, error: 'Username or email already exists' });
        } else {
            console.error('Registration error:', err);
            res.json({ success: false, error: 'Server error: ' + err.message });
        }
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    console.log('========================================');
    console.log('Login attempt:', { username });
    console.log('========================================');
    
    if (!username || !password) {
        return res.json({ success: false, error: 'Username and password are required' });
    }
    
    try {
        // Search by username OR email
        const [users] = await db.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username]
        );
        
        console.log(`Found ${users.length} user(s)`);
        
        if (users.length === 0) {
            console.log('❌ User not found');
            return res.json({ success: false, error: 'Invalid username or password' });
        }
        
        const user = users[0];
        console.log(`User found: ${user.username} (Role: ${user.role})`);
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        console.log(`Password valid: ${validPassword}`);
        
        if (!validPassword) {
            console.log('❌ Invalid password');
            return res.json({ success: false, error: 'Invalid username or password' });
        }
        
        // Update last login
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );
        
        // Set session
        req.session.userId = user.id;
        req.session.userName = user.username;
        req.session.userRole = user.role;
        
        console.log(`✅ Login successful! Redirecting to ${user.role === 'admin' ? '/admin' : '/dashboard'}`);
        
        res.json({ success: true, role: user.role });
        
    } catch (err) {
        console.error('Login error:', err);
        res.json({ success: false, error: 'Server error: ' + err.message });
    }
});

// Logout user
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.json({ success: false, error: err.message });
        } else {
            res.json({ success: true });
        }
    });
});

// =====================
// TASKS API ROUTES
// =====================

// Get user tasks
app.get('/api/tasks', isAuthenticated, async (req, res) => {
    const { filter = 'all' } = req.query;
    
    try {
        let query = 'SELECT * FROM tasks WHERE user_id = ?';
        
        if (filter === 'pending') {
            query += ' AND status = "pending"';
        } else if (filter === 'completed') {
            query += ' AND status = "completed"';
        }
        
        query += ' ORDER BY created_at DESC';
        
        const [tasks] = await db.query(query, [req.session.userId]);
        res.json({ success: true, tasks });
    } catch (err) {
        console.error('Error loading tasks:', err);
        res.json({ success: false, error: err.message });
    }
});

// Create new task
app.post('/api/tasks', isAuthenticated, async (req, res) => {
    const { title, description, priority, due_date } = req.body;
    
    if (!title || title.trim() === '') {
        return res.json({ success: false, error: 'Task title is required' });
    }
    
    try {
        const [result] = await db.query(
            'INSERT INTO tasks (user_id, title, description, priority, due_date) VALUES (?, ?, ?, ?, ?)',
            [req.session.userId, title.trim(), description || null, priority || 'medium', due_date || null]
        );
        
        // Get the created task
        const [newTask] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
        
        res.json({ success: true, task: newTask[0] });
    } catch (err) {
        console.error('Error creating task:', err);
        res.json({ success: false, error: err.message });
    }
});

// Update task status
app.put('/api/tasks/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        await db.query(
            `UPDATE tasks 
             SET status = ?, 
                 completed_at = ${status === 'completed' ? 'NOW()' : 'NULL'}
             WHERE id = ? AND user_id = ?`,
            [status, id, req.session.userId]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error updating task:', err);
        res.json({ success: false, error: err.message });
    }
});

// Delete task
app.delete('/api/tasks/:id', isAuthenticated, async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query(
            'DELETE FROM tasks WHERE id = ? AND user_id = ?',
            [id, req.session.userId]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting task:', err);
        res.json({ success: false, error: err.message });
    }
});

// =====================
// ADMIN API ROUTES
// =====================

// Get dashboard statistics
app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        // Total users
        const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        
        // Total tasks
        const [totalTasks] = await db.query('SELECT COUNT(*) as count FROM tasks');
        
        // Completed tasks
        const [completedTasks] = await db.query('SELECT COUNT(*) as count FROM tasks WHERE status = "completed"');
        
        // Pending tasks
        const [pendingTasks] = await db.query('SELECT COUNT(*) as count FROM tasks WHERE status = "pending"');
        
        // Total visitors (unique sessions)
        const [totalVisitors] = await db.query('SELECT COUNT(DISTINCT session_id) as count FROM visitors');
        
        // Today's visitors
        const [todayVisitors] = await db.query(
            "SELECT COUNT(DISTINCT session_id) as count FROM visitors WHERE DATE(visited_at) = CURDATE()"
        );
        
        // Recent visitors (last 10)
        const [recentVisitors] = await db.query(
            'SELECT * FROM visitors ORDER BY visited_at DESC LIMIT 10'
        );
        
        // Unread messages count
        const [unreadMessages] = await db.query('SELECT COUNT(*) as count FROM messages WHERE is_read = FALSE');
        
        // Recent messages
        const [messages] = await db.query(
            'SELECT * FROM messages ORDER BY created_at DESC LIMIT 20'
        );
        
        res.json({
            success: true,
            stats: {
                totalUsers: totalUsers[0].count,
                totalTasks: totalTasks[0].count,
                completedTasks: completedTasks[0].count,
                pendingTasks: pendingTasks[0].count,
                totalVisitors: totalVisitors[0].count,
                todayVisitors: todayVisitors[0].count,
                unreadMessages: unreadMessages[0].count
            },
            recentVisitors,
            messages
        });
    } catch (err) {
        console.error('Error loading stats:', err);
        res.json({ success: false, error: err.message });
    }
});

// Mark message as read
app.put('/api/admin/messages/:id/read', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error marking message read:', err);
        res.json({ success: false, error: err.message });
    }
});

// Delete message
app.delete('/api/admin/messages/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    
    try {
        await db.query('DELETE FROM messages WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting message:', err);
        res.json({ success: false, error: err.message });
    }
});

// Get all users (admin only)
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, role, last_login, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, users });
    } catch (err) {
        console.error('Error loading users:', err);
        res.json({ success: false, error: err.message });
    }
});

// =====================
// CONTACT API ROUTE
// =====================

// Submit contact message
app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !message) {
        return res.json({ success: false, error: 'Please fill in all required fields' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.json({ success: false, error: 'Please enter a valid email address' });
    }
    
    try {
        await db.query(
            'INSERT INTO messages (name, email, subject, message) VALUES (?, ?, ?, ?)',
            [name.trim(), email.trim(), subject || null, message.trim()]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Error sending message:', err);
        res.json({ success: false, error: err.message });
    }
});

// =====================
// DEBUG ROUTE (Remove in production)
// =====================
// Uncomment only for debugging
/*
app.get('/debug/users', async (req, res) => {
    try {
        const [users] = await db.query('SELECT id, username, email, role FROM users');
        res.json(users);
    } catch (err) {
        res.json({ error: err.message });
    }
});
*/

// =====================
// 404 HANDLER
// =====================
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>404 - Page Not Found</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                h1 { font-size: 80px; margin: 0; }
                a { color: white; text-decoration: none; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 8px; display: inline-block; margin-top: 20px; }
                a:hover { background: rgba(255,255,255,0.3); }
            </style>
        </head>
        <body>
            <h1>404</h1>
            <h2>Page Not Found</h2>
            <p>The page you're looking for doesn't exist.</p>
            <a href="/">Go to Homepage</a>
        </body>
        </html>
    `);
});

// =====================
// ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>500 - Server Error</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    text-align: center;
                    padding: 50px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }
                a { color: white; text-decoration: none; background: rgba(255,255,255,0.2); padding: 10px 20px; border-radius: 8px; display: inline-block; margin-top: 20px; }
            </style>
        </head>
        <body>
            <h1>500</h1>
            <h2>Server Error</h2>
            <p>Something went wrong on our end. Please try again later.</p>
            <a href="/">Go to Homepage</a>
        </body>
        </html>
    `);
});

// =====================
// START SERVER
// =====================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ═══════════════════════════════════════════════════════
    🚀 Task Manager App is running!
    ═══════════════════════════════════════════════════════
    📍 Local:    http://localhost:${PORT}
    📍 Network:  http://0.0.0.0:${PORT}
    
    🔐 Admin Login:
       Username: admin
       Password: admin123
    
    📝 Test User:
       Username: testuser
       Password: test123
    ═══════════════════════════════════════════════════════
    `);
});