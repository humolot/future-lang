// runtime/rag/chunker.js — Document chunking for RAG pipelines.
// Splits text into overlapping chunks so long documents don't exceed embedding context windows.

const DEFAULT_CHUNK_SIZE    = 512;  // characters
const DEFAULT_CHUNK_OVERLAP = 64;   // characters of overlap between chunks

/**
 * Normalize an input document into a plain string.
 * Accepts: string, { text }, { content }, { body }, or JSON-stringifiable object.
 * @param {any} doc
 * @returns {string}
 */
export function docToText(doc) {
  if (typeof doc === 'string') return doc;
  if (doc && typeof doc === 'object') {
    return String(doc.text ?? doc.content ?? doc.body ?? JSON.stringify(doc));
  }
  return String(doc ?? '');
}

/**
 * Split text into overlapping character chunks.
 * Tries to split at sentence boundaries (`. `) rather than mid-word.
 * @param {string} text
 * @param {{ size?: number, overlap?: number }} [opts]
 * @returns {string[]}
 */
export function chunk(text, opts = {}) {
  const size    = opts.size    ?? DEFAULT_CHUNK_SIZE;
  const overlap = opts.overlap ?? DEFAULT_CHUNK_OVERLAP;
  const chunks  = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + size, text.length);

    // Try to break at a sentence boundary if we're not at the end.
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('. ', end);
      if (lastPeriod > start + size / 2) end = lastPeriod + 2;
    }

    const part = text.slice(start, end).trim();
    if (part) chunks.push(part);
    start = Math.max(start + 1, end - overlap);
  }

  return chunks;
}

/**
 * Turn an array of raw documents into an array of chunk objects ready for embedding.
 * @param {any[]} docs
 * @param {{ size?: number, overlap?: number }} [opts]
 * @returns {{ text: string, source: any, chunkIndex: number }[]}
 */
export function chunkDocs(docs, opts = {}) {
  const result = [];
  for (const doc of docs) {
    const text   = docToText(doc);
    const chunks = chunk(text, opts);
    chunks.forEach((text, i) => result.push({ text, source: doc, chunkIndex: i }));
  }
  return result;
}
