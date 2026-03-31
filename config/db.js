const mysql = require('mysql2');

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASS     || '',
    database:           process.env.DB_NAME     || 'taskmanager',
    port:               parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    ssl:                false
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err.message);
        return;
    }
    console.log('Connected to MySQL database successfully');
    connection.release();
});

module.exports = pool.promise();