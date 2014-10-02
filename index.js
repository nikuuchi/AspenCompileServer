///<reference path="typings/node/node.d.ts" />
var http = require('http');
var crypto = require('crypto');
var config = require('config');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');

var MongoClient = require('mongodb').MongoClient;

var mongopath = 'mongodb://' + config.mongo.host + '/' + config.mongo.database;

function getTempFilePath(prefix) {
    return config.out.path + prefix + crypto.randomBytes(8).readInt32LE(0) + '.c';
}

function genResponse(res, j) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(j));
    res.end('\n');
}

var dispatchMap = {
    "/compile": function (req, res) {
        var command = config.emcc.env + ' ' + config.emcc.path + ' ' + config.emcc.option + ' ';
        var tempfile = getTempFilePath("___");

        //ファイルの保存->コンパイル->(mongo)->リターン
        console.log(tempfile);
        fs.writeFileSync(tempfile, req.body.source);
        var exec_command = command + ' ' + tempfile + ' -o ' + tempfile + '.js';
        exec(exec_command, function (error, stdout, stderr) {
            fs.exists(tempfile + '.js', function (exists) {
                console.log(exists);
                if (exists) {
                    fs.readFile(tempfile + '.js', function (err, data) {
                        console.log(data);
                        var j = { error: stderr, message: stdout, source: data.toString(), runnable: true };
                        genResponse(res, j);

                        MongoClient.connect(mongopath, function (err, db) {
                            if (err)
                                throw err;
                            var collection = db.collection('raw_compile_data');
                            var date = new Date();
                            var data = {
                                error: stderr,
                                message: stdout,
                                source: req.body.source,
                                time: date.toISOString(),
                                unix_time: date.getTime(),
                                user_id: req.body.userId,
                                subject_id: req.body.subjectId,
                                runnable: true
                            };
                            collection.insert(data, function (err, docs) {
                                console.log(docs);
                            });
                        });
                    });
                } else {
                    var j = { error: stderr, message: stdout, source: "", runnable: false };
                    genResponse(res, j);
                }
            });
        });
    }
};

var server = http.createServer(function (req, res) {
    console.log(req.method);
    var data = "";
    req.on('data', function (chunk) {
        data += chunk.toString();
    });

    req.on('end', function () {
        var body = "";
        try  {
            body = JSON.parse(data);
            req.body = body;
            var m = dispatchMap[req.url];
            if (m) {
                m(req, res);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end('Not found\n');
            }
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Bad Request\n');
        }
    });
});

console.log(config);
console.log("server start port:" + config.server.port);
server.listen(config.server.port, config.server.host);
