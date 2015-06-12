/**
 * Created by Fabian on 12.06.2015.
 */
var mysql      = require('mysql');

function handleVideoInfoRequest(req, res) {
    var connection = mysql.createConnection({
        host     : 'mediaq.dbs.ifi.lmu.de',
        user     : 'student',
        password : 'tneduts',
        database : 'MediaQ_V2'
    });

    var videoID = req.query.videoID;


    connection.query("SELECT * from VIDEO_INFO WHERE VideoId = '"+videoID+"'", function(err, rows, fields) {
        connection.end();
        if (!err) {
            //Which fields do we want/need?
            res.json({FileName:rows[0].VideoId});
        } else {
            console.log('Error while performing Query.'+err);
            res.send('Database error');
        }

    });
}

exports.handleVideoInfoRequest = handleVideoInfoRequest;
