/* TENN Site Tracker — HTTP server (no dependencies).
   Serves the SPA from public/, the JSON API from /api/*, and
   auth-gated photo uploads from /uploads/*. */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { handle } = require('./api');
const { sessionUser, UPLOADS_DIR } = require('./db');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon',
};

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function json(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders });
  res.end(body);
}

function readBody(req, limit = 40 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('Payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  req.sessionToken = parseCookies(req).session || null;

  try {
    /* ---- API ---- */
    if (pathname.startsWith('/api/')) {
      let body = null;
      if (req.method === 'POST' || req.method === 'PATCH') {
        // CSRF guard: JSON content type is required (cross-site forms can't send it)
        if (!/application\/json/.test(req.headers['content-type'] || ''))
          return json(res, 400, { error: 'JSON body required' });
        try { body = JSON.parse((await readBody(req)).toString('utf8') || '{}'); }
        catch { return json(res, 400, { error: 'Invalid JSON' }); }
      }
      const result = handle(req, req.method, pathname, body);
      const headers = {};
      if (result?._setCookie) {
        headers['Set-Cookie'] = `session=${result._setCookie}; HttpOnly; Path=/; Max-Age=${90 * 86400}; SameSite=Lax`;
        delete result._setCookie;
      }
      if (result?._clearCookie) {
        headers['Set-Cookie'] = 'session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';
        delete result._clearCookie;
      }
      const status = result?._status || 200;
      if (result?._status) delete result._status;
      return json(res, status, result, headers);
    }

    /* ---- uploaded photos (login required) ---- */
    if (pathname.startsWith('/uploads/')) {
      if (!sessionUser(req.sessionToken)) return json(res, 401, { error: 'Login required' });
      const name = path.basename(pathname); // no traversal
      const file = path.join(UPLOADS_DIR, name);
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' });
      return fs.createReadStream(file).pipe(res);
    }

    /* ---- static SPA ---- */
    let rel = pathname === '/' ? '/index.html' : pathname;
    let file = path.join(PUBLIC_DIR, path.normalize(rel));
    if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    return fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: 'Server error' });
  }
});

server.listen(PORT, () => console.log(`TENN Site Tracker running on http://localhost:${PORT}`));
