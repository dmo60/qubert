var mysql = require('mysql');

exports.MysqlConnection = mysql.createPool({
    host: 'mediaq.dbs.ifi.lmu.de',
    user: 'student',
    password: 'tneduts',
    database: 'MediaQ_V2'
});
