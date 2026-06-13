// server.js

import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;

http.createServer((req, res) => {

    let file = req.url === '/'
        ? './examples/mini-app.html'
        : '.' + req.url;

    try {

        const data = fs.readFileSync(file);

        const ext = path.extname(file);

        const types = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css'
        };

        res.writeHead(200, {
            'Content-Type': types[ext] || 'text/plain'
        });

        res.end(data);

    } catch {

        res.writeHead(404);
        res.end('Not Found');

    }

}).listen(PORT);

console.log(`http://localhost:${PORT}`);