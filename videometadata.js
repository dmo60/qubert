/**
 * Created by Fabian on 12.06.2015.
 */
var database = require("./database");
var db = database.MySqlConnection;

function handleVideoMetaDataRequest(req, res) {

    var videoID = req.query.videoID;


    db.query("SELECT * from VIDEO_METADATA WHERE VideoId = '"+videoID+"'", function(err, rows, fields) {
        if (!err) {
            //Which fields do we want/need?
            res.json(rows);
        } else {
            console.log('Error while performing Query.'+err);
            res.send('Database error');
        }

    });
}

exports.handleVideoMetaDataRequest = handleVideoMetaDataRequest;
