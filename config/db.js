const mysql = require('mysql2');

// Railway automatically injects MYSQL_* environment variables
// This config uses Railway's variables FIRST, then falls back to local
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQL_USER || process.env.DB_USER || 'root',
    password: process.env.MYSQL_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || process.env.DB_NAME || 'railway',
    port: parseInt(process.env.MYSQL_PORT || process.env.DB_PORT || '3306'),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    // Railway requires SSL
    ssl: {
        rejectUnauthorized: false
    }
});

// Test connection on startup
const promisePool = pool.promise();

async function testConnection() {
    try {
        const [result] = await promisePool.query('SELECT 1 as connected, DATABASE() as db_name');
        console.log('✅ Database connected successfully!');
        console.log('   Database:', result[0].db_name);
        return true;
    } catch (err) {
        console.error('❌ Database connection failed:');
        console.error('   Error:', err.message);
        console.error('   Host:', process.env.MYSQL_HOST || 'not set');
        console.error('   Port:', process.env.MYSQL_PORT || 'not set');
        return false;
    }
}

testConnection();

module.exports = promisePool;