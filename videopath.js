/**
 * Created by Fabian on 12.06.2015.
 */
var database = require("./database");
var db = database.MySqlConnection;

function handleVideoInfoRequest(req, res) {

    var videoID = req.query.videoID;


    db.query("SELECT * from VIDEO_METADATA WHERE VideoId = '"+videoID+"'", function(err, rows, fields) {
        if (!err) {
            //Which fields do we want/need?

            var wayPoints = [];

            for (var i = 0; i < rows.length; i++){
                wayPoints.push({lat:rows[i].Plat,lng:rows[i].Plng,timeCode:rows[i].TimeCode});
            }

            wayPoints.sort(function(a, b){return a.timeCode- b.timeCode});
            res.json(wayPoints);
        } else {
            console.log('Error while performing Query.'+err);
            res.send('Database error');
        }

    });
}

exports.handleVideoInfoRequest = handleVideoInfoRequest;
