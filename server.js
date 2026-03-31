const express  = require('express');
const path     = require('path');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const db       = require('./config/db');

require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('trust proxy', 1);

app.use(session({
    secret:            process.env.SESSION_SECRET || 'taskmanager-secret-2025',
    resave:            false,
    saveUninitialized: false,
    cookie: {
        secure:   process.env.NODE_ENV === 'production',
        maxAge:   24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// =====================================================
// AUTH MIDDLEWARE
// =====================================================
const wantsJson = (req) => {
    const accept = (req.headers && req.headers.accept) ? String(req.headers.accept) : '';
    return req.path.startsWith('/api') || accept.includes('application/json');
};

const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    if (wantsJson(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
    res.redirect('/login');
};

const isAdmin = (req, res, next) => {
    if (req.session && req.session.userId && req.session.userRole === 'admin') return next();
    if (wantsJson(req)) return res.status(403).json({ success: false, error: 'Admin only' });
    res.redirect('/login');
};

const redirectIfAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return req.session.userRole === 'admin'
            ? res.redirect('/admin')
            : res.redirect('/dashboard');
    }
    next();
};

// =====================================================
// VISITOR TRACKING
// =====================================================
app.use(async (req, res, next) => {
    try {
        const skip = req.path.startsWith('/api') ||
                     req.path.startsWith('/public') ||
                     req.path.includes('.');
        if (!skip) {
            await db.query(
                'INSERT INTO visitors (session_id, user_id, page, ip_address) VALUES (?,?,?,?)',
                [
                    req.sessionID || 'unknown',
                    req.session.userId || null,
                    req.path,
                    req.ip || req.connection.remoteAddress
                ]
            );
        }
    } catch (err) {
        // Non-blocking — ignore logging errors
    }
    next();
});

// =====================================================
// PAGE ROUTES
// =====================================================
app.get('/', (req, res) => {
    if (req.session.userId) {
        return req.session.userRole === 'admin'
            ? res.redirect('/admin')
            : res.redirect('/dashboard');
    }
    res.redirect('/login');
});

app.get('/login',     redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/signup',    redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

// support /register as alias for /signup
app.get('/register',  redirectIfAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'signup.html'));
});

app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/admin',     isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/contact',   isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'contact.html'));
});

// =====================================================
// AUTH API ROUTES
// =====================================================

// Get current logged-in user
app.get('/api/user', isAuthenticated, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, role FROM users WHERE id = ?',
            [req.session.userId]
        );
        if (users.length > 0) {
            res.json({ success: true, user: users[0] });
        } else {
            res.json({ success: false, error: 'User not found' });
        }
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Also expose /api/me for compatibility
app.get('/api/me', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({
            success:  true,
            user: {
                id:       req.session.userId,
                username: req.session.userName,
                role:     req.session.userRole
            }
        });
    } else {
        res.json({ success: false });
    }
});

// Register / Signup
app.post('/api/signup',   handleRegister);
app.post('/api/register', handleRegister);

async function handleRegister(req, res) {
    try {
        const username        = (req.body.username        || '').trim();
        const email           = (req.body.email           || '').trim();
        const password        = (req.body.password        || '').trim();
        const confirmPassword = (req.body.confirmPassword || req.body.password || '').trim();

        if (!username || !email || !password) {
            return res.json({ success: false, error: 'All fields are required.' });
        }
        if (password.length < 6) {
            return res.json({ success: false, error: 'Password must be at least 6 characters.' });
        }
        if (password !== confirmPassword) {
            return res.json({ success: false, error: 'Passwords do not match.' });
        }

        // Check duplicate
        const [existing] = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (existing.length > 0) {
            return res.json({ success: false, error: 'Email or username already taken.' });
        }

        // Hash and insert
        const hash = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, email, password, role) VALUES (?,?,?,?)',
            [username, email, hash, 'user']
        );

        req.session.userId   = result.insertId;
        req.session.userName = username;
        req.session.userRole = 'user';

        res.json({ success: true });

    } catch (err) {
        console.error('Register error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.json({ success: false, error: 'Username or email already exists.' });
        }
        res.json({ success: false, error: 'Server error: ' + err.message });
    }
}

