// runtime/index.js
// Aggregates every capability namespace into a single `runtime` object that the
// generated JavaScript imports as `__rt`. Add a module here and it instantly
// becomes callable from Future as `<name>.<method>(...)`.

import * as ai       from './ai.js';
import * as http     from './http.js';
import * as mqtt     from './mqtt.js';
import * as tts      from './tts.js';
import * as rag      from './rag.js';
import * as vision   from './vision.js';
import * as home     from './home.js';
// Optional modules — fully backward-compatible additions.
import * as memory   from './memory.js';
import * as schedule from './schedule.js';
import * as system   from './system.js';
import * as device   from './device.js';
import * as math     from './math.js';
import * as assert   from './assert.js';
import * as server   from './server.js';
import * as db       from './db.js';
import readline from 'node:readline';

// Canonical ordered list of capability module names.
const MODULE_NAMES = [
  'ai', 'http', 'mqtt', 'tts', 'rag', 'vision', 'home',
  'memory', 'schedule', 'system', 'device', 'math', 'assert',
  'server', 'db',
];

const _base = { ai, http, mqtt, tts, rag, vision, home, memory, schedule, system, device, math, assert, server, db };

/**
 * When FUTURE_DEBUG=1, wrap every namespace method with timing/logging.
 * Non-function properties (constants like math.pi) pass through unchanged.
 */
function wrapDebug(base) {
  const wrapped = {};
  for (const [ns, mod] of Object.entries(base)) {
    wrapped[ns] = {};
    for (const [key, val] of Object.entries(mod)) {
      if (typeof val !== 'function') { wrapped[ns][key] = val; continue; }
      wrapped[ns][key] = async (...args) => {
        const preview = args.length ? String(JSON.stringify(args[0])).slice(0, 60) : '';
        process.stderr.write(`\x1b[90m[debug] ${ns}.${key}(${preview}) …\x1b[0m\n`);
        const t = Date.now();
        try {
          const result = await val(...args);
          process.stderr.write(`\x1b[90m[debug] ${ns}.${key} ✓ ${Date.now() - t}ms\x1b[0m\n`);
          return result;
        } catch (err) {
          process.stderr.write(`\x1b[31m[debug] ${ns}.${key} ✗ ${Date.now() - t}ms — ${err.message}\x1b[0m\n`);
          throw err;
        }
      };
    }
  }
  return wrapped;
}

export const runtime = process.env.FUTURE_DEBUG === '1' ? wrapDebug(_base) : _base;

// input(prompt) — reads a line from stdin (CLI programs).
runtime.input = async (prompt = '') => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(String(prompt), (answer) => { rl.close(); resolve(answer); });
  });
};

// --- Structured manifest ---
// Each function entry carries enough metadata for docs, editor tooling, REPL, and AI agents.
// Shape: { description, params: [{ name, type, optional? }], returns, async }

