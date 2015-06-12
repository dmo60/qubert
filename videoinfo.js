/**
 * Created by Fabian on 12.06.2015.
 */
var database = require("./database");
var db = database.MySqlConnection;

function handleVideoInfoRequest(req, res) {

    var videoID = req.query.videoID;


    db.query("SELECT * from VIDEO_INFO WHERE VideoId = '"+videoID+"'", function(err, rows, fields) {
        db.end();
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
