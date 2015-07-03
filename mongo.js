var MongoClient = require("mongodb").MongoClient
    , mysql = require("mysql")
    , async = require("async")
    , config = require("./config")
    , geoJson = require("./geoJson");

exports.initialize = function (cb) {
    console.log("Initializing mongo database...");

    var mongoDb;
    var mySqlDb;
    var self = this;

    async.series([
        function (callback) {
            connect(callback);
        },
        function (callback) {
            clear(callback);
        },
        function (callback) {
            buildTrajectories(callback);
        },
        function (callback) {
            buildViewCones(callback);
        },
        function (callback) {
            disconnect(callback);
        }
    ], function (err, results) {
        if (err) {
            console.error("Error! " + err);
            cb(err);
        } else {
            console.log("Success!");
            cb(null);
        }
    });

    function connect(cb) {
        async.parallel([
            // Connect to the Mongo database
            function (callback) {
                console.log("Connecting to mongo...");
                MongoClient.connect(config.MongoUrl, function (err, db) {
                    if (err) {
                        callback(err)
                    } else {
                        self.mongoDb = db;
                        callback(null);
                    }
                });
            },

            // Connect to the MediaQ database
            function (callback) {
                console.log("Connecting to MediaQ database...");
                var db = mysql.createConnection(config.MySql);
                db.connect(function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        self.mySqlDb = db;
                        callback(null)
                    }
                });
            }
        ], function (err, results) {
            cb(err);
        })
    }

    function disconnect(callback) {
        self.mongoDb.close();
        self.mySqlDb.end();
        callback(null);
    }

    // Drop all existing documents
    function clear(callback) {
        console.log("Dropping existing documents...");
        async.series([
            function (callback) {
                self.mongoDb.collection("videos").deleteMany({}, function (err, reply) {
                    callback(err)
                });
            },
            function (callback) {
                self.mongoDb.collection("viewcones").deleteMany({}, function (err, reply) {
                    callback(err)
                });
            }
        ], function (err, results) {
            callback(err);
        });
    }

    function buildTrajectories(cb) {
        async.waterfall([
            // Get a list of videos from the MediaQ server
            function (callback) {
                console.log("Getting list of videos from MediaQ server...");
                // We only want to select videos that have at least two different positions,
                // otherwise we cannot build a valid trajectory later.
                var sql =
                    "SELECT VideoId, Plat, Plng, Keywords FROM VIDEO_METADATA AS t1 " +
                    "WHERE FovNum=1 AND EXISTS (" +
                    "SELECT * FROM VIDEO_METADATA AS t2 WHERE t1.VideoId=t2.VideoId AND " +
                    "(t1.Plat != t2.Plat OR t1.Plng != t2.Plng) )";
                self.mySqlDb.query(sql, function (err, rows) {
                    if (err) {
                        callback(err);
                    } else {
                        rows.forEach(function (video) {
                            // We want the coordinates to be stored as a geo point
                            video.location = new geoJson.Point(video.Plat, video.Plng);
                            delete video.Plat;
                            delete video.Plng;
                        });
                        callback(null, rows);
                    }
                });
            },

            // Load the trajectory for each video
            function (videos, callback) {
                console.log("Loading trajectories for videos...");
                async.each(videos, function (video, callback) {
                    var sql =
                        "SELECT Plat, Plng, TimeCode, ThetaX, ThetaY, ThetaZ, R, Alpha" +
                        " FROM VIDEO_METADATA " +
                        "WHERE VideoId=? ORDER BY TimeCode ASC";

                    self.mySqlDb.query(sql, [video.VideoId], function (err, rows) {
                        if (err) {
                            callback(err);
                        } else {
                            var wayPoints = [];

                            rows.forEach(function (r) {
                                wayPoints.push([r.Plng, r.Plat, parseInt(r.TimeCode), r.ThetaX, r.ThetaY, r.ThetaZ, r.R, r.Alpha]);
                            });

                            video.trajectory = new geoJson.LineString(wayPoints);
                            callback();
                        }
                    });
                }, function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, videos);
                    }
                })
            },

            // Insert all videos into mongo
            function (videos, callback) {
                console.log("Inserting videos into mongo...");
                self.mongoDb.collection("videos").insertMany(videos, function (err, reply) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                })
            },

            // Create an index on the trajectory property
            function (callback) {
                console.log("Creating geo index for trajectory...");
                self.mongoDb.collection("videos").createIndex({trajectory: "2dsphere"}, null, function (err, indexName) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
            },

            // Create an index on the location property
            function (callback) {
                console.log("Creating geo index for location...");
                self.mongoDb.collection("videos").createIndex({location: "2dsphere"}, null, function (err, indexName) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
            }
        ], function (err, result) {
            cb(err);
        })
    }

    function buildViewCones(cb) {
        async.waterfall([
            function (callback) {
                console.log("Getting list of video points from MediaQ server...");
                var sql = "SELECT VideoId, Plat, Plng, ThetaX, TimeCode FROM VIDEO_METADATA";
                self.mySqlDb.query(sql, function (err, rows) {
                    if (err) {
                        callback(err);
                    } else {
                        rows.forEach(function (frame) {
                            frame.cone = getViewConePolygon(frame.Plat, frame.Plng, frame.ThetaX);
                        });
                        callback(null, rows);
                    }
                });
            },

            // Insert all points into mongo
            function (frames, callback) {
                console.log("Inserting points into mongo...");
                var batch = self.mongoDb.collection("viewcones").initializeUnorderedBulkOp({useLegacyOps: true});
                frames.forEach(function (frame) {
                    batch.insert(frame);
                });
                batch.execute(function (err, reply) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                })
            },

            // Create an index on the trajectory property
            function (callback) {
                console.log("Creating geo index for polygons...");
                self.mongoDb.collection("viewcones").createIndex({cone: "2dsphere"}, null, function (err, indexName) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null);
                    }
                });
            }

        ], function (err, result) {
            cb(err);
        })
    }

};

function getViewConePolygon(lat, lng, thetaX) {
    // Fixed view field angle in degrees
    var ALPHA = 45;
    // Fixed view field radius in km
    var RADIUS = 50;

    var p1 = [lng, lat];
    var p2 = getDestinationPoint(lat, lng, thetaX + ALPHA / 2, RADIUS / 1000);
    var p3 = getDestinationPoint(lat, lng, thetaX - ALPHA / 2, RADIUS / 1000);

    return new geoJson.Polygon([[p1, p2, p3, p1]]);
}

// http://stackoverflow.com/a/2637079
function getDestinationPoint(lat, lng, bearing, distance) {
    var earthRadius = 6371;

    var dist = distance / earthRadius;
    var brng = toRad(bearing);

    var lat1 = toRad(lat), lon1 = toRad(lng);

    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) +
        Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));

    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) *
            Math.cos(lat1),
            Math.cos(dist) - Math.sin(lat1) *
            Math.sin(lat2));

    if (isNaN(lat2) || isNaN(lon2)) return null;

    return [toDeg(lon2), toDeg(lat2)];
}

function toRad(deg) {
    return deg * Math.PI / 180;
}

function toDeg(rad) {
    return rad * 180 / Math.PI;
}
