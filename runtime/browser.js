// runtime/browser.js — Browser-compatible Future runtime.
// No Node.js dependencies. Designed to run in any modern browser.
//
// Modules fully supported: ai, http, rag, vision, memory, schedule, tts, device, math
// Modules partially supported: system (open + notify only), home (stub)
// Modules not available: mqtt (needs WebSocket broker), system.exec/read/write
// Built-ins: len() (sync), input() (window.prompt), print (overridable)

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

// ─── Provider presets ─────────────────────────────────────────────────────────

const PRESETS = {
  anthropic:  { baseUrl: 'https://api.anthropic.com',                          isAnthropic: true },
  openai:     { baseUrl: 'https://api.openai.com/v1',                          defaultModel: 'gpt-4o-mini' },
  gemini:     { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', defaultModel: 'gemini-2.0-flash' },
  ollama:     { baseUrl: 'http://localhost:11434/v1',                          defaultModel: 'llama3' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',                       defaultModel: 'openai/gpt-4o-mini' },
  venice:     { baseUrl: 'https://api.venice.ai/api/v1',                       defaultModel: 'llama-3.3-70b' },
  groq:       { baseUrl: 'https://api.groq.com/openai/v1',                     defaultModel: 'llama-3.3-70b-versatile' },
};

// ─── AI module ────────────────────────────────────────────────────────────────

const _aiState = { proxy: null, provider: null, apiKey: null, model: null };

function _resolveAI() { return _aiState; }

async function _proxyPost(path, body) {
  const res = await fetch(`${_aiState.proxy}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Proxy error ${res.status}: ${await res.text()}`);
  return res;
}

function _extractText(data) {
  // Handles both OpenAI and Anthropic response shapes
  return data.text ?? data.content?.[0]?.text ??
    data.choices?.[0]?.message?.content ?? String(data);
}

async function _directAsk(messages) {
  const preset = PRESETS[_aiState.provider ?? 'openai'] ?? PRESETS.openai;
  const model  = _aiState.model ?? preset.defaultModel ?? 'gpt-4o-mini';

  if (preset.isAnthropic) {
    const res = await fetch(`${preset.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': _aiState.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model, max_tokens: 1024, messages }),
    });
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }

  const res = await fetch(`${preset.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${_aiState.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export const ai = {
  configure(providerOrUrl, apiKey, model) {
    _aiState.provider = providerOrUrl;
    _aiState.apiKey   = apiKey ?? null;
    _aiState.model    = model  ?? null;
  },

  async ask(prompt) {
    if (_aiState.proxy) {
      const res  = await _proxyPost('/ask', { prompt: String(prompt) });
      const data = await res.json();
      return _extractText(data);
    }
    if (!_aiState.apiKey) throw new Error('AI not configured. Call Future.configure({ proxy: "/api/ai" }) or Future.configure({ provider: "openai", apiKey: "sk-..." })');
    return _directAsk([{ role: 'user', content: String(prompt) }]);
  },

  async chat(messages) {
    if (_aiState.proxy) {
      const res  = await _proxyPost('/chat', { messages });
      const data = await res.json();
      return _extractText(data);
    }
    if (!_aiState.apiKey) throw new Error('AI not configured. Call Future.configure({ proxy: "/api/ai" }) or Future.configure({ provider: "openai", apiKey: "sk-..." })');
    return _directAsk(messages);
  },

  async stream(prompt, onChunk) {
    if (_aiState.proxy) {
      const res = await _proxyPost('/stream', { prompt: String(prompt) });
      for await (const { data } of parseSSE(res.body)) {
        const chunk = data.choices?.[0]?.delta?.content ?? data.delta?.text ?? '';
        if (chunk) await onChunk(chunk);
      }
      return;
    }
    // Direct streaming (demo mode)
    const preset = PRESETS[_aiState.provider ?? 'openai'] ?? PRESETS.openai;
    const model  = _aiState.model ?? preset.defaultModel ?? 'gpt-4o-mini';
    const res = await fetch(`${preset.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${_aiState.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: String(prompt) }] }),
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

export const http = {
  async get(url, headers = {}) {
    const res = await fetch(String(url), { headers });
    return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
  },
  async post(url, body, headers = {}) {
    const res = await fetch(String(url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return res.headers.get('content-type')?.includes('json') ? res.json() : res.text();
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
        const text = typeof doc === 'string' ? doc : doc.text ?? doc.content ?? JSON.stringify(doc);
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
  async publish() { console.warn('[mqtt] not available in browser without a WebSocket broker'); },
  async subscribe() { console.warn('[mqtt] not available in browser without a WebSocket broker'); },
};

// ─── Home stub ────────────────────────────────────────────────────────────────

export const home = {
  async turnOn(d)      { return mqtt.publish(`home/${d}/set`, 'ON'); },
  async turnOff(d)     { return mqtt.publish(`home/${d}/set`, 'OFF'); },
  async set(d, value)  { return mqtt.publish(`home/${d}/set`, String(value)); },
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

export const browserRuntime = { ai, http, memory, schedule, tts, system, vision, rag, device, mqtt, home, math, input, print };

// ─── Global proxy configuration ───────────────────────────────────────────────
// Called by: Future.configure({ proxy: '/api/ai' })

export function setProxy(proxyUrl) {
  _aiState.proxy = proxyUrl;
}
