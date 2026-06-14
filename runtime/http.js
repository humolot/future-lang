// runtime/http.js — consume REST APIs.
// Uses the global fetch (stable in Node 22). Returns parsed JSON or text.

export class HttpError extends Error {
  constructor(status, statusText, url, body) {
    super(`HTTP ${status} ${statusText} — ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.url = url;
    this.body = body;
    this.namespace = 'http';
    this.code = `HTTP_${status}`;
  }
}

// Global config state — mutated by configure().
let _config = {
  headers: {},
  timeout: 0,
};

/**
 * Set global defaults for all HTTP requests.
 * Useful for Authorization headers, base timeouts, etc.
 * @param {{ headers?: Record<string,string>, timeout?: number }} opts
 */
export function configure(opts = {}) {
  if (opts.headers) _config.headers = { ..._config.headers, ...opts.headers };
  if (opts.timeout != null) _config.timeout = opts.timeout;
}

// Default headers — many public APIs (e.g. GitHub) reject requests without a
// User-Agent. Callers can override any of these.
const DEFAULT_HEADERS = {
  'user-agent': 'future-lang/0.4 (+https://github.com/humolot/future-lang)',
  accept: 'application/json, text/*;q=0.9, */*;q=0.8',
};

async function parseBody(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

function buildSignal() {
  if (!_config.timeout) return undefined;
  return AbortSignal.timeout(_config.timeout);
}

/** GET a URL. @returns parsed JSON object/array, or text. */
export async function get(url, headers = {}) {
  const res = await fetch(url, {
    headers: { ...DEFAULT_HEADERS, ..._config.headers, ...headers },
    signal: buildSignal(),
  });
  if (!res.ok) {
    let body;
    try { body = await parseBody(res); } catch { body = null; }
    throw new HttpError(res.status, res.statusText, url, body);
  }
  return parseBody(res);
}

/** POST a JSON body to a URL. @returns parsed JSON or text. */
export async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...DEFAULT_HEADERS, 'content-type': 'application/json', ..._config.headers, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal: buildSignal(),
  });
  if (!res.ok) {
    let errBody;
    try { errBody = await parseBody(res); } catch { errBody = null; }
    throw new HttpError(res.status, res.statusText, url, errBody);
  }
  return parseBody(res);
}
