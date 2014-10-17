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
var coll_compile_data;
var coll_poplar_data;
function genResponse(res, j) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(j));
    res.end('\n');
}
function createFileAndExec(tempfile, source, command, suffix, callback) {
    fs.writeFileSync(tempfile, source);
    var out = exec(command, true);
    callback(out.stdout, out.stderr, fs.existsSync(tempfile + suffix));
}
function insertCompileData(error, message, source, user_id, subject_id, runnable) {
    var date = new Date();
    var mongo_data = {
        error: error,
        message: message,
        source: source,
        time: date.toISOString(),
        unix_time: date.getTime(),
        user_id: user_id,
        subject_id: subject_id,
        runnable: runnable
    };
    coll_compile_data.insert(mongo_data, function (err, docs) {
        //console.log(docs);
    });
}
function insertPoplarData(error, message, source, dest, user_id, subject_id) {
    var date = new Date();
    var mongo_data = {
        error: error,
        message: message,
        source: source,
        dest: dest,
        time: date.toISOString(),
        unix_time: date.getTime(),
        user_id: user_id,
        subject_id: subject_id
    };
    coll_poplar_data.insert(mongo_data, function (err, docs) {
        //console.log(docs);
    });
}
var dispatchMap = {
    "/compile": function (req, res) {
        var command = config.emcc.env + ' ' + config.emcc.path + ' ' + config.emcc.option + ' ';
        //ファイルの保存->コンパイル->(mongo)->リターン
        tmp.file({ prefix: 'aspen', postfix: '.c' }, function (err, tempfile, fd) {
            if (err) {
                console.log(err);
                return;
            }
            var exec_command = command + ' ' + tempfile + ' -o ' + tempfile + '.js';
            console.log(exec_command);
            createFileAndExec(tempfile, req.body.source, exec_command, '.js', function (stdout, stderr, exists) {
                if (exists) {
                    var data = fs.readFileSync(tempfile + '.js');
                    var j = { error: stderr, message: stdout, source: data.toString(), runnable: true };
                    genResponse(res, j);
                    insertCompileData(stderr, stdout, req.body.source, req.body.userId, req.body.subjectId, true);
                }
                else {
                    var error_j = { error: stderr, message: stdout, source: "", runnable: false };
                    genResponse(res, error_j);
                    insertCompileData(stderr, stdout, req.body.source, req.body.userId, req.body.subjectId, false);
                }
            });
        });
    },
    "/poplar": function (req, res) {
        var command = config.poplar.env + ' java -jar ' + config.poplar.path + ' ' + config.poplar.option + ' ';
        //ファイルの保存->poplar->(mongo)->リターン
        tmp.file({ prefix: 'poplar', postfix: '.c' }, function (err, tempfile, fd) {
            if (err) {
                console.log(err);
                return;
            }
            var exec_command = command + ' -f ' + tempfile + ' -o ' + tempfile + '_rev.c';
            console.log(exec_command);
            createFileAndExec(tempfile, req.body.source, exec_command, '_rev.c', function (stdout, stderr, exists) {
                if (exists) {
                    var data = fs.readFileSync(tempfile + '_rev.c');
                    var j = { error: stderr, message: stdout, source: data.toString(), runnable: true };
                    genResponse(res, j);
                    insertPoplarData(stderr, stdout, req.body.source, data.toString(), req.body.userId, req.body.subjectId);
                }
                else {
                    var error_j = { error: stderr, message: stdout, source: req.body.source, runnable: false };
                    genResponse(res, error_j);
                    insertPoplarData(stderr, stdout, req.body.source, req.body.source, req.body.userId, req.body.subjectId);
                }
            });
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
    coll_compile_data = db.collection('raw_compile_data');
    coll_poplar_data = db.collection('raw_poplar_data');
    console.log("server start port:" + config.server.port);
    server.listen(config.server.port, config.server.host);
});
