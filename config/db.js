const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host:               process.env.MYSQLHOST      || 'localhost',
    user:               process.env.MYSQLUSER      || 'root',
    password:           process.env.MYSQLPASSWORD  || '',
    database:           process.env.MYSQL_DATABASE || 'taskmanager',
    port:               parseInt(process.env.MYSQLPORT) || 3306,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    ssl:                false
});

// Test connection on startup
pool.getConnection()
    .then(connection => {
        console.log('Connected to MySQL database successfully');
        connection.release();
    })
    .catch(err => {
        console.error('Database connection failed:', err.message);
    });

module.exports = pool;
```

---

**The key differences:**

| Before | After |
|---|---|
| `require('mysql2')` | `require('mysql2/promise')` |
| `mysql.createPool({...})` then `.promise()` at the end | Import the promise version directly — cleaner |
| `pool.getConnection((err, conn) => {})` callback style | `.then().catch()` promise style |
| `module.exports = pool.promise()` | `module.exports = pool` directly |

The old way called `.promise()` on the pool but then the exported object sometimes lost the `.query()` method depending on the mysql2 version. Importing `mysql2/promise` directly is the correct and reliable way.

---

Then push to GitHub:
```
git add config/db.js
git commit -m "fix: use mysql2/promise directly"
git push