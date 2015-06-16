var mysql = require("mysql");
var config = require("./config");

var LatLng = function(coords) {
    var tmp = coords.split(',');
    this.lat = tmp[0];
    this.lng = tmp[1];
};

exports.RequestHandler = function (req, res) {
    var leftTop = new LatLng(req.query.leftTop);
    var rightBottom = new LatLng(req.query.rightBottom);

    var sql =
        'SELECT VideoId as id, Plat as lat, Plng as lng ' +
        'FROM VIDEO_METADATA ' +
        'WHERE fovNum=1 AND Plat < ? AND Plat > ? AND Plng < ? AND Plng > ?';

    var db = mysql.createConnection(config.MySql);
    db.query(sql, [leftTop.lat, rightBottom.lat, leftTop.lng, rightBottom.lng], function(err, rows, fields) {
        if (!err) {
            res.setHeader('Content-Type', 'application/json');
            res.json(rows);
        } else {
            console.log('Error while performing Query:' + err);
            res.send('Database error');
        }
        db.end();
    });
};
