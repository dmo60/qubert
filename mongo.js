var MongoClient = require("mongodb").MongoClient
    , mysql = require("mysql")
    , async = require("async")
    , config = require("./config");

exports.initialize = function (cb) {
    console.log("Initializing mongo database...");

    async.waterfall([
        // Connect to the Mongo database first
        function (callback) {
            console.log("Connecting to mongo...");
            MongoClient.connect(config.MongoUrl, callback);
        },

        // Then drop all existing documents
        function (mongoDb, callback) {
            console.log("Dropping existing documents...");
            mongoDb.collection("videos").deleteMany({}, function (err, reply) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, mongoDb);
                }
            });
        },

        // Finally get all video data from the MediaQ server and insert it into Mongo
        function (mongoDb, callback) {
            console.log("Getting video data from MediaQ server...");

            var videos = mongoDb.collection("videos");
            var mySqlDb = mysql.createConnection(config.MySql);

            var sql = "SELECT VideoId, FovNum, Plat, Plng, ThetaX, ThetaY, ThetaZ, TimeCode, Keywords " +
                "FROM VIDEO_METADATA";
            var query = mySqlDb.query(sql);
            query
                .on("error", function (err) {
                    callback(err);
                })
                .on("result", function (row) {
                    mySqlDb.pause();

                    // We want the coordinates to be stored as a geo point
                    row.coords = [row.Plat, row.Plng];
                    delete row.Plat;
                    delete row.Plng;

                    videos.insertOne(row, function (err, r) {
                        if (err) {
                            callback(err);
                        }
                        mySqlDb.resume();
                    });
                })
                .on("end", function () {
                    mySqlDb.end();
                    mongoDb.close();
                    callback(null, "Done!");
                });
        }

    ], function (err, result) {
        if (err) {
            console.log("Error! " + err);
            cb(err);
        } else {
            console.log(result);
            cb(null);
        }
    });
};
