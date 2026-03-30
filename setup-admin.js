const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'task_manager_db'
}).promise();

async function setupAdmin() {
    try {
        // Generate REAL bcrypt hash
        const adminPassword = 'admin123';
        const adminHash = await bcrypt.hash(adminPassword, 10);
        
        console.log('Generated hash:', adminHash);
        
        // Clear existing admin
        await pool.query("DELETE FROM users WHERE username = 'admin'");
        
        // Insert admin with real hash
        await pool.query(
            "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ['admin', 'admin@taskmanager.com', adminHash, 'admin']
        );
        
        // Verify it works
        const [users] = await pool.query("SELECT * FROM users WHERE username = 'admin'");
        const isValid = await bcrypt.compare('admin123', users[0].password_hash);
        
        if (isValid) {
            console.log('✅ Admin setup successful!');
            console.log('   Username: admin');
            console.log('   Password: admin123');
        } else {
            console.log('❌ Setup failed - hash verification error');
        }
        
        process.exit();
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

setupAdmin();