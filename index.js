///<reference path="typings/node/node.d.ts" />
var http = require('http');
var config = require('config');
var server = http.createServer(function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('hello\n');
});

console.log(config);
console.log("server start port:" + config.server.port);
server.listen(config.server.port, config.server.host);
