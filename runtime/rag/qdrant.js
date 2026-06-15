// runtime/rag/qdrant.js — Qdrant vector store adapter.
//
// Requires a running Qdrant instance.
// Default: http://localhost:6333
//
// Environment variables:
//   QDRANT_URL        Qdrant base URL (default: http://localhost:6333)
//   QDRANT_COLLECTION Collection name (default: future)
//   QDRANT_API_KEY    API key for Qdrant Cloud (optional for local)
//
// Or pass options directly to createQdrantStore({ url, collection, apiKey }).

/**
 * Create a Qdrant-backed vector store adapter.
 * @param {{ url?: string, collection?: string, apiKey?: string }} [options]
 */
export function createQdrantStore(options = {}) {
  const baseUrl    = (options.url        ?? process.env.QDRANT_URL        ?? 'http://localhost:6333').replace(/\/$/, '');
  const collection = options.collection  ?? process.env.QDRANT_COLLECTION ?? 'future';
  const apiKey     = options.apiKey      ?? process.env.QDRANT_API_KEY;

  const headers = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'api-key': apiKey } : {}),
  };

  let _collectionSize = null; // cache vector size after first add

  async function ensureCollection(vectorSize) {
    if (_collectionSize === vectorSize) return; // already created with same size
    const res = await fetch(`${baseUrl}/collections/${collection}`, { headers });
    if (res.status === 200) { _collectionSize = vectorSize; return; }
    // Collection doesn't exist — create it
    const create = await fetch(`${baseUrl}/collections/${collection}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ vectors: { size: vectorSize, distance: 'Cosine' } }),
    });
    if (!create.ok) {
      const err = await create.text().catch(() => '');
      throw new Error(`Qdrant: failed to create collection "${collection}": ${err}`);
    }
    _collectionSize = vectorSize;
  }

  return {
    name: 'qdrant',

    async add(id, vector, metadata = {}) {
      await ensureCollection(vector.length);
      const res = await fetch(`${baseUrl}/collections/${collection}/points`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          points: [{ id: String(id), vector, payload: metadata }],
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Qdrant: failed to upsert point: ${err}`);
      }
    },

    async search(queryVector, topK = 5) {
      await ensureCollection(queryVector.length);
      const res = await fetch(`${baseUrl}/collections/${collection}/points/search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ vector: queryVector, limit: topK, with_payload: true }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.result ?? []).map((r) => ({
        id:       r.id,
        score:    r.score,
        metadata: r.payload ?? {},
      }));
    },

    async delete(id) {
      await fetch(`${baseUrl}/collections/${collection}/points/delete`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ points: [String(id)] }),
      });
    },

    async clear() {
      await fetch(`${baseUrl}/collections/${collection}`, { method: 'DELETE', headers });
      _collectionSize = null;
    },

    async size() {
      const res = await fetch(`${baseUrl}/collections/${collection}`, { headers });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.result?.points_count ?? 0;
    },

    async persist() { /* Qdrant persists automatically on the server */ },
    async load()    { /* Qdrant persists automatically on the server */ },
  };
}
