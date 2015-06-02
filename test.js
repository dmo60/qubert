/**
 * Created by Alexander on 02.06.2015.
 */
var express    = require("express");
var mysql      = require('mysql');
var connection = mysql.createConnection({
    host     : 'mediaq.dbs.ifi.lmu.de',
    user     : 'student',
    password : 'tneduts',
    database : 'MediaQ_V2'
});
var app = express();

connection.connect(function(err){
    if(!err) {
        console.log("Database is connected ... \n\n");
    } else {
        console.log("Error connecting database ... \n\n");
    }
});

app.get("/",function(req,res){
    connection.query('SELECT * from VIDEO_INFO', function(err, rows, fields) {
        connection.end();
        if (!err)
            console.log('The solution is: ', rows);
        else
            console.log('Error while performing Query.');
    });
});

app.listen(3000);