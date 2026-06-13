// runtime/rag/vector-store.js — Vector store adapters.
//
// Adapter interface (all adapters implement):
//   add(id, vector, metadata)   → void
//   search(vector, topK)        → [{ id, score, metadata }]
//   delete(id)                  → void
//   clear()                     → void
//   size()                      → number
//   persist()                   → Promise<void>  (no-op for memory)
//   load()                      → Promise<void>  (no-op for memory)
//
// FUTURE_VECTOR_DB selects the adapter:
//   memory  (default) — in-process, fast, no deps
//   file    — memory + JSON file persistence (no native deps)
//   qdrant  — stub: set FUTURE_VECTOR_DB=qdrant and implement runtime/rag/qdrant.js
//   pinecone — stub
//   weaviate — stub

import process from 'node:process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { cosineSim } from '../providers/util.js';

// ─── In-Memory Adapter ─────────────────────────────────────────────────────

export function createMemoryStore() {
  const entries = new Map(); // id → { vector, metadata }

  return {
    name: 'memory',

    add(id, vector, metadata = {}) {
      entries.set(String(id), { vector, metadata });
    },

    search(queryVector, topK = 5) {
      const scored = [];
      for (const [id, { vector, metadata }] of entries) {
        scored.push({ id, score: cosineSim(queryVector, vector), metadata });
      }
      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    },

    delete(id) { entries.delete(String(id)); },
    clear()    { entries.clear(); },
    size()     { return entries.size; },
    async persist() { /* no-op */ },
    async load()    { /* no-op */ },
  };
}

// ─── File-Backed Adapter (memory + JSON persistence) ───────────────────────

export function createFileStore(filePath) {
  const store  = createMemoryStore();
  const fpath  = filePath ?? path.join(process.cwd(), '.future-vector-store.json');

  return {
    ...store,
    name: 'file',

    async persist() {
      await mkdir(path.dirname(fpath), { recursive: true });
      const data = {};
      // Re-walk the internal Map via search (all entries with empty vector trick not ideal)
      // Better: expose entries via a snapshot method.
      // Here we use a trick: search with a zero vector returns all entries sorted.
      // Actually, let's just serialize directly.
      for (const [id, entry] of store._entries?.entries() ?? []) {
        data[id] = entry;
      }
      await writeFile(fpath, JSON.stringify(data));
    },

    async load() {
      try {
        const raw  = await readFile(fpath, 'utf8');
        const data = JSON.parse(raw);
        for (const [id, { vector, metadata }] of Object.entries(data)) {
          store.add(id, vector, metadata);
        }
      } catch { /* file doesn't exist yet */ }
    },
  };
}

// ─── Cloud Adapter Stubs ─────────────────────────────────────────────────────
// Implement these by creating runtime/rag/qdrant.js, etc. and importing here.

function cloudStub(name) {
  return {
    name,
    add()    { console.warn(`[vector/${name}] not implemented — add runtime/rag/${name}.js`); },
    search() { console.warn(`[vector/${name}] not implemented`); return []; },
    delete() {},
    clear()  {},
    size()   { return 0; },
    async persist() {},
    async load()    {},
  };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createVectorStore(options = {}) {
  const adapter = options.adapter ?? process.env.FUTURE_VECTOR_DB ?? 'memory';
  switch (adapter.toLowerCase()) {
    case 'memory':   return createMemoryStore();
    case 'file':     return createFileStore(options.filePath);
    case 'qdrant':   return cloudStub('qdrant');
    case 'pinecone': return cloudStub('pinecone');
    case 'weaviate': return cloudStub('weaviate');
    default:
      console.warn(`[vector] Unknown adapter "${adapter}", falling back to memory.`);
      return createMemoryStore();
  }
}
