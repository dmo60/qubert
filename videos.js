var MongoClient = require("mongodb").MongoClient;
var async = require("async");
var config = require("./config");

var LatLng = function (coords) {
    var tmp = coords.split(',');
    this.lat = parseFloat(tmp[0]);
    this.lng = parseFloat(tmp[1]);
};

exports.RequestHandler = function (req, res) {
    var leftTop = new LatLng(req.query.leftTop);
    var rightBottom = new LatLng(req.query.rightBottom);

    async.waterfall([
        function(callback) {
            MongoClient.connect(config.MongoUrl, callback)
        },

        function (db, callback) {
            var videos = db.collection("videos");
            videos.find({
                "location": {
                    $geoWithin: {
                        $box: [[leftTop.lng, rightBottom.lat], [rightBottom.lng, leftTop.lat]]
                    }
                }
            }).toArray(function (err, docs) {
                if (err) {
                    callback(err);
                } else {
                    for (var i = 0; i < docs.length; i++) {
                        var video = docs[i];
                        video.id = video.VideoId;
                        video.lat = video.location.coordinates[1];
                        video.lng = video.location.coordinates[0];
                    }
                    callback(null, docs);
                }
                db.close();
            });
        }

    ], function (err, result) {
        if (err) {
            console.log('Error while performing Query:' + err);
            res.send('Database error');
        } else {
            console.log("Number of videos found: " + result.length);
            res.setHeader('Content-Type', 'application/json');
            res.json(result);
        }
    });
};
