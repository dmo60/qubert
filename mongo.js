var MongoClient = require("mongodb").MongoClient
    , mysql = require("mysql")
    , async = require("async")
    , config = require("./config")
    , geoJson = require("./geoJson")
    , hull = require("hull.js");

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
            buildHulls(callback);
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
                // TODO: also allow points!
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
                        "SELECT FovNum, Plat, Plng, TimeCode, ThetaX, ThetaY, ThetaZ, R, Alpha" +
                        " FROM VIDEO_METADATA " +
                        "WHERE VideoId=? ORDER BY FovNum ASC";

                    self.mySqlDb.query(sql, [video.VideoId], function (err, rows) {
                        if (err) {
                            callback(err);
                        } else {
                            var wayPoints = [];

                            rows.forEach(function (r) {
                                wayPoints.push([r.Plng, r.Plat, r.FovNum, parseInt(r.TimeCode), r.ThetaX, r.ThetaY, r.ThetaZ, r.R, r.Alpha]);
                            });

                            var distances = [];
                            var averageDistance = 0;
                            for (var i = 0; i < wayPoints.length; i++) {

                                var current = wayPoints[i];
                                var neighbourPoints = [];
                                //previous point
                                if (i > 0)
                                    neighbourPoints.push(wayPoints[i - 1]);
                                //next point
                                if (i < wayPoints.length - 1)
                                    neighbourPoints.push(wayPoints[i + 1]);


                                var distancesCurrent = []
                                for (var j = 0; j < neighbourPoints.length; j++) {
                                    var distanceVector = [Math.abs(current[0] - neighbourPoints[j][0]), Math.abs(current[1] - neighbourPoints[j][1])];
                                    distancesCurrent.push(Math.sqrt(distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1]));
                                }
                                var distance = Math.min.apply(Math, distancesCurrent);
                                distances.push(distance);
                                averageDistance += distance;
                                //magic number 0.006
                            }
                            averageDistance /= parseFloat(distances.length);
                            if (averageDistance != 0) {
                                for (var i = 0; i < wayPoints.length; i++) {
                                    var current = wayPoints[i];
                                    var neighbourPoints = [];
                                    //previous point
                                    if (i > 0)
                                        neighbourPoints.push(wayPoints[i - 1]);
                                    //next point
                                    if (i < wayPoints.length - 1)
                                        neighbourPoints.push(wayPoints[i + 1]);


                                    if (distances[i] > averageDistance) {
                                        if (i < 1) {

                                            //first one
                                            current = neighbourPoints[0];
                                            //video.location = new geoJson.Point(current[1], current[0]);
                                        } else if (i < wayPoints.length - 1) {
                                            //middle ones
                                            current[0] = (neighbourPoints[1][0] + neighbourPoints[0][0]) / 2.0;
                                            current[1] = (neighbourPoints[1][1] + neighbourPoints[0][1]) / 2.0;
                                            wayPoints[i] = current;

                                        } else {
                                            current = neighbourPoints[0];
                                        }

                                    }

                                }
                            }

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
                var cones = [];
                self.mongoDb.collection("videos").find({}).toArray(function (err, docs) {
                   if (err) {
                       callback(err);
                   } else {
                       docs.forEach(function(video) {
                           video.trajectory.coordinates.forEach(function(point) {
                                cones.push({
                                    VideoId: video.VideoId,
                                    Plat: point[1],
                                    Plng: point[0],
                                    FovNum: point[2],
                                    TimeCode: point[3],
                                    ThetaX: point[4],
                                    cone: getViewConePolygon(point[1], point[0], point[4])
                                })
                           });
                       });
                       callback(null, cones);
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

    function buildHulls(cb) {
        async.waterfall([
            function (callback) {
                self.mongoDb.collection("videos").find({}, {VideoId: 1}).toArray(function (err, docs) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, docs);
                    }
                });
            },

            function (videos, callback) {
                console.log("Calculate hull for videos...");
                async.forEach(videos, function (video, cb) {
                    self.mongoDb.collection("viewcones")
                        .find({VideoId: video.VideoId})
                        .toArray(function (err, docs) {
                            var points = [];
                            docs.forEach(function (cone) {
                                points = points.concat(cone.cone.coordinates[0]);
                            });

                            var hullPoints = hull(points, 1);
                            var hullPolygon = new geoJson.Polygon([hullPoints]);

                            self.mongoDb.collection("videos").findOneAndUpdate(
                                {VideoId: video.VideoId},
                                {$set: {hull: hullPolygon}},
                                function (err, r) {
                                    cb(err);
                                })
                        })
                }, callback)
            },

            function (callback) {
                console.log("Creating geo index for hull polygons...");
                self.mongoDb.collection("videos").createIndex({hull: "2dsphere"}, null, function (err, indexName) {
                    callback(err);
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
