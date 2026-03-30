const mysql = require('mysql2');
require('dotenv').config();

// Create connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'pa55word',
    database: process.env.DB_NAME || 'task_manager_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        console.error('Please check your database credentials in .env file');
    } else {
        console.log('✅ Database connected successfully');
        connection.release();
    }
});

// Promisify for async/await
const promisePool = pool.promise();

module.exports = promisePool;