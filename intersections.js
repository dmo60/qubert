/**
 * Created by Fabian on 12.06.2015.
 */
var MongoClient = require("mongodb").MongoClient;
var async = require("async");
var config = require("./config");

exports.RequestHandler = function (req, res) {

    var queryVideoId = req.query.videoID;
    var minDistance = parseInt(req.query.minDistance);

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
            mongoDb.collection("videos").findOne({VideoId: queryVideoId}, {fields: {trajectory: 1}}, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, result.trajectory, mongoDb);
                }
            });
        },

        function (queryTrajectory, mongoDb, callback) {
            mongoDb.collection("videos").find({
                VideoId: {$ne: queryVideoId},
                distance: {$gte: minDistance},
                trajectory: {
                    $geoIntersects: {
                        $geometry: queryTrajectory
                    }
                }
            }).toArray(function (err, docs) {
                mongoDb.close();
                if (err) {
                    callback(err);
                } else {
                    callback(null, docs,queryTrajectory)
                }
            });
        }
    ], function (err, videos,queryTrajectory) {
        if (err) {
            console.err("Error! " + err);
            res.send("Database error!");
        } else {
            console.log("Number of videos found: " + videos.length);
            var gju = require('geojson-utils');
            var result={};
            result.videos=videos;
            result.points=[];
            videos.forEach(function (video) {
                if(video.trajectory!=undefined)
                result.points.push(gju.lineStringsIntersect(video.trajectory,
                    queryTrajectory));
            });
            res.json(result);
        }
    });

};
