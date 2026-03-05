#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { compile } = require('../compiler');

const PORT = parseInt(process.env.PORT) || 3456;
const DIR = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
};

const server = http.createServer((req, res) => {
  // POST /compile — .wled source → .wfx binary
  if (req.method === 'POST' && req.url === '/compile') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const binary = compile(body);
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(Buffer.from(binary));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end(e.message);
      }
    });
    return;
  }

  // GET — serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(DIR, filePath);

  // Security: stay within DIR
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`WFX Simulator running at ${url}`);

  // Auto-open browser
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? 'start' :
              process.platform === 'darwin' ? 'open' : 'xdg-open';
  exec(`${cmd} ${url}`);
});