export const manifest = {
  ai: {
    configure: {
      description: 'Set the AI provider — accepts a named provider ("openai", "anthropic", "ollama", "gemini", …) or a custom OpenAI-compatible base URL',
      params: [
        { name: 'providerOrUrl', type: 'string' },
        { name: 'apiKey',        type: 'string' },
        { name: 'model',         type: 'string', optional: true },
      ],
      returns: 'void',
      async: false,
    },
    ask: {
      description: 'Ask an AI model a question and get a text response',
      params: [{ name: 'prompt', type: 'string' }, { name: 'opts', type: 'object', optional: true }],
      returns: 'string',
      async: true,
    },
    complete: {
      description: 'Like ask(), but returns a structured object: { text, model, provider, tokens: { input, output, total } }',
      params: [{ name: 'prompt', type: 'string|array' }, { name: 'opts', type: 'object', optional: true }],
      returns: '{ text: string, model: string, provider: string, tokens: { input: number, output: number, total: number } }',
      async: true,
    },
    chat: {
      description: 'Send a multi-turn message list to an AI model',
      params: [{ name: 'messages', type: 'array' }],
      returns: 'string',
      async: true,
    },
    stream: {
      description: 'Stream a response chunk by chunk via a callback function',
      params: [
        { name: 'prompt',   type: 'string' },
        { name: 'onChunk',  type: 'function' },
      ],
      returns: 'void',
      async: true,
    },
    embed: {
      description: 'Generate a vector embedding for a piece of text',
      params: [{ name: 'text', type: 'string' }],
      returns: 'array',
      async: true,
    },
    extract: {
      description: 'Extract structured JSON data from text using the AI model — returns a parsed object matching the provided schema',
      params: [
        { name: 'text',   type: 'string' },
        { name: 'schema', type: 'object|string' },
      ],
      returns: 'object',
      async: true,
    },
    classify: {
      description: 'Classify text into one of the provided category labels — returns the matching label string',
      params: [
        { name: 'text',   type: 'string' },
        { name: 'labels', type: 'array' },
      ],
      returns: 'string',
      async: true,
    },
  },

  http: {
    get: {
      description: 'Perform an HTTP GET request and return the parsed response',
      params: [
        { name: 'url', type: 'string' },
        { name: 'headers', type: 'object', optional: true },
      ],
      returns: 'any',
      async: true,
    },
    post: {
      description: 'Perform an HTTP POST request with a JSON body',
      params: [
        { name: 'url', type: 'string' },
        { name: 'body', type: 'any' },
        { name: 'headers', type: 'object', optional: true },
      ],
      returns: 'any',
      async: true,
    },
    put: {
      description: 'Perform an HTTP PUT request with a JSON body',
      params: [
        { name: 'url', type: 'string' },
        { name: 'body', type: 'any' },
        { name: 'headers', type: 'object', optional: true },
      ],
      returns: 'any',
      async: true,
    },
    patch: {
      description: 'Perform an HTTP PATCH request with a JSON body',
      params: [
        { name: 'url', type: 'string' },
        { name: 'body', type: 'any' },
        { name: 'headers', type: 'object', optional: true },
      ],
      returns: 'any',
      async: true,
    },
    delete: {
      description: 'Perform an HTTP DELETE request — returns null on 204, parsed body otherwise',
      params: [
        { name: 'url', type: 'string' },
        { name: 'headers', type: 'object', optional: true },
      ],
      returns: 'any',
      async: true,
    },
  },

  mqtt: {
    publish: {
      description: 'Publish a message to an MQTT topic',
      params: [
        { name: 'topic', type: 'string' },
        { name: 'message', type: 'string' },
      ],
      returns: 'string',
      async: true,
    },
    subscribe: {
      description: 'Subscribe to an MQTT topic; handler is called on every message',
      params: [
        { name: 'topic', type: 'string' },
        { name: 'handler', type: 'function' },
      ],
      returns: 'string',
      async: true,
    },
  },

  tts: {
    speak: {
      description: 'Speak text aloud using the system text-to-speech engine',
      params: [{ name: 'text', type: 'string' }],
      returns: 'void',
      async: true,
    },
  },

  rag: {
    index: {
      description: 'Index documents into the default knowledge base (chunks, embeds, stores)',
      params: [{ name: 'docs', type: 'array|string' }],
      returns: 'object',
      async: true,
    },
    query: {
      description: 'Query the default knowledge base and get an LLM-generated answer',
      params: [{ name: 'question', type: 'string' }],
      returns: 'string',
      async: true,
    },
    create: {
      description: 'Create a named Knowledge Base with its own isolated vector store',
      params: [
        { name: 'name', type: 'string' },
        { name: 'opts', type: 'object', optional: true },
      ],
      returns: 'KnowledgeBase',
      async: false,
    },
    indexFile: {
      description: 'Read a local file and index its content into the default knowledge base',
      params: [{ name: 'filePath', type: 'string' }],
      returns: 'object',
      async: true,
    },
    indexUrl: {
      description: 'Fetch a URL and index its text content into the default knowledge base',
      params: [{ name: 'url', type: 'string' }],
      returns: 'object',
      async: true,
    },
    stats: {
      description: 'Return stats for the default knowledge base (chunk count, vector count)',
      params: [],
      returns: 'object',
      async: false,
    },
    delete: {
      description: 'Delete a chunk from the default knowledge base by its ID',
      params: [{ name: 'id', type: 'string' }],
      returns: 'void',
      async: true,
    },
    clear: {
      description: 'Remove all indexed documents from the default knowledge base',
      params: [],
      returns: 'void',
      async: true,
    },
  },

  vision: {
    describe: {
      description: 'Describe the contents of an image using a vision AI model',
      params: [{ name: 'image', type: 'string' }],
      returns: 'string',
      async: true,
    },
    detect: {
      description: 'Detect and list objects, people, or labels visible in an image',
      params: [{ name: 'image', type: 'string' }],
      returns: 'string',
      async: true,
    },
    ocr: {
      description: 'Extract all readable text from an image (OCR)',
      params: [{ name: 'image', type: 'string' }],
      returns: 'string',
      async: true,
    },
    classify: {
      description: 'Classify an image into a primary category',
      params: [{ name: 'image', type: 'string' }],
      returns: 'string',
      async: true,
    },
    compare: {
      description: 'Compare two images and describe their differences',
      params: [
        { name: 'imageA', type: 'string' },
        { name: 'imageB', type: 'string' },
      ],
      returns: 'string',
      async: true,
    },
  },

  home: {
    turnOn: {
      description: 'Turn a home automation device on',
      params: [{ name: 'device', type: 'string' }],
      returns: 'string',
      async: true,
    },
    turnOff: {
      description: 'Turn a home automation device off',
      params: [{ name: 'device', type: 'string' }],
      returns: 'string',
      async: true,
    },
    set: {
      description: 'Set a home automation device to an arbitrary value',
      params: [
        { name: 'device', type: 'string' },
        { name: 'value', type: 'any' },
      ],
      returns: 'string',
      async: true,
    },
  },

  memory: {
    forget: {
      description: 'Delete all keys matching a pattern, or clear everything if no pattern given',
      params: [{ name: 'pattern', type: 'string|RegExp', optional: true }],
      returns: 'number',
      async: false,
    },
    set: {
      description: 'Store a value in the in-process memory store',
      params: [
        { name: 'key', type: 'string' },
        { name: 'value', type: 'any' },
      ],
      returns: 'any',
      async: false,
    },
    get: {
      description: 'Retrieve a value from the memory store',
      params: [{ name: 'key', type: 'string' }],
      returns: 'any',
      async: false,
    },
    delete: {
      description: 'Delete a key from the memory store',
      params: [{ name: 'key', type: 'string' }],
      returns: 'boolean',
      async: false,
    },
    search: {
      description: 'Search memory entries whose key or value contains the query string',
      params: [{ name: 'query', type: 'string' }],
      returns: 'array',
      async: false,
    },
    persist: {
      description: 'Save the in-memory store to a JSON file. Uses FUTURE_MEMORY_FILE env var if no path given',
      params: [{ name: 'filePath', type: 'string', optional: true }],
      returns: 'void',
      async: false,
    },
    load: {
      description: 'Load the store from a JSON file, merging into existing keys. Uses FUTURE_MEMORY_FILE env var if no path given',
      params: [{ name: 'filePath', type: 'string', optional: true }],
      returns: 'void',
      async: false,
    },
    searchSemantic: {
      description: 'Semantic similarity search using AI embeddings — returns top-k entries most similar to the query. Falls back to keyword vectors when no API key is set.',
      params: [
        { name: 'query', type: 'string' },
        { name: 'topK',  type: 'number', optional: true },
      ],
      returns: 'array',
      async: true,
    },
  },

  schedule: {
    every: {
      description: 'Run a callback repeatedly at a fixed interval (e.g. "30m", "5s")',
      params: [
        { name: 'interval', type: 'string|number' },
        { name: 'callback', type: 'function' },
      ],
      returns: 'Timeout',
      async: true,
    },
    once: {
      description: 'Run a callback once after a delay (e.g. "10s", 5000)',
      params: [
        { name: 'delay', type: 'string|number' },
        { name: 'callback', type: 'function' },
      ],
      returns: 'any',
      async: true,
    },
    cron: {
      description: 'Run a callback on a cron schedule (requires node-cron)',
      params: [
        { name: 'expression', type: 'string' },
        { name: 'callback', type: 'function' },
      ],
      returns: 'any',
      async: true,
    },
    cancel: {
      description: 'Cancel a scheduled task returned by every(), once(), or cron()',
      params: [{ name: 'handle', type: 'any' }],
      returns: 'void',
      async: false,
    },
    list: {
      description: 'List all active scheduled tasks with their type, interval, and creation time',
      params: [],
      returns: 'array',
      async: false,
    },
  },

  system: {
    env: {
      description: 'Read an environment variable; returns null if not set',
      params: [{ name: 'name', type: 'string' }],
      returns: 'string|null',
      async: false,
    },
    exec: {
      description: 'Execute a shell command and return its stdout',
      params: [{ name: 'command', type: 'string|array' }],
      returns: 'string',
      async: true,
    },
    open: {
      description: 'Open a file path or URL with the OS default application',
      params: [{ name: 'target', type: 'string' }],
      returns: 'string',
      async: true,
    },
    notify: {
      description: 'Send a desktop notification with a message',
      params: [{ name: 'message', type: 'string' }],
      returns: 'string',
      async: true,
    },
    read: {
      description: 'Read a file and return its content as a string',
      params: [{ name: 'path', type: 'string' }],
      returns: 'string',
      async: true,
    },
    write: {
      description: 'Write a string to a file (creates or overwrites)',
      params: [
        { name: 'path',    type: 'string' },
        { name: 'content', type: 'string' },
      ],
      returns: 'string',
      async: true,
    },
  },

  device: {
    register: {
      description: 'Register an IoT device with a configuration object (name is required)',
      params: [{ name: 'config', type: 'object' }],
      returns: 'object',
      async: false,
    },
    get: {
      description: 'Look up a registered device by name',
      params: [{ name: 'name', type: 'string' }],
      returns: 'object|null',
      async: false,
    },
    list: {
      description: 'List all registered devices',
      params: [],
      returns: 'array',
      async: false,
    },
    update: {
      description: 'Merge changes into an existing device record',
      params: [{ name: 'name', type: 'string' }, { name: 'changes', type: 'object' }],
      returns: 'object',
      async: false,
    },
    remove: {
      description: 'Remove a device from the registry by name',
      params: [{ name: 'name', type: 'string' }],
      returns: 'boolean',
      async: false,
    },
    persist: {
      description: 'Save the device registry to a JSON file (uses FUTURE_DEVICE_FILE if no path given)',
      params: [{ name: 'filePath', type: 'string', optional: true }],
      returns: 'void',
      async: false,
    },
    load: {
      description: 'Load the device registry from a JSON file (uses FUTURE_DEVICE_FILE if no path given)',
      params: [{ name: 'filePath', type: 'string', optional: true }],
      returns: 'void',
      async: false,
    },
  },

  math: {
    round:  { description: 'Round to nearest integer',        params: [{ name: 'x', type: 'number' }], returns: 'number', async: false },
    floor:  { description: 'Round down to nearest integer',   params: [{ name: 'x', type: 'number' }], returns: 'number', async: false },
    ceil:   { description: 'Round up to nearest integer',     params: [{ name: 'x', type: 'number' }], returns: 'number', async: false },
    abs:    { description: 'Absolute value',                  params: [{ name: 'x', type: 'number' }], returns: 'number', async: false },
    sqrt:   { description: 'Square root',                     params: [{ name: 'x', type: 'number' }], returns: 'number', async: false },
    pow:    { description: 'x raised to the power y',         params: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }], returns: 'number', async: false },
    log:    { description: 'Natural logarithm',               params: [{ name: 'x', type: 'number' }], returns: 'number', async: false },
    random: { description: 'Random float between 0 and 1',   params: [], returns: 'number', async: false },
    min:    { description: 'Smallest of the given values',    params: [{ name: '...values', type: 'number' }], returns: 'number', async: false },
    max:    { description: 'Largest of the given values',     params: [{ name: '...values', type: 'number' }], returns: 'number', async: false },
    pi:     { description: 'The mathematical constant π',     params: [], returns: 'number', async: false },
    e:      { description: "Euler's number",                  params: [], returns: 'number', async: false },
  },

  assert: {
    ok:        { description: 'Assert that value is truthy',                    params: [{ name: 'value', type: 'any' }, { name: 'msg', type: 'string', optional: true }], returns: 'void', async: false },
    equal:     { description: 'Assert that actual === expected',                params: [{ name: 'actual', type: 'any' }, { name: 'expected', type: 'any' }, { name: 'msg', type: 'string', optional: true }], returns: 'void', async: false },
    notEqual:  { description: 'Assert that actual !== expected',                params: [{ name: 'actual', type: 'any' }, { name: 'expected', type: 'any' }, { name: 'msg', type: 'string', optional: true }], returns: 'void', async: false },
    deepEqual: { description: 'Assert deep structural equality',                params: [{ name: 'actual', type: 'any' }, { name: 'expected', type: 'any' }, { name: 'msg', type: 'string', optional: true }], returns: 'void', async: false },
    fail:      { description: 'Unconditionally fail the test with a message',   params: [{ name: 'msg', type: 'string', optional: true }], returns: 'void', async: false },
    throws:    { description: 'Assert that a function throws an error. Optionally verify the error message contains expectedMessage', params: [{ name: 'fn', type: 'function' }, { name: 'expectedMessage', type: 'string', optional: true }], returns: 'void', async: true },
  },

  server: {
    get:    { description: 'Register a GET route handler block',    params: [{ name: 'path', type: 'string' }], returns: 'void', async: false },
    post:   { description: 'Register a POST route handler block',   params: [{ name: 'path', type: 'string' }], returns: 'void', async: false },
    put:    { description: 'Register a PUT route handler block',    params: [{ name: 'path', type: 'string' }], returns: 'void', async: false },
    delete: { description: 'Register a DELETE route handler block', params: [{ name: 'path', type: 'string' }], returns: 'void', async: false },
    patch:  { description: 'Register a PATCH route handler block',  params: [{ name: 'path', type: 'string' }], returns: 'void', async: false },
    listen: { description: 'Start the HTTP server on the given port', params: [{ name: 'port', type: 'number', optional: true }], returns: 'number', async: true },
    close:  { description: 'Stop the HTTP server',                  params: [], returns: 'void', async: false },
  },

  db: {
    connect: { description: 'Connect to a database. Auto-detects driver from URL: SQLite (file path), postgres://, mysql://', params: [{ name: 'url', type: 'string' }], returns: 'void', async: true },
    open:    { description: 'Open (or create) a SQLite database file — alias for db.connect(path)', params: [{ name: 'path', type: 'string' }], returns: 'void', async: true },
    exec:    { description: 'Execute raw SQL with no return value (CREATE TABLE, DROP, etc.)', params: [{ name: 'sql', type: 'string' }], returns: 'void', async: true },
    query:   { description: 'Run a SELECT and return all matching rows as an array of objects', params: [{ name: 'sql', type: 'string' }, { name: 'params', type: 'array', optional: true }], returns: 'array', async: true },
    get:     { description: 'Run a SELECT and return the first matching row, or null', params: [{ name: 'sql', type: 'string' }, { name: 'params', type: 'array', optional: true }], returns: 'object|null', async: true },
    insert:  { description: 'Insert a row into a table. Returns { id, changes }.', params: [{ name: 'table', type: 'string' }, { name: 'data', type: 'object' }], returns: '{ id: number, changes: number }', async: true },
    update:  { description: 'Update rows matching a WHERE clause. Returns { changes }.', params: [{ name: 'table', type: 'string' }, { name: 'data', type: 'object' }, { name: 'where', type: 'string' }, { name: 'params', type: 'array', optional: true }], returns: '{ changes: number }', async: true },
    delete:  { description: 'Delete rows matching a WHERE clause. Returns { changes }.', params: [{ name: 'table', type: 'string' }, { name: 'where', type: 'string' }, { name: 'params', type: 'array', optional: true }], returns: '{ changes: number }', async: true },
    close:   { description: 'Close the database connection / pool', params: [], returns: 'void', async: true },
  },
};

// --- Introspection API ---
// These methods allow programs, REPLs, and AI agents to discover the runtime at run time.

/** List all available module names. */
runtime.listModules = () => [...MODULE_NAMES];

/** List all function names exported by a module. */
runtime.listFunctions = (mod) => {
  const m = manifest[mod];
  return m ? Object.keys(m) : [];
};

/**
 * Full description of the runtime: version, module list, and complete manifest.
 * Suitable for AI agent discovery or documentation generation.
 */
runtime.describe = () => ({
  version: '0.6.3',
  modules: [...MODULE_NAMES],
  manifest,
});

export default runtime;