// Login
app.post('/api/login', async (req, res) => {
    try {
        const identifier = (req.body.username || req.body.email || '').trim();
        const password   = (req.body.password || '').trim();

        console.log('Login attempt:', identifier);

        if (!identifier || !password) {
            return res.json({ success: false, error: 'Username/email and password are required.' });
        }

        // Search by username OR email
        const [rows] = await db.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [identifier, identifier]
        );

        if (rows.length === 0) {
            console.log('User not found:', identifier);
            return res.json({ success: false, error: 'Invalid username or password.' });
        }

        const user = rows[0];
        console.log('User found:', user.username, '| Role:', user.role);

        // Support both column names: password and password_hash
        const storedHash = user.password || user.password_hash;

        if (!storedHash) {
            console.error('No password hash found for user:', user.username);
            return res.json({ success: false, error: 'Account error. Please contact admin.' });
        }

        const match = await bcrypt.compare(password, storedHash);
        console.log('Password match:', match);

        if (!match) {
            return res.json({ success: false, error: 'Invalid username or password.' });
        }

        // Update last login if column exists
        try {
            await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        } catch (e) {
            // Ignore if column doesn't exist
        }

        req.session.userId   = user.id;
        req.session.userName = user.username;
        req.session.userRole = user.role;

        console.log('Login successful:', user.username, '| Redirecting to:', user.role === 'admin' ? '/admin' : '/dashboard');

        res.json({ success: true, role: user.role });

    } catch (err) {
        console.error('Login error:', err);
        res.json({ success: false, error: 'Server error: ' + err.message });
    }
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// =====================================================
// TASKS API ROUTES
// =====================================================

let tasksSchemaCache = null;
let tasksSchemaCacheAt = 0;
async function getTasksSchema() {
    const now = Date.now();
    if (tasksSchemaCache && (now - tasksSchemaCacheAt) < 5 * 60 * 1000) return tasksSchemaCache;

    const [rows] = await db.query(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'tasks'`
    );
    const cols = new Set(rows.map(r => String(r.COLUMN_NAME).toLowerCase()));

    tasksSchemaCache = {
        hasStatus: cols.has('status'),
        hasCompleted: cols.has('completed'),
        hasCompletedAt: cols.has('completed_at'),
        hasDueDate: cols.has('due_date')
    };
    tasksSchemaCacheAt = now;
    return tasksSchemaCache;
}

// Get tasks
app.get('/api/tasks', isAuthenticated, async (req, res) => {
    try {
        const filter = req.query.filter || 'all';
        const schema = await getTasksSchema();

        let query = 'SELECT * FROM tasks WHERE user_id = ?';
        if (filter === 'pending') {
            if (schema.hasStatus) query += ' AND status = "pending"';
            else query += ' AND (completed = FALSE OR completed IS NULL)';
        }
        if (filter === 'completed') {
            if (schema.hasStatus) query += ' AND status = "completed"';
            else query += ' AND completed = TRUE';
        }
        query += ' ORDER BY created_at DESC';

        const [tasks] = await db.query(query, [req.session.userId]);
        res.json({ success: true, tasks });
    } catch (err) {
        console.error('Tasks error:', err);
        res.json({ success: false, error: err.message });
    }
});

// Create task
app.post('/api/tasks', isAuthenticated, async (req, res) => {
    try {
        const schema = await getTasksSchema();

        const title       = (req.body.title       || '').trim();
        const description = (req.body.description || '').trim();
        const priority    = req.body.priority    || 'medium';
        const due_dateRaw = req.body.due_date;
        const due_date    = (typeof due_dateRaw === 'string' && due_dateRaw.trim() === '') ? null : (due_dateRaw || null);

        if (!title) {
            return res.json({ success: false, error: 'Task title is required.' });
        }

        let result;
        try {
            // Newer schema (includes due_date)
            const [r] = await db.query(
                'INSERT INTO tasks (user_id, title, description, priority, due_date) VALUES (?,?,?,?,?)',
                [req.session.userId, title, description || null, priority, due_date]
            );
            result = r;
        } catch (e) {
            // Older schema on some deployments: tasks table missing due_date
            if (e && (e.code === 'ER_BAD_FIELD_ERROR' || /Unknown column 'due_date'/i.test(e.message || ''))) {
                const [r] = await db.query(
                    'INSERT INTO tasks (user_id, title, description, priority) VALUES (?,?,?,?)',
                    [req.session.userId, title, description || null, priority]
                );
                result = r;
            } else {
                throw e;
            }
        }

        const [rows] = await db.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
        // Normalize for older schemas so the UI can still work
        if (rows && rows[0] && !schema.hasStatus && rows[0].status === undefined) {
            rows[0].status = rows[0].completed ? 'completed' : 'pending';
        }
        res.json({ success: true, task: rows[0] });

    } catch (err) {
        console.error('Create task error:', err);
        res.json({ success: false, error: err.message });
    }
});

// Toggle / update task — supports both PATCH and PUT
async function handleTaskUpdate(req, res) {
    try {
        const id = req.params.id;
        const schema = await getTasksSchema();

        // Support both toggle (PATCH) and status update (PUT)
        if (req.body.status !== undefined) {
            // PUT: set specific status
            const status = req.body.status === 'completed' ? 'completed' : 'pending';
            const completed = status === 'completed';

            if (schema.hasStatus) {
                await db.query(
                    `UPDATE tasks SET status = ?, completed = ?,
                     completed_at = ${completed ? 'NOW()' : 'NULL'}
                     WHERE id = ? AND user_id = ?`,
                    [status, completed, id, req.session.userId]
                );
            } else {
                // Older schema: no status column
                if (schema.hasCompletedAt) {
                    await db.query(
                        `UPDATE tasks SET completed = ?, completed_at = ${completed ? 'NOW()' : 'NULL'}
                         WHERE id = ? AND user_id = ?`,
                        [completed, id, req.session.userId]
                    );
                } else {
                    await db.query(
                        'UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?',
                        [completed, id, req.session.userId]
                    );
                }
            }
            res.json({ success: true });
        } else {
            // PATCH: toggle completed
            const [rows] = await db.query(
                'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
                [id, req.session.userId]
            );
            if (rows.length === 0) {
                return res.json({ success: false, error: 'Task not found.' });
            }
            const completed    = !rows[0].completed;
            const completedAt  = completed ? new Date() : null;
            if (schema.hasStatus) {
                await db.query(
                    'UPDATE tasks SET completed = ?, completed_at = ?, status = ? WHERE id = ? AND user_id = ?',
                    [completed, completedAt, completed ? 'completed' : 'pending', id, req.session.userId]
                );
            } else if (schema.hasCompletedAt) {
                await db.query(
                    'UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ? AND user_id = ?',
                    [completed, completedAt, id, req.session.userId]
                );
            } else {
                await db.query(
                    'UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?',
                    [completed, id, req.session.userId]
                );
            }
            res.json({ success: true, completed });
        }
    } catch (err) {
        console.error('Update task error:', err);
        res.json({ success: false, error: err.message });
    }
}

app.patch('/api/tasks/:id', isAuthenticated, handleTaskUpdate);
app.put('/api/tasks/:id',   isAuthenticated, handleTaskUpdate);

// Delete task
app.delete('/api/tasks/:id', isAuthenticated, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM tasks WHERE id = ? AND user_id = ?',
            [req.params.id, req.session.userId]
        );
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// =====================================================
// MESSAGES / CONTACT API ROUTES
// =====================================================

// User sends message to admin
app.post('/api/messages', isAuthenticated, async (req, res) => {
    try {
        const subject = (req.body.subject || '').trim();
        const body    = (req.body.body    || '').trim();

        if (!subject || !body) {
            return res.json({ success: false, error: 'Subject and message are required.' });
        }

        await db.query(
            'INSERT INTO messages (user_id, subject, body) VALUES (?,?,?)',
            [req.session.userId, subject, body]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Message error:', err);
        res.json({ success: false, error: err.message });
    }
});

// Public contact form (no login required)
app.post('/api/contact', async (req, res) => {
    try {
        const name    = (req.body.name    || '').trim();
        const email   = (req.body.email   || '').trim();
        const subject = (req.body.subject || '').trim();
        const message = (req.body.message || req.body.body || '').trim();

        if (!name || !email || !message) {
            return res.json({ success: false, error: 'Please fill in all required fields.' });
        }

        // Try inserting with user_id null for public contact
        await db.query(
            'INSERT INTO messages (user_id, subject, body) VALUES (?,?,?)',
            [req.session.userId || null, subject || 'Contact Form', `From: ${name} <${email}>\n\n${message}`]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Contact error:', err);
        res.json({ success: false, error: err.message });
    }
});

// Admin: get all messages
app.get('/api/messages', isAdmin, async (req, res) => {
    try {
        const [messages] = await db.query(
            `SELECT m.*, u.username, u.email as user_email
             FROM messages m
             LEFT JOIN users u ON m.user_id = u.id
             ORDER BY m.created_at DESC`
        );
        res.json({ success: true, messages });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Admin: mark message as read
app.patch('/api/messages/:id/read', isAdmin, async (req, res) => {
    try {
        await db.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Support PUT for mark as read
app.put('/api/admin/messages/:id/read', isAdmin, async (req, res) => {
    try {
        await db.query('UPDATE messages SET is_read = TRUE WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Admin: delete message
app.delete('/api/messages/:id',       isAdmin, deleteMessage);
app.delete('/api/admin/messages/:id', isAdmin, deleteMessage);

async function deleteMessage(req, res) {
    try {
        await db.query('DELETE FROM messages WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
}

// =====================================================
// ADMIN API ROUTES
// =====================================================

app.get('/api/admin/stats', isAdmin, async (req, res) => {
    try {
        const tasksSchema = await getTasksSchema();
        const [[{ totalUsers }]]     = await db.query(
            `SELECT COUNT(*) as totalUsers
             FROM users
             WHERE (role IS NULL OR role <> 'admin')`
        );
        const [[{ totalTasks }]]     = await db.query('SELECT COUNT(*) as totalTasks FROM tasks');
        const [[{ completedTasks }]] = tasksSchema.hasStatus
            ? await db.query('SELECT COUNT(*) as completedTasks FROM tasks WHERE status = "completed"')
            : await db.query('SELECT COUNT(*) as completedTasks FROM tasks WHERE completed = TRUE');
        const [[{ pendingTasks }]] = tasksSchema.hasStatus
            ? await db.query('SELECT COUNT(*) as pendingTasks FROM tasks WHERE status = "pending"')
            : await db.query('SELECT COUNT(*) as pendingTasks FROM tasks WHERE completed = FALSE OR completed IS NULL');
        const [[{ unreadMessages }]] = await db.query('SELECT COUNT(*) as unreadMessages FROM messages WHERE is_read = FALSE');

        // Visitors — try both table structures
        let totalVisitors = 0, todayVisitors = 0, recentVisitors = [];
        try {
            const [[tv]] = await db.query('SELECT COUNT(DISTINCT session_id) as c FROM visitors');
            const [[dv]] = await db.query('SELECT COUNT(DISTINCT session_id) as c FROM visitors WHERE DATE(visited_at) = CURDATE()');
            const [rv]   = await db.query('SELECT * FROM visitors ORDER BY visited_at DESC LIMIT 20');
            totalVisitors  = tv.c;
            todayVisitors  = dv.c;
            recentVisitors = rv;
        } catch (e) {
            // visitors table may not exist yet
        }

        // All users with task counts
        const [users] = await db.query(
            `SELECT u.id, u.username, u.email, u.role, u.created_at,
                    COUNT(t.id) as taskCount,
                    SUM(${tasksSchema.hasStatus ? "t.status = 'completed'" : "t.completed = TRUE"}) as completedCount
             FROM users u
             LEFT JOIN tasks t ON u.id = t.user_id
             WHERE (u.role IS NULL OR u.role <> 'admin')
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        );

        // Messages
        const [messages] = await db.query(
            `SELECT m.*, u.username, u.email as user_email
             FROM messages m
             LEFT JOIN users u ON m.user_id = u.id
             ORDER BY m.created_at DESC LIMIT 50`
        );

        // Visits by day
        let visitsByDay = [];
        try {
            const [vbd] = await db.query(
                `SELECT DATE(visited_at) as date, COUNT(*) as count
                 FROM visitors
                 WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                 GROUP BY DATE(visited_at)
                 ORDER BY date ASC`
            );
            visitsByDay = vbd;
        } catch (e) {}

        res.json({
            success: true,
            stats: {
                totalUsers,
                totalTasks,
                completedTasks,
                pendingTasks,
                totalVisitors,
                todayVisitors,
                unreadMessages
            },
            recentVisitors,
            visitsByDay,
            users,
            messages
        });

    } catch (err) {
        console.error('Admin stats error:', err);
        res.json({ success: false, error: err.message });
    }
});

// Admin: get all users
app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json({ success: true, users });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Admin session check
app.get('/api/admin/session', (req, res) => {
    if (req.session && req.session.userRole === 'admin') {
        res.json({ success: true, user: { id: req.session.userId, username: req.session.userName, role: req.session.userRole } });
    } else {
        res.json({ success: false });
    }
});

// =====================================================
// 404 HANDLER
// =====================================================
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// =====================================================
// ERROR HANDLER
// =====================================================
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// =====================================================
// START SERVER
// =====================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log('===========================================');
    console.log(`  TaskFlow running on port ${PORT}`);
    console.log(`  http://localhost:${PORT}`);
    console.log('===========================================');
    console.log('  Admin login: admin@taskmanager.com');
    console.log('  Password:    password');
    console.log('===========================================');
});