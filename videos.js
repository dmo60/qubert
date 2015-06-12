var database = require("./database");
var db = database.MySqlConnection;

function handleVideos(req, res) {
    console.log(req.query);
    var leftTop = req.query.leftTop.split(',');
    var rightBottom = req.query.rightBottom.split(',');

    console.log(leftTop);
    console.log(rightBottom);

    var sql =
        'SELECT VideoId as id, Plat as lat, Plng as lng ' +
        'FROM VIDEO_METADATA ' +
        'WHERE fovNum=1 AND Plat < ? AND Plat > ? AND Plng < ? AND Plng > ?';

    db.query(sql, [leftTop[0], rightBottom[0], leftTop[1], rightBottom[1]], function(err, rows, fields) {
        if (!err) {
            res.json(rows);
        } else {
            console.log('Error while performing Query:' + err);
            res.send('Database error');
        }
    });
}

exports.handleVideos = handleVideos;
