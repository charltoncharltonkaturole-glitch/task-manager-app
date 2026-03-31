const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:               process.env.MYSQLHOST      || 'localhost',
    user:               process.env.MYSQLUSER      || 'root',
    password:           process.env.MYSQLPASSWORD  || '',
    database:           process.env.MYSQL_DATABASE || 'railway',
    port:               parseInt(process.env.MYSQLPORT) || 3306,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    ssl:                false
});

pool.getConnection()
    .then(connection => {
        console.log('Connected to MySQL database successfully');
        connection.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
    });

module.exports = pool;
