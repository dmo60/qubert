var mysql      = require('mysql');

function handleTest(req, res) {
    var connection = mysql.createConnection({
        host     : 'mediaq.dbs.ifi.lmu.de',
        user     : 'student',
        password : 'tneduts',
        database : 'MediaQ_V2'
    });

    connection.query('SELECT * from VIDEO_INFO', function(err, rows, fields) {
        connection.end();
        if (!err) {
            res.json(rows);
        } else {
            console.log('Error while performing Query.');
            res.send('Database error');
        }
    });
}

exports.handleTest = handleTest;
