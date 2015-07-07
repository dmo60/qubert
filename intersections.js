var MongoClient = require("mongodb").MongoClient;
var async = require("async");
var config = require("./config");

exports.RequestHandler = function (req, res) {

    var queryVideoId = req.query.videoID;

    async.waterfall([
        function (callback) {
            startTimeLog("Connect to MongoDB");
            MongoClient.connect(config.MongoUrl, function (err, db) {
                if (err) {
                    callback(err);
                } else {
                    stopTimeLog();
                    callback(null, db);
                }
            })
        },

        function (mongoDb, callback) {
            startTimeLog("Get view cones for query video");
            mongoDb.collection("viewcones")
                .find({VideoId: queryVideoId})
                .sort({FovNum: 1})
                .toArray(function (err, docs) {
                    if (err) {
                        callback(err);
                    } else {
                        stopTimeLog();
                        callback(null, docs, mongoDb);
                    }
                });
        },

        function (queryCones, mongoDb, callback) {
            startTimeLog("Find intersections for each view cone");
            var result = [];
            async.forEachOf(queryCones, function (cone, index, cb) {
                // TODO: aggregate by videoId??
                //startTimeLog("query");
                mongoDb.collection("viewcones")
                    .find({
                        VideoId: {$ne: queryVideoId},
                        cone: {
                            $geoIntersects: {
                                //$geometry: cone.cone
                                $geometry: {
                                    type: "Point",
                                    coordinates: [cone.Plng, cone.Plat]
                                }
                            }
                        }
                    })
                    .sort({VideoId: 1})
                    .toArray(function (err, docs) {
                        if (err) {
                            cb(err);
                        } else {
                            var intersections = [];
                            docs.forEach(function(doc) {
                                intersections.push({
                                    VideoId: doc.VideoId,
                                    TimeCode: doc.TimeCode,
                                    cone: doc.cone.coordinates[0],
                                    position: [doc.Plat, doc.Plng],
                                    angle: doc.ThetaX - cone.ThetaX
                                })
                            });
                            result[index] = {
                                time: cone.FovNum - 1,
                                cone: cone.cone.coordinates[0],
                                intersections: intersections
                            };
                            //stopTimeLog();
                            cb(null)
                        }
                    });
            }, function(err) {
                if (err) {
                    callback(err);
                } else {
                    stopTimeLog();
                    mongoDb.close();
                    callback(null, result);
                }
            });
        }
    ], function (err, intersections) {
        if (err) {
            console.err("Error! " + err);
            res.send("Database error!");
        } else {
            //console.log("Number of intersections found: " + intersections.length);
            res.json(intersections);
        }
    });


    var startTime;
    var currString;
    function startTimeLog(string) {
        currString = string;
        startTime = Date.now();
    }

    function stopTimeLog() {
        var time = Date.now() - startTime;
        console.log(currString + " [" + time/1000 + "s]");
        currString = null;
        startTime = null;
    }

};
