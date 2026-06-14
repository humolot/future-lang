// runtime/browser.js — Browser-compatible Future runtime.
// No Node.js dependencies. Designed to run in any modern browser.
//
// Modules fully supported: ai, http, rag, vision, memory, schedule, tts, device, math, assert
// Modules partially supported: system (open + notify + env only), home (via mqtt stub)
// Modules not available: mqtt (needs WebSocket broker), system.exec/read/write
// Built-ins: len() (sync), input() (window.prompt), print (overridable)
//
// v0.4.2 sync:
//   - ai.ask/chat/stream accept opts { temperature, max_tokens, model, system }
//   - ai.complete() → { text, model, provider, tokens: { input, output, total } }
//   - AiError class with .status, .code, .provider
//   - http.configure({ headers, timeout }) for global request defaults
//   - HttpError class with .status, .statusText, .code, .url, .body
//   - assert namespace: ok, equal, notEqual, deepEqual, fail

// ─── Shared utilities ─────────────────────────────────────────────────────────

function keywordVector(text) {
  const words = String(text).toLowerCase().match(/\b[a-z]{2,}\b/g) ?? [];
  const vec = new Array(256).fill(0);
  for (const word of words) {
    let h = 5381;
    for (let i = 0; i < word.length; i++) h = ((h << 5) + h) ^ word.charCodeAt(i);
    vec[(h >>> 0) % 256] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function* parseSSE(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '', pendingEvent = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (line.startsWith('event: ')) { pendingEvent = line.slice(7).trim(); }
      else if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        try { yield { event: pendingEvent, data: JSON.parse(raw) }; } catch {}
        pendingEvent = null;
      }
    }
  }
}

// ─── Error classes ────────────────────────────────────────────────────────────

export class AiError extends Error {
  constructor(status, provider, body) {
    const msg = body?.error?.message ?? body ?? `HTTP ${status}`;
    super(`[ai:${provider}] ${msg}`);
    this.name = 'AiError';
    this.status = status;
    this.code = `AI_HTTP_${status}`;
    this.namespace = 'ai';
    this.provider = provider;
    this.body = body;
  }
}

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

// ─── Provider presets ─────────────────────────────────────────────────────────

