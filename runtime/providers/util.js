// runtime/providers/util.js — Shared utilities for AI providers.

/**
 * Async generator that yields parsed JSON objects from an SSE stream.
 * Handles both OpenAI-style (`data: {...}`) and Anthropic-style (`event: ...\ndata: {...}`) SSE.
 * @param {ReadableStream} body
 * @yields {{ event?: string, data: object }}
 */
export async function* parseSSE(body) {
  const reader  = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let pendingEvent = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('event: ')) {
        pendingEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        try {
          yield { event: pendingEvent, data: JSON.parse(raw) };
        } catch { /* skip malformed lines */ }
        pendingEvent = null;
      }
    }
  }
}

/**
 * A deterministic keyword-based vector (256-dim) used when no embedding API is available.
 * Good enough for keyword-match RAG. Replaced by real vectors when an embedding provider is set.
 * @param {string} text
 * @returns {number[]}
 */
export function keywordVector(text) {
  const words = String(text).toLowerCase().match(/\b[a-z]{2,}\b/g) ?? [];
  const vec = new Array(256).fill(0);
  for (const word of words) {
    // djb2 hash
    let h = 5381;
    for (let i = 0; i < word.length; i++) h = ((h << 5) + h) ^ word.charCodeAt(i);
    vec[(h >>> 0) % 256] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * Cosine similarity between two equal-length vectors. Returns 0–1.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
export function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
