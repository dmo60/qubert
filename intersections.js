var MongoClient = require("mongodb").MongoClient;
var async = require("async");
var config = require("./config");

exports.RequestHandler = function (req, res) {

    var queryVideoId = req.query.videoID;

    async.waterfall([
        function (callback) {
            MongoClient.connect(config.MongoUrl, function (err, db) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, db);
                }
            })
        },

        function (mongoDb, callback) {
            // TODO: only one cone per timecode??
            mongoDb.collection("viewcones")
                .find({VideoId: queryVideoId})
                .sort({TimeCode: 1})
                .toArray(function (err, docs) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, docs, mongoDb);
                    }
                });
        },

        function (queryCones, mongoDb, callback) {
            var queryVideoStartTime = queryCones[0].TimeCode;
            var result = [];
            async.forEachOf(queryCones, function (cone, index, cb) {
                // TODO: aggregate by videoId??
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
                                time: Math.round((cone.TimeCode - queryVideoStartTime) / 1000),
                                cone: cone.cone.coordinates[0],
                                intersections: intersections
                            };
                            cb(null)
                        }
                    });
            }, function(err) {
                if (err) {
                    callback(err);
                } else {
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

};
