var MongoClient = require("mongodb").MongoClient
    , mysql = require("mysql")
    , async = require("async")
    , config = require("./config")
    , geoJson = require("./geoJson")
    , hull = require("hull.js")
    , Victor = require("victor");

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

    function deleteOne(callback, videoID) {
        console.log("Removing " + videoID + " from Database");
        async.series([
            function (callback) {
                self.mongoDb.collection("videos").deleteOne({VideoId : videoID}, function (err, reply) {
                    callback(err);
                });
            }
        ]);
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
                var logForVideo = ""; //leave empty if no log desired
                var minimumWaypoints = 20;
                var maxArtificialWaypoints = 5;
                var videosToDelete = [];

                async.forEachOf(videos, function (video, key, callback) {
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

                            if (wayPoints.length < minimumWaypoints) {
                                videosToDelete.push(video.VideoId);
                                console.log("added " + video.VideoId + " to array");
                            }

                            if (video.VideoId == logForVideo) {
                                console.log("Process for Video " + video.VideoId);
                            }

                            // summarize points where distance == 0
                            var noDistCounter = 0;
                            // summarize points whose distance is too big
                            var tooLongCounter = 0;

                            //even out outliers
                            var distances = []; //

                            var averageDistance = 0;
                            var avDCounter = 0;
                            for (var i = 0; i < wayPoints.length; i++) {
                                // var current = wayPoints[i];
                                var currentV = new Victor(wayPoints[i][0], wayPoints[i][1]);
                                var nextV, prevV;
                                //var neighbourPoints = [];
                                //   neighbourPoints.push(wayPoints[i - 1]);


                                if (i < wayPoints.length - 1) {
                                    // neighbourPoints.push(wayPoints[i + 1]);
                                    nextV = new Victor(wayPoints[i+1][0], wayPoints[i+1][1]);
                                    if (video.VideoId == logForVideo) {
                                        console.log("Next WayPoint: " + (i+1) + ": "+ nextV.toString());
                                    }
                                }
                                if (i < 1) {
                                    distances.push(currentV.clone().distance(nextV));
                                    if (video.VideoId == logForVideo) {
                                        console.log("Current WayPoint No. " + i + ": "+ currentV.toString());
                                        console.log("Distances Entry nr. " + i + " " + currentV.clone().distance(nextV) );
                                    }
                                } else {
                                    prevV = new Victor(wayPoints[i-1][0], wayPoints[i-1][1]);

                                    currMinDistance = Math.min(currentV.clone().distance(nextV),currentV.clone().distance(prevV));

                                    if (video.VideoId == logForVideo) {
                                        console.log("WayPoint No. " + i + ": "+ currentV.toString());
                                        console.log("Distances Entry nr. " + i + " " + currMinDistance );
                                    }

                                    //save distance to next point for error calculation
                                    distances.push(currentV.clone().distance(nextV));
                                    if (currMinDistance != 0) {
                                        averageDistance += currMinDistance;
                                        avDCounter++;
                                    }
                                }

                                     //distancesCurrent.push(Math.min(currentV.distance(prevV),currentV.distance((nextV))));

                                //for (var j = 0; j < neighbourPoints.length; j++) {

                                //    var distanceVector = [Math.abs(current[0] - neighbourPoints[j][0]), Math.abs(current[1] - neighbourPoints[j][1])];
                                //    distancesCurrent.push(Math.sqrt(distanceVector[0] * distanceVector[0] + distanceVector[1] * distanceVector[1]));
                                //}
                                //var distance = Math.min.apply(Math, distancesCurrent);
                                //distances.push(distance);
                                // averageDistance += distance;

                                //magic number 0.006
                            }
                            if (averageDistance != 0) {
                                averageDistance /= parseFloat(avDCounter);
                            }
                            if (video.VideoId == logForVideo) {
                                console.log("Average Distance is " + averageDistance );
                                console.log("Number of entries= " + avDCounter);
                            }


                            if (averageDistance != 0) {
                                for (i = 0; i < wayPoints.length; i++) {
                                    currentV = new Victor(wayPoints[i][0], wayPoints[i][1]);
                                    if (video.VideoId == logForVideo) {
                                        console.log("Current Point: " + i + ": " + currentV );
                                    }
                                    //var neighbourPoints = [];
                                    //previous point
                                    //if (i > 0)
                                    //    neighbourPoints.push(wayPoints[i - 1]);
                                    //next point
                                   // if (i < wayPoints.length - 1)
                                    //    neighbourPoints.push(wayPoints[i + 1]);

                                    var currMinDistance = distances[i];

                                    if (i < wayPoints.length - 1) {
                                        if (currMinDistance > averageDistance) {
                                            if (video.VideoId == logForVideo) {
                                                console.log("The distance is too damn high at Index " + i + "current:" + currMinDistance);
                                            }

                                            // distance beyond average
                                            if (tooLongCounter == 0 && i > 0) { //save last good point
                                                wayPoints[i][0] = currentV.x;
                                                wayPoints[i][1] = currentV.y;
                                                if (video.VideoId == logForVideo) {
                                                    console.log("Saved Point: Index " + i + "current:" + currentV.toString());
                                                }
                                            }
                                            tooLongCounter++;
                                        } else if (currMinDistance == 0) {
                                            if (video.VideoId == logForVideo) {
                                                console.log("The distance is zero at Index " + i + "current:" + currMinDistance);
                                            }
                                            // distance exactly 0 -> cell position
                                            if (noDistCounter == 0) { //save last good point
                                                wayPoints[i][0] = currentV.x;
                                                wayPoints[i][1] = currentV.y;
                                                if (video.VideoId == logForVideo) {
                                                    console.log("Saved Point: Index " + i + "current:" + currentV.toString() + " to waypoints array");
                                                }
                                            }
                                            noDistCounter++;
                                        } else {
                                            if (video.VideoId == logForVideo) {
                                                console.log("Normal Distance at Index " + i + "current:" + currMinDistance);
                                            }
                                            //so this is a good point
                                            if (tooLongCounter > 0 || noDistCounter > 0) {
                                                var falsePoints = tooLongCounter + noDistCounter;
                                                var saveCount = falsePoints;
                                                if (i-falsePoints > 0) { //if things weren't already wrong from the beginning
                                                    if (video.VideoId == logForVideo) {
                                                        console.log("Error is in the middle" + i);
                                                    }
                                                    //last point before things got weird
                                                    var lastLongV = new Victor(wayPoints[i-falsePoints][0],wayPoints[i-falsePoints][1]);
                                                    if (video.VideoId == logForVideo) {

                                                        console.log("Last Regular Point: Index " + (i-falsePoints) + "coords:" + lastLongV.toString());
                                                    }
                                                    falsePoints--;
                                                    var o = 1;
                                                    while (falsePoints != 0) {
                                                        //TODO: do vector magic
                                                        interpol = lastLongV.clone().mix(currentV, o / saveCount);
                                                        wayPoints[i-falsePoints][0]=interpol.x;
                                                        wayPoints[i-falsePoints][1]=interpol.y;

                                                        if (video.VideoId == logForVideo) {
                                                            console.log("Interpolate: Index " + (i-falsePoints) + "coords:" + interpol.toString());
                                                        }

                                                        falsePoints--;
                                                        o++;
                                                    }
                                                } else {
                                                    // if video metadata was wrong from the beginning, fill up with first valid point and
                                                    // save disance 0 in distances array
                                                    // finally save first valid point as start point

                                                    if (video.VideoId == logForVideo) {
                                                        console.log("Was wrong from the beginning: Index " + i + " :" + currentV.toString());
                                                    }
                                                    var u = 1;
                                                    nextV = new Victor(wayPoints[i+1][0],wayPoints[i+1][1]);
                                                    nextV.subtract(currentV); // save distance vector to nextV in nextV
                                                    if (video.VideoId == logForVideo) {
                                                        console.log("First Regular Distance: Index " + i + " coords:" + nextV.toString());
                                                    }
                                                    var currentCopy = currentV.clone(); //get a copy of currentV to work with
                                                    while(falsePoints > 0) {
                                                        if (u <= maxArtificialWaypoints) {
                                                            currentCopy.subtract(nextV);
                                                            distances[i-u] = nextV.length();
                                                        } else {
                                                            distances[i-u] = 0;
                                                        }
                                                        wayPoints[i-u][0] = currentCopy.x;
                                                        wayPoints[i-u][1] = currentCopy.y;
                                                        if (video.VideoId == logForVideo) {
                                                            console.log("Added artificial point at " + currentCopy.toString());
                                                        }
                                                        falsePoints--;
                                                        u++;
                                                    }
                                                    if (video.VideoId == logForVideo) {
                                                        console.log("Setting Point " + currentCopy.toString() + " as new start point");
                                                        console.log("Previous Start Point was :" + video.location.coordinates[0] + "," + video.location.coordinates[1]);
                                                        console.log()
                                                    }
                                                    //video.location = new geoJson.Point(currentCopy.x,currentCopy.y);
                                                    video.location.coordinates[0] = currentCopy.x;
                                                    video.location.coordinates[1] = currentCopy.y;

                                                }
                                                tooLongCounter = 0;
                                                noDistCounter = 0;
                                            }
                                            else {
                                                //TODO: take point as is
                                                if (video.VideoId == logForVideo) {
                                                    console.log("Regular Point: Index " + i + "coords:" + currentV.toString());
                                                }
                                                wayPoints[i][0] = currentV.x;
                                                wayPoints[i][1] = currentV.y;
                                            }
                                        }
                                    }
                                    else {
                                        //TODO: handle last point
                                    }


                                    //if (distances[i] > averageDistance) {
                                    //    if (i < 1) {
                                    //        //TODO: if first one is an outlier, reduce it to average length
                                    //
                                    //        current = neighbourPoints[0];
                                    //        //video.location = new geoJson.Point(current[1], current[0]);
                                    //    } else if (i < wayPoints.length - 1) {
                                    //        //middle ones
                                    //        var lastV = new Victor(wayPoints[i-1][0], wayPoints[i-1][1]);
                                    //        //find middle point between two neighbours
                                    //
                                    //
                                    //        current[0] = (neighbourPoints[1][0] + neighbourPoints[0][0]) / 2.0;
                                    //        current[1] = (neighbourPoints[1][1] + neighbourPoints[0][1]) / 2.0;
                                    //        wayPoints[i] = current;
                                    //
                                    //    } else {
                                    //        //last one
                                    //        current = neighbourPoints[0];
                                    //    }
                                    //}
                                }
                            }
                            //console.log("VideoID:"+video._id);
                            //videos.remove(video.id);

                            video.trajectory = new geoJson.LineString(wayPoints);
                            callback(null);
                        }
                    });
                }, function (err) {
                    if (err) {
                        callback(err);
                    } else {
                        callback(null, videos, videosToDelete);
                    }
                })
            },

            //filer function
            function (videos, skip, callback) {
                console.log("Videos to filter: " + videos.length + ". Objects to exclude:" + skip.length);
                async.reject(videos, function(item, callback) {
                    var i = 0;
                    for (var i = 0; i < skip.length; i++) {
                        if (skip[i] == item.VideoId) {
                            return callback(true);
                        }
                        //console.log("to compare:" + skip[i] + "\n with " + item.VideoId);
                    }
                    return callback(false);
                }, function(results) {
                        callback(null, results);
                })
            },

            // Insert all videos into mongo
            function (videos, callback) {
                console.log("Inserting " + videos.length + " videos into mongo...");
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
