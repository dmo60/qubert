/**
 * Created by Carl on 03.07.2015.
 */

var MongoClient = require("mongodb").MongoClient;
var async = require("async");
var config = require("./config");

exports.RequestHandler = function (req, res) {
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
        function (mongoDB, callback) {
           mongoDB.collection("videos").find(
               { },
               { trajectory: 1 }
           ).toArray(function(err, docs) {
               if (err) {
                   callback(err);
               } else {
                   callback(null, docs);
               }
           })
        }
        ], function(err,videos) {
            if (err) {
                console.err("Error! " + err);
                res.send("Database error!");
            } else {
                res.json(videos);
            }
        });
};