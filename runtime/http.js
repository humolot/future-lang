// runtime/http.js — consume REST APIs.
// Uses the global fetch (stable in Node 22). Returns parsed JSON or text.

// Default headers — many public APIs (e.g. GitHub) reject requests without a
// User-Agent. Callers can override any of these.
const DEFAULT_HEADERS = {
  'user-agent': 'future-lang/0.2 (+https://github.com/future-lang)',
  accept: 'application/json, text/*;q=0.9, */*;q=0.8',
};

async function parse(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

/** GET a URL. @returns parsed JSON object/array, or text. */
export async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { ...DEFAULT_HEADERS, ...headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return parse(res);
}

/** POST a JSON body to a URL. @returns parsed JSON or text. */
export async function post(url, body, headers = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...DEFAULT_HEADERS, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  return parse(res);
}
