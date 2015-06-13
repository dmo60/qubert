var MongoClient = require('mongodb').MongoClient

function handleTest(req, res) {
    // Connection URL
    var url = 'mongodb://localhost:27017/qubert';
    // Use connect method to connect to the Server
    MongoClient.connect(url, function(err, db) {
        if (!err) {
            console.log("Connected correctly to server");
            res.send("Connected!");
        } else {
            console.log(err);
            res.send("Error!");
        }
        db.close();
    });
}

exports.handleTest = handleTest;
