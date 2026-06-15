// runtime/server.js
// HTTP server namespace for Future.
// Uses Node.js built-in http module — no external dependencies.
//
// Usage in Future:
//   server.get("/api/users")
//     users = db.query("SELECT * FROM users")
//     return users
//   end
//
//   server.post("/api/users")
//     name = req.body.name
//     db.insert("users", { name: name })
//     return { ok: true }
//   end
//
//   server.listen(3000)
//   print "API running on port 3000"
//
// req object inside route handlers:
//   req.method   — "GET", "POST", etc.
//   req.path     — pathname, e.g. "/api/users"
//   req.params   — path parameters, e.g. { id: "42" } for route "/users/:id"
//   req.query    — parsed query string, e.g. { page: "1" }
//   req.body     — parsed JSON body (POST/PUT/PATCH only)
//   req.headers  — request headers object

import { createServer } from 'node:http';
import { URL } from 'node:url';

const _routes = { GET: [], POST: [], PUT: [], DELETE: [], PATCH: [] };
let _server = null;

function matchRoute(routes, pathname) {
  for (const route of routes) {
    const params = {};
    const rParts = route.pattern.split('/');
    const pParts = pathname.split('/');
    if (rParts.length !== pParts.length) continue;
    let match = true;
    for (let i = 0; i < rParts.length; i++) {
      if (rParts[i].startsWith(':')) {
        params[rParts[i].slice(1)] = decodeURIComponent(pParts[i]);
      } else if (rParts[i] !== pParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler: route.handler, params };
  }
  return null;
}

function addRoute(method, pattern, handler) {
  if (!_routes[method]) _routes[method] = [];
  _routes[method].push({ pattern, handler });
}

export const get    = (path, handler) => addRoute('GET',    path, handler);
export const post   = (path, handler) => addRoute('POST',   path, handler);
export const put    = (path, handler) => addRoute('PUT',    path, handler);
export const patch  = (path, handler) => addRoute('PATCH',  path, handler);

function _delete(path, handler) { addRoute('DELETE', path, handler); }
export { _delete as delete };

export async function listen(port = 3000) {
  if (_server) throw new Error('server.listen() already called');

  _server = createServer(async (nodeReq, nodeRes) => {
    const base = `http://localhost:${port}`;
    const url  = new URL(nodeReq.url ?? '/', base);
    const method   = nodeReq.method?.toUpperCase() ?? 'GET';
    const pathname = url.pathname;

    // Parse query string
    const query = {};
    for (const [k, v] of url.searchParams) query[k] = v;

    // Parse request body for POST/PUT/PATCH
    let body = {};
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const chunks = [];
      for await (const chunk of nodeReq) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      const ct  = nodeReq.headers['content-type'] ?? '';
      if (ct.includes('application/json') && raw) {
        try { body = JSON.parse(raw); } catch { body = {}; }
      } else if (ct.includes('application/x-www-form-urlencoded') && raw) {
        for (const [k, v] of new URLSearchParams(raw)) body[k] = v;
      }
    }

    const match = matchRoute(_routes[method] ?? [], pathname);

    if (!match) {
      nodeRes.writeHead(404, { 'Content-Type': 'application/json' });
      nodeRes.end(JSON.stringify({ error: 'Not Found', path: pathname }));
      return;
    }

    const req = {
      method,
      path:    pathname,
      params:  match.params,
      query,
      body,
      headers: nodeReq.headers,
    };

    try {
      const result = await match.handler(req);
      if (result === undefined || result === null) {
        nodeRes.writeHead(204);
        nodeRes.end();
      } else if (typeof result === 'string') {
        const isHtml = result.trimStart().startsWith('<!DOCTYPE') || result.trimStart().startsWith('<html');
        const ct = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
        nodeRes.writeHead(200, { 'Content-Type': ct });
        nodeRes.end(result);
      } else {
        nodeRes.writeHead(200, { 'Content-Type': 'application/json' });
        nodeRes.end(JSON.stringify(result));
      }
    } catch (err) {
      nodeRes.writeHead(500, { 'Content-Type': 'application/json' });
      nodeRes.end(JSON.stringify({ error: err.message }));
    }
  });

  return new Promise((resolve, reject) => {
    _server.once('error', reject);
    _server.listen(port, () => resolve(port));
  });
}

export function close() {
  if (_server) {
    _server.close();
    _server = null;
  }
}
