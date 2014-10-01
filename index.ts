///<reference path="typings/node/node.d.ts" />

var http = require('http');
var config = require('config');
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');

var dispatchMap = {
    "/compile" : function(req, res) {
        var command = config.emcc.env + ' ' + config.emcc.path + ' ';
        console.log(req.body);
        var child = exec(config.emcc.path + ' ', function(error, stdout, stderr) {
            var j = { error: error, message: stdout };
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write(JSON.stringify(j));
            res.end('\n');
        });
    }
};

var server = http.createServer(function(req, res) {
    var data = "";
    req.on('data', function(chunk) {
        data += chunk.toString();
    });

    req.on('end', function() {
        var body = "";
        try {
            body = JSON.parse(data);
            req.body = body;
            var m = dispatchMap[req.url];
            if(m) {
                m(req, res);
            } else {
                res.writeHead(404, {'Content-Type': 'application/json'});
                res.end('{}\n');
            }
        } catch(e) {
            res.writeHead(400, {'Content-Type': 'text/plain'});
            res.end('Bad Request\n');
        }
    });
});


console.log(config);
console.log("server start port:" + config.server.port);
server.listen(config.server.port, config.server.host);