const PRESETS = {
  anthropic:  { baseUrl: 'https://api.anthropic.com',                               isAnthropic: true,  defaultModel: 'claude-sonnet-4-6' },
  openai:     { baseUrl: 'https://api.openai.com/v1',                               defaultModel: 'gpt-4o-mini' },
  gemini:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
  ollama:     { baseUrl: 'http://localhost:11434/v1',                               defaultModel: 'llama3' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',                            defaultModel: 'openai/gpt-4o-mini' },
  venice:     { baseUrl: 'https://api.venice.ai/api/v1',                            defaultModel: 'llama-3.3-70b' },
  groq:       { baseUrl: 'https://api.groq.com/openai/v1',                          defaultModel: 'llama-3.3-70b-versatile' },
};

// ─── AI module ────────────────────────────────────────────────────────────────

const _aiState = { proxy: null, provider: null, apiKey: null, model: null };

async function _proxyPost(path, body) {
  const res = await fetch(`${_aiState.proxy}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errBody;
    try { errBody = await res.json(); } catch { errBody = await res.text(); }
    throw new AiError(res.status, 'proxy', errBody);
  }
  return res;
}

function _extractText(data) {
  return data.text ?? data.content?.[0]?.text ??
    data.choices?.[0]?.message?.content ?? String(data);
}

async function _callAnthropic(messages, opts = {}) {
  const preset = PRESETS.anthropic;
  const model      = opts.model      ?? _aiState.model ?? preset.defaultModel;
  const max_tokens = opts.max_tokens ?? 1024;
  const body       = { model, max_tokens, messages };
  if (opts.temperature != null) body.temperature = opts.temperature;
  if (opts.system)              body.system      = opts.system;

  const res = await fetch(`${preset.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': _aiState.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errBody;
    try { errBody = await res.json(); } catch { errBody = await res.text(); }
    throw new AiError(res.status, 'anthropic', errBody);
  }
  return res.json();
}

async function _callOpenAI(messages, opts = {}) {
  const preset = PRESETS[_aiState.provider ?? 'openai'] ?? PRESETS.openai;
  const model      = opts.model      ?? _aiState.model ?? preset.defaultModel ?? 'gpt-4o-mini';
  const max_tokens = opts.max_tokens ?? 1024;
  const body       = { model, messages, max_tokens };
  if (opts.temperature != null) body.temperature = opts.temperature;

  const res = await fetch(`${preset.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${_aiState.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errBody;
    try { errBody = await res.json(); } catch { errBody = await res.text(); }
    throw new AiError(res.status, _aiState.provider ?? 'openai', errBody);
  }
  return res.json();
}

async function _directChat(messages, opts = {}) {
  const isAnthropic = (PRESETS[_aiState.provider ?? ''] ?? {}).isAnthropic;
  if (isAnthropic) {
    const data = await _callAnthropic(messages, opts);
    return (data.content ?? []).map((b) => b.text ?? '').join('').trim();
  }
  const data = await _callOpenAI(messages, opts);
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

export const ai = {
  configure(providerOrUrl, apiKey, model) {
    _aiState.provider = providerOrUrl;
    _aiState.apiKey   = apiKey ?? null;
    _aiState.model    = model  ?? null;
  },

  async ask(prompt, opts = {}) {
    const messages = [{ role: 'user', content: String(prompt) }];
    if (_aiState.proxy) {
      const res  = await _proxyPost('/ask', { prompt: String(prompt), ...opts });
      const data = await res.json();
      return _extractText(data);
    }
    if (!_aiState.apiKey) throw new Error('AI not configured. Call Future.configure({ proxy: "/api/ai" }) or Future.configure({ provider: "openai", apiKey: "sk-..." })');
    return _directChat(messages, opts);
  },

  async chat(messages, opts = {}) {
    if (_aiState.proxy) {
      const res  = await _proxyPost('/chat', { messages, ...opts });
      const data = await res.json();
      return _extractText(data);
    }
    if (!_aiState.apiKey) throw new Error('AI not configured.');
    return _directChat(messages, opts);
  },

  async complete(prompt, opts = {}) {
    const messages = Array.isArray(prompt)
      ? prompt
      : [{ role: 'user', content: String(prompt) }];

    if (_aiState.proxy) {
      try {
        const res  = await _proxyPost('/complete', { prompt: Array.isArray(prompt) ? undefined : String(prompt), messages, ...opts });
        const data = await res.json();
        return {
          text:     _extractText(data),
          model:    data.model ?? 'proxy',
          provider: 'proxy',
          tokens: {
            input:  data.tokens?.input  ?? data.usage?.input_tokens  ?? data.usage?.prompt_tokens     ?? 0,
            output: data.tokens?.output ?? data.usage?.output_tokens ?? data.usage?.completion_tokens ?? 0,
            total:  data.tokens?.total  ?? data.usage?.total_tokens  ?? 0,
          },
        };
      } catch {
        // Fallback: proxy doesn't have /complete — use /ask
        const text = await ai.ask(Array.isArray(prompt) ? prompt[0]?.content ?? '' : prompt, opts);
        return { text, model: 'proxy', provider: 'proxy', tokens: { input: 0, output: 0, total: 0 } };
      }
    }

    if (!_aiState.apiKey) {
      return { text: '[ai offline] No API key configured.', model: 'none', provider: 'offline', tokens: { input: 0, output: 0, total: 0 } };
    }

    const isAnthropic = (PRESETS[_aiState.provider ?? ''] ?? {}).isAnthropic;
    if (isAnthropic) {
      const data = await _callAnthropic(messages, opts);
      const text = (data.content ?? []).map((b) => b.text ?? '').join('').trim();
      return {
        text,
        model:    data.model ?? _aiState.model ?? PRESETS.anthropic.defaultModel,
        provider: 'anthropic',
        tokens: {
          input:  data.usage?.input_tokens  ?? 0,
          output: data.usage?.output_tokens ?? 0,
          total:  (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        },
      };
    }

    const data = await _callOpenAI(messages, opts);
    const text = data.choices?.[0]?.message?.content?.trim() ?? '';
    const preset = PRESETS[_aiState.provider ?? 'openai'] ?? PRESETS.openai;
    return {
      text,
      model:    data.model ?? _aiState.model ?? preset.defaultModel,
      provider: _aiState.provider ?? 'openai',
      tokens: {
        input:  data.usage?.prompt_tokens     ?? 0,
        output: data.usage?.completion_tokens ?? 0,
        total:  data.usage?.total_tokens      ?? 0,
      },
    };
  },

  async stream(prompt, onChunk, opts = {}) {
    if (_aiState.proxy) {
      const res = await _proxyPost('/stream', { prompt: String(prompt), ...opts });
      for await (const { data } of parseSSE(res.body)) {
        const chunk = data.choices?.[0]?.delta?.content ?? data.delta?.text ?? '';
        if (chunk) await onChunk(chunk);
      }
      return;
    }

    const messages = Array.isArray(prompt)
      ? prompt
      : [{ role: 'user', content: String(prompt) }];
    const isAnthropic = (PRESETS[_aiState.provider ?? ''] ?? {}).isAnthropic;
    const model      = opts.model ?? _aiState.model;
    const max_tokens = opts.max_tokens ?? 1024;

    if (isAnthropic) {
      const body = { model: model ?? PRESETS.anthropic.defaultModel, max_tokens, messages, stream: true };
      if (opts.temperature != null) body.temperature = opts.temperature;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': _aiState.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      for await (const { event, data } of parseSSE(res.body)) {
        if (event === 'content_block_delta' || data?.type === 'content_block_delta') {
          const chunk = data.delta?.text ?? '';
          if (chunk) await onChunk(chunk);
        }
      }
      return;
    }

    const preset = PRESETS[_aiState.provider ?? 'openai'] ?? PRESETS.openai;
    const body = { model: model ?? preset.defaultModel ?? 'gpt-4o-mini', messages, max_tokens, stream: true };
    if (opts.temperature != null) body.temperature = opts.temperature;
    const res = await fetch(`${preset.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${_aiState.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    for await (const { data } of parseSSE(res.body)) {
      const chunk = data.choices?.[0]?.delta?.content ?? '';
      if (chunk) await onChunk(chunk);
    }
  },

  async embed(text) {
    if (_aiState.proxy) {
      const res  = await _proxyPost('/embed', { text: String(text) });
      const data = await res.json();
      return data.embedding ?? data.data?.[0]?.embedding ?? keywordVector(text);
    }
    try {
      const preset = PRESETS[_aiState.provider ?? 'openai'] ?? PRESETS.openai;
      const res = await fetch(`${preset.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${_aiState.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: String(text) }),
      });
      const data = await res.json();
      return data.data?.[0]?.embedding ?? keywordVector(text);
    } catch {
      return keywordVector(text);
    }
  },
};

// ─── HTTP module ──────────────────────────────────────────────────────────────

let _httpConfig = { headers: {}, timeout: 0 };

const _HTTP_DEFAULT_HEADERS = {
  'user-agent': 'future-lang/0.4 (+https://github.com/humolot/future-lang)',
  accept: 'application/json, text/*;q=0.9, */*;q=0.8',
};

function _httpSignal() {
  if (!_httpConfig.timeout) return undefined;
  return AbortSignal.timeout(_httpConfig.timeout);
}

async function _parseHttpBody(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const http = {
  configure(opts = {}) {
    if (opts.headers) _httpConfig.headers = { ..._httpConfig.headers, ...opts.headers };
    if (opts.timeout != null) _httpConfig.timeout = opts.timeout;
  },

  async get(url, headers = {}) {
    const res = await fetch(String(url), {
      headers: { ..._HTTP_DEFAULT_HEADERS, ..._httpConfig.headers, ...headers },
      signal: _httpSignal(),
    });
    if (!res.ok) {
      let body;
      try { body = await _parseHttpBody(res); } catch { body = null; }
      throw new HttpError(res.status, res.statusText, String(url), body);
    }
    return _parseHttpBody(res);
  },

  async post(url, body, headers = {}) {
    const res = await fetch(String(url), {
      method: 'POST',
      headers: { ..._HTTP_DEFAULT_HEADERS, 'content-type': 'application/json', ..._httpConfig.headers, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      signal: _httpSignal(),
    });
    if (!res.ok) {
      let errBody;
      try { errBody = await _parseHttpBody(res); } catch { errBody = null; }
      throw new HttpError(res.status, res.statusText, String(url), errBody);
    }
    return _parseHttpBody(res);
  },
};

// ─── Memory module ────────────────────────────────────────────────────────────

const _store = new Map();

export const memory = {
  set(key, value)   { _store.set(String(key), value); return value; },
  get(key)          { return _store.has(String(key)) ? _store.get(String(key)) : null; },
  delete(key)       { return _store.delete(String(key)); },
  search(query)     {
    const q = String(query).toLowerCase();
    return [..._store.entries()]
      .filter(([k, v]) => k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q))
      .map(([key, value]) => ({ key, value }));
  },
  forget(pattern)   {
    if (!pattern) { const n = _store.size; _store.clear(); return n; }
    let n = 0;
    const re = pattern instanceof RegExp ? pattern : null;
    for (const key of [..._store.keys()]) {
      if (re ? re.test(key) : key.includes(String(pattern))) { _store.delete(key); n++; }
    }
    return n;
  },
};

// ─── Schedule module ──────────────────────────────────────────────────────────

function parseDuration(d) {
  if (typeof d === 'number') return d;
  const s = String(d);
  if (s.endsWith('ms')) return Number(s.slice(0, -2));
  if (s.endsWith('s'))  return Number(s.slice(0, -1)) * 1000;
  if (s.endsWith('m'))  return Number(s.slice(0, -1)) * 60000;
  if (s.endsWith('h'))  return Number(s.slice(0, -1)) * 3600000;
  return Number(s);
}

export const schedule = {
  async every(interval, callback) {
    const ms = parseDuration(interval);
    return setInterval(async () => { try { await callback(); } catch (e) { console.error('[schedule]', e); } }, ms);
  },
  async once(delay, callback) {
    const ms = parseDuration(delay);
    return setTimeout(async () => { try { await callback(); } catch (e) { console.error('[schedule]', e); } }, ms);
  },
  async cron() { console.warn('[schedule.cron] not available in browser'); },
};

// ─── TTS module ───────────────────────────────────────────────────────────────

export const tts = {
  async speak(text) {
    if (!('speechSynthesis' in window)) { console.warn('[tts] Web Speech API not available'); return; }
    const utt = new SpeechSynthesisUtterance(String(text));
    speechSynthesis.speak(utt);
    return String(text);
  },
};

// ─── System module (browser subset) ──────────────────────────────────────────

export const system = {
  async open(target) { window.open(String(target), '_blank'); return String(target); },
  async notify(message) {
    const msg = String(message);
    if ('Notification' in window) {
      if (Notification.permission === 'granted') { new Notification('Future', { body: msg }); }
      else if (Notification.permission !== 'denied') {
        const p = await Notification.requestPermission();
        if (p === 'granted') new Notification('Future', { body: msg });
      }
    } else { console.log(`[notify] ${msg}`); }
    return msg;
  },
  async exec()  { throw new Error('system.exec is not available in the browser'); },
  async read()  { throw new Error('system.read is not available in the browser'); },
  async write() { throw new Error('system.write is not available in the browser'); },
  env(name) { return window.__env?.[String(name)] ?? null; },
};

// ─── Vision module ────────────────────────────────────────────────────────────

function visionMsg(prompt, image) {
  return [{ role: 'user', content: [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: String(image) } },
  ]}];
}

export const vision = {
  async describe(image) { return ai.chat(visionMsg('Describe this image in detail.', image)); },
  async detect(image)   { return ai.chat(visionMsg('List all objects, people and elements visible in this image.', image)); },
  async ocr(image)      { return ai.chat(visionMsg('Extract all text from this image. Return only the text.', image)); },
  async classify(image) { return ai.chat(visionMsg('Classify this image into a primary category in 1-2 words.', image)); },
  async compare(a, b)   {
    return ai.chat([{ role: 'user', content: [
      { type: 'text', text: 'Compare these two images and describe their differences.' },
      { type: 'image_url', image_url: { url: String(a) } },
      { type: 'image_url', image_url: { url: String(b) } },
    ]}]);
  },
};

// ─── RAG module ───────────────────────────────────────────────────────────────

function chunk(text, size = 512, overlap = 64) {
  const sentences = String(text).match(/[^.!?]+[.!?]*/g) ?? [String(text)];
  const chunks = [];
  let cur = '';
  for (const s of sentences) {
    if (cur.length + s.length > size && cur) {
      chunks.push(cur.trim());
      cur = cur.slice(-overlap);
    }
    cur += s;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function createMemoryStore() {
  const entries = [];
  return {
    async add(text, vector, meta = {}) { entries.push({ text, vector, meta }); },
    async search(queryVec, k = 3) {
      return entries
        .map((e) => ({ ...e, score: cosineSim(queryVec, e.vector) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    },
    stats() { return { chunks: entries.length }; },
  };
}

function createPipeline(name) {
  const store = createMemoryStore();
  return {
    name,
    async index(docs) {
      const list = Array.isArray(docs) ? docs : [docs];
      let n = 0;
      for (const doc of list) {
        const text   = typeof doc === 'string' ? doc : doc.text ?? doc.content ?? JSON.stringify(doc);
        const source = doc.source ?? name;
        for (const [i, c] of chunk(text).entries()) {
          const vec = await ai.embed(c);
          await store.add(c, vec, { source, chunkIndex: i });
          n++;
        }
      }
      return { indexed: n };
    },
    async query(question) {
      const vec     = await ai.embed(String(question));
      const results = await store.search(vec);
      if (!results.length) return 'No relevant information found.';
      const context = results.map((r) => r.text).join('\n\n');
      return ai.ask(`Context:\n${context}\n\nQuestion: ${question}\n\nAnswer based on the context:`);
    },
    stats() { return store.stats(); },
  };
}

const _defaultPipeline = createPipeline('default');

export const rag = {
  async index(docs) { return _defaultPipeline.index(Array.isArray(docs) ? docs : [docs]); },
  async query(q)    { return _defaultPipeline.query(String(q)); },
  create(name)      { return createPipeline(String(name)); },
  async indexFile() { throw new Error('rag.indexFile is not available in the browser. Use rag.index() with text content.'); },
  async indexUrl(url) {
    const res  = await fetch(String(url));
    const text = await res.text();
    const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return _defaultPipeline.index([{ text: clean, source: String(url) }]);
  },
  stats() { return _defaultPipeline.stats(); },
};

// ─── Device module ────────────────────────────────────────────────────────────

const _devices = new Map();

export const device = {
  register(config) {
    if (!config?.name) throw new Error('device.register requires a config object with a name');
    const d = { ...config, registeredAt: Date.now() };
    _devices.set(config.name, d);
    return d;
  },
  get(name)  { return _devices.get(String(name)) ?? null; },
  list()     { return [..._devices.values()]; },
};

// ─── MQTT stub ────────────────────────────────────────────────────────────────

export const mqtt = {
  async publish()   { console.warn('[mqtt] not available in browser without a WebSocket broker'); },
  async subscribe() { console.warn('[mqtt] not available in browser without a WebSocket broker'); },
};

// ─── Home stub ────────────────────────────────────────────────────────────────

export const home = {
  async turnOn(d)     { return mqtt.publish(`home/${d}/set`, 'ON'); },
  async turnOff(d)    { return mqtt.publish(`home/${d}/set`, 'OFF'); },
  async set(d, value) { return mqtt.publish(`home/${d}/set`, String(value)); },
};

// ─── Math module ─────────────────────────────────────────────────────────────

export const math = {
  round:  (x)       => Math.round(Number(x)),
  floor:  (x)       => Math.floor(Number(x)),
  ceil:   (x)       => Math.ceil(Number(x)),
  abs:    (x)       => Math.abs(Number(x)),
  sqrt:   (x)       => Math.sqrt(Number(x)),
  pow:    (x, y)    => Math.pow(Number(x), Number(y)),
  log:    (x)       => Math.log(Number(x)),
  random: ()        => Math.random(),
  min:    (...args) => Math.min(...args.map(Number)),
  max:    (...args) => Math.max(...args.map(Number)),
  pi:     Math.PI,
  e:      Math.E,
};

// ─── Assert module (browser-native — no node:assert) ─────────────────────────

function _assertFail(msg, operator, actual, expected) {
  const err = new Error(msg);
  err.name     = 'AssertionError';
  err.namespace = 'assert';
  err.operator  = operator;
  err.actual    = actual;
  err.expected  = expected;
  throw err;
}

export const assert = {
  ok(val, msg) {
    if (!val) _assertFail(msg ?? `Expected truthy value, got ${JSON.stringify(val)}`, 'ok', val, true);
  },
  equal(a, b, msg) {
    if (a !== b) _assertFail(msg ?? `${JSON.stringify(a)} !== ${JSON.stringify(b)}`, 'equal', a, b);
  },
  notEqual(a, b, msg) {
    if (a === b) _assertFail(msg ?? `Expected values to differ, both are ${JSON.stringify(a)}`, 'notEqual', a, b);
  },
  deepEqual(a, b, msg) {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      _assertFail(msg ?? `Expected deep equality`, 'deepEqual', a, b);
    }
  },
  fail(msg = 'assertion failed') {
    _assertFail(msg, 'fail', undefined, undefined);
  },
};

// ─── input() — browser version uses window.prompt ────────────────────────────

export async function input(prompt = '') {
  return window.prompt(String(prompt)) ?? '';
}

// ─── Print function (overridable) ─────────────────────────────────────────────
// In browser mode the generator emits `__rt.print(...)` instead of `console.log(...)`.
// Override this to redirect output to the DOM, a custom logger, etc.
//
// Example:
//   Future.runtime.print = (...args) => {
//     document.getElementById('output').textContent += args.join(' ') + '\n';
//   };

export function print(...args) {
  console.log(...args);
}

// ─── Combined runtime object ──────────────────────────────────────────────────

export const browserRuntime = {
  ai, http, memory, schedule, tts, system, vision, rag, device, mqtt, home, math, assert,
  input, print,
};

// ─── Global proxy / provider configuration ────────────────────────────────────
// Called by: Future.configure({ proxy: '/api/ai' })
//         or Future.configure({ provider: 'openai', apiKey: 'sk-...' })

export function setProxy(proxyUrl) {
  _aiState.proxy = proxyUrl;
}
