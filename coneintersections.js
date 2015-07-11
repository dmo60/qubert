/**
 * Created by Alexander on 09.07.2015.
 */
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
            startTimeLog("Get query video hull");
            mongoDb.collection("videos")
                .findOne({VideoId: queryVideoId}, function(err, video) {
                    if (err) {
                        callback(err);
                    } else {
                        stopTimeLog();
                        callback(null, video.hull, mongoDb);
                    }
                });
        },

        function(queryHull, mongoDb, callback) {
            startTimeLog("Find candidate videos");
            mongoDb.collection("videos")
                .find({
                    VideoId: {$ne: queryVideoId},
                    hull: {
                        $geoIntersects: {
                            $geometry: queryHull
                        }
                    }
                })
                .toArray(function(err, docs) {
                    if (err) {
                        callback(err);
                    } else {
                        var ids = [];
                        docs.forEach(function(doc) {
                            ids.push(doc.VideoId);
                        });
                        stopTimeLog();
                        callback(null, ids, mongoDb);
                    }
                });
        },

        function (candidateVideos, mongoDb, callback) {
            startTimeLog("Get view cones for query video");
            mongoDb.collection("viewcones")
                .find({VideoId: queryVideoId})
                .sort({FovNum: 1})
                .toArray(function (err, docs) {
                    if (err) {
                        callback(err);
                    } else {
                        stopTimeLog();
                        callback(null, candidateVideos, docs, mongoDb);
                    }
                });
        },

        function (candidateVideos, queryCones, mongoDb, callback) {
            startTimeLog("Find intersections for each view cone");
            var result = [];
            async.forEachOf(queryCones, function (cone, index, cb) {
                // TODO: aggregate by videoId??
                mongoDb.collection("viewcones")
                    .find({
                        VideoId: {$in: candidateVideos},
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
            console.error("Error! " + err);
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
