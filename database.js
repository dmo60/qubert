var mysql = require('mysql');

var mysqlConnection = mysql.createPool({
    host: 'mediaq.dbs.ifi.lmu.de',
    user: 'student',
    password: 'tneduts',
    database: 'MediaQ_V2'
});

exports.MySqlConnection = mysqlConnection;
