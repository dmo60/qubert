/**
 * Created by Fabian on 12.06.2015.
 */
var mysql = require("mysql");
var config = require("./config");

function handleVideoInfoRequest(req, res) {

    var videoID = req.query.videoID;

    var db = mysql.createConnection(config.MySql);
    db.query("SELECT * from VIDEO_INFO WHERE VideoId = '"+videoID+"'", function(err, rows, fields) {
        if (!err) {
            //Which fields do we want/need?
            res.json({FileName:rows[0].VideoId});
        } else {
            console.log('Error while performing Query.'+err);
            res.send('Database error');
        }
        db.end();
    });
}

exports.handleVideoInfoRequest = handleVideoInfoRequest;
