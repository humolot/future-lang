// runtime/memory.js — Key-value store with optional file persistence.
//
// By default: in-process (lost on restart).
// Set FUTURE_MEMORY_FILE=./memory.json to auto-load on first use and
// auto-save on every write.  Or call memory.load() / memory.persist() explicitly.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const store = new Map();
let _loaded = false;

// Embedding cache for semantic search — invalidated on set/delete/forget.
const _embedCache = new Map(); // key → float[]

function ensureLoaded() {
  if (_loaded) return;
  _loaded = true;
  const file = process.env.FUTURE_MEMORY_FILE;
  if (!file) return;
  try {
    const data = JSON.parse(readFileSync(resolve(file), 'utf8'));
    for (const [k, v] of Object.entries(data)) store.set(k, v);
  } catch { /* file doesn't exist yet — start empty */ }
}

function autoPersist() {
  const file = process.env.FUTURE_MEMORY_FILE;
  if (!file) return;
  try {
    writeFileSync(resolve(file), JSON.stringify(Object.fromEntries(store), null, 2), 'utf8');
  } catch { /* ignore write errors */ }
}

/** Store a value under a key. @returns the stored value. */
export function set(key, value) {
  ensureLoaded();
  store.set(String(key), value);
  _embedCache.delete(String(key)); // invalidate stale embedding
  autoPersist();
  return value;
}

/** Retrieve a value by key. @returns the value or null. */
export function get(key) {
  ensureLoaded();
  return store.has(String(key)) ? store.get(String(key)) : null;
}

/** Remove a key. @returns true if the key existed. */
function memDelete(key) {
  ensureLoaded();
  const existed = store.delete(String(key));
  if (existed) { _embedCache.delete(String(key)); autoPersist(); }
  return existed;
}
export { memDelete as delete };

/**
 * Search all stored entries whose key or stringified value contains the query.
 * @returns {Array<{ key: string, value: any }>}
 */
export function search(query) {
  ensureLoaded();
  const q = String(query).toLowerCase();
  const results = [];
  for (const [key, value] of store) {
    const v = typeof value === 'string' ? value : JSON.stringify(value);
    if (key.toLowerCase().includes(q) || v.toLowerCase().includes(q)) {
      results.push({ key, value });
    }
  }
  return results;
}

/**
 * Forget (delete) all keys that match a pattern.
 * With no argument, clears everything.
 * @param {string|RegExp} [pattern]
 * @returns {number} number of keys removed.
 */
export function forget(pattern) {
  ensureLoaded();
  if (pattern === undefined) {
    const count = store.size;
    store.clear();
    autoPersist();
    return count;
  }
  const test = pattern instanceof RegExp
    ? (k) => pattern.test(k)
    : (k) => k.includes(String(pattern));
  let removed = 0;
  for (const key of [...store.keys()]) {
    if (test(key)) { store.delete(key); _embedCache.delete(key); removed++; }
  }
  if (removed > 0) autoPersist();
  return removed;
}

/**
 * Save the in-memory store to a JSON file.
 * Uses FUTURE_MEMORY_FILE env var if no path is provided.
 * @param {string} [filePath]
 */
export function persist(filePath) {
  const file = filePath ?? process.env.FUTURE_MEMORY_FILE;
  if (!file) throw new Error('memory.persist: provide a file path or set FUTURE_MEMORY_FILE');
  writeFileSync(resolve(file), JSON.stringify(Object.fromEntries(store), null, 2), 'utf8');
}

/**
 * Load the store from a JSON file, merging into existing keys.
 * Uses FUTURE_MEMORY_FILE env var if no path is provided.
 * @param {string} [filePath]
 */
export function load(filePath) {
  const file = filePath ?? process.env.FUTURE_MEMORY_FILE;
  if (!file) throw new Error('memory.load: provide a file path or set FUTURE_MEMORY_FILE');
  try {
    const data = JSON.parse(readFileSync(resolve(file), 'utf8'));
    for (const [k, v] of Object.entries(data)) store.set(k, v);
    _loaded = true;
  } catch { /* file doesn't exist — start empty */ }
}

/**
 * Semantic similarity search using AI embeddings.
 * Embeds the query and all stored values, then returns the top-k most similar entries.
 * Embeddings are cached per key and invalidated when a key is updated or deleted.
 *
 * Falls back to keyword search (no API key needed) when no AI provider is configured.
 *
 * Future example:
 *   memory.set("note1", "the cat sat on the mat")
 *   memory.set("note2", "quantum physics equations")
 *   results = memory.searchSemantic("feline animals")
 *   # → [{ key: "note1", value: "...", score: 0.91 }]
 *
 * @param {string} query
 * @param {number} [topK=5]
 * @returns {Promise<Array<{ key: string, value: any, score: number }>>}
 */
export async function searchSemantic(query, topK = 5) {
  ensureLoaded();
  if (store.size === 0) return [];

  const { resolveProvider } = await import('./providers/index.js');
  const { cosineSim, keywordVector } = await import('./providers/util.js');
  const provider = resolveProvider();

  const embed = provider
    ? (text) => provider.embed(text)
    : (text) => Promise.resolve(keywordVector(text));

  const queryVec = await embed(String(query));

  const scored = [];
  for (const [key, value] of store) {
    if (!_embedCache.has(key)) {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      _embedCache.set(key, await embed(text));
    }
    const score = cosineSim(queryVec, _embedCache.get(key));
    scored.push({ key, value, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
