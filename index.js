///<reference path="typings/node/node.d.ts" />
var http = require('http');
//var crypto = require('crypto');
var tmp = require('tmp');
var config = require('config');
var exec = require('exec-sync');
var fs = require('fs');
var path = require('path');
var MongoClient = require('mongodb').MongoClient;
var mongopath = 'mongodb://' + config.mongo.host + '/' + config.mongo.database;
var coll;
function genResponse(res, j) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(j));
    res.end('\n');
}
var dispatchMap = {
    "/compile": function (req, res) {
        var command = config.emcc.env + ' ' + config.emcc.path + ' ' + config.emcc.option + ' ';
        //var tempfile = getTempFilePath("___");
        //ファイルの保存->コンパイル->(mongo)->リターン
        tmp.file({ prefix: 'aspen', postfix: '.c' }, function (err, tempfile, fd) {
            fs.writeFileSync(tempfile, req.body.source);
            var exec_command = command + ' ' + tempfile + ' -o ' + tempfile + '.js';
            console.log(exec_command);
            var out = exec(exec_command, true);
            var stdout = out.stdout;
            var stderr = out.stderr;
            var exists = fs.existsSync(tempfile + '.js');
            if (exists) {
                var data = fs.readFileSync(tempfile + '.js');
                var j = { error: stderr, message: stdout, source: data.toString(), runnable: true };
                genResponse(res, j);
                var date = new Date();
                var mongo_data = {
                    error: stderr,
                    message: stdout,
                    source: req.body.source,
                    time: date.toISOString(),
                    unix_time: date.getTime(),
                    user_id: req.body.userId,
                    subject_id: req.body.subjectId,
                    runnable: true
                };
                coll.insert(mongo_data, function (err, docs) {
                    //console.log(docs);
                });
            }
            else {
                var error_j = { error: stderr, message: stdout, source: "", runnable: false };
                genResponse(res, error_j);
            }
        });
    }
};
var server = http.createServer(function (req, res) {
    var data = "";
    req.on('data', function (chunk) {
        data += chunk.toString();
    });
    req.on('end', function () {
        var body = "";
        try {
            body = JSON.parse(data);
            req.body = body;
            var m = dispatchMap[req.url];
            if (m) {
                m(req, res);
            }
            else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end('Not found\n');
            }
        }
        catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            console.log(e);
            res.end('{"err": "Bad Request"}\n');
        }
    });
});
MongoClient.connect(mongopath, function (err, db) {
    if (err)
        throw err;
    coll = db.collection('raw_compile_data');
    console.log("server start port:" + config.server.port);
    server.listen(config.server.port, config.server.host);
});
