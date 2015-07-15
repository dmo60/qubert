var mongo = require("./mongo");

exports.RequestHandler = function (req, res) {

    mongo.initialize(function(err) {
        if (err) {
            res.send("Error!");
        } else {
            res.send("Success!");
        }
    });

};
