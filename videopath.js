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
            mongoDb.collection("videos").findOne({VideoId: queryVideoId}, {fields: {trajectory: 1}}, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    mongoDb.close();
                    callback(null, result);
                }
            });
        }
    ], function (err, result) {
        if (err) {
            console.error("Error! " + err);
            res.send("Database error!");
        } else {
            res.json(result.trajectory.coordinates);
        }
    });
};
