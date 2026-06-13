// runtime/memory.js — In-process key-value store with fuzzy search.
// Suitable for session state, conversation context, and lightweight RAG-style retrieval.
// Swap the `store` Map for a Redis/SQLite/vector-DB client to go persistent.

const store = new Map();

/** Store a value under a key. @returns the stored value. */
export function set(key, value) {
  store.set(String(key), value);
  return value;
}

/** Retrieve a value by key. @returns the value or null. */
export function get(key) {
  return store.has(String(key)) ? store.get(String(key)) : null;
}

/** Remove a key. @returns true if the key existed. */
function memDelete(key) {
  return store.delete(String(key));
}
export { memDelete as delete };

/**
 * Search all stored entries whose key or stringified value contains the query.
 * @returns {Array<{ key: string, value: any }>}
 */
export function search(query) {
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
 * Pattern can be an exact key, a substring, or a RegExp.
 * With no argument, clears everything.
 * @param {string|RegExp} [pattern]
 * @returns {number} number of keys removed.
 */
export function forget(pattern) {
  if (pattern === undefined) {
    const count = store.size;
    store.clear();
    return count;
  }
  const test = pattern instanceof RegExp
    ? (k) => pattern.test(k)
    : (k) => k.includes(String(pattern));
  let removed = 0;
  for (const key of [...store.keys()]) {
    if (test(key)) { store.delete(key); removed++; }
  }
  return removed;
}
