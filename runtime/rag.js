// runtime/rag.js — Public RAG module for Future programs.
//
// Existing syntax continues to work unchanged:
//   rag.index(docs)
//   answer = rag.query(question)
//
// New: named Knowledge Bases
//   kb = rag.create("company")
//   kb.index(["Contract clause A...", "Contract clause B..."])
//   answer = kb.query("What are the payment terms?")
//
// The pipeline is powered by runtime/rag/pipeline.js which handles:
//   Chunking → Embeddings → Vector Store → Similarity Search → LLM Answer

import { createPipeline } from './rag/pipeline.js';

// Default singleton pipeline used by rag.index() / rag.query()
const _default = createPipeline('default');

/**
 * Index documents into the default knowledge base.
 * Accepts: string[], objects with {text} or {content}, or plain text strings.
 * @returns {Promise<{ indexed: number, total: number }>}
 */
export async function index(docs) {
  const list = Array.isArray(docs) ? docs : [docs];
  return _default.index(list);
}

/**
 * Query the default knowledge base.
 * @param {string} question
 * @returns {Promise<string>} LLM-generated answer based on indexed content.
 */
export async function query(question) {
  return _default.query(String(question));
}

/**
 * Create a named Knowledge Base — an isolated RAG pipeline with its own vector store.
 *
 * Future example:
 *   kb = rag.create("legal")
 *   kb.index(["Contract clause A...", "Contract clause B..."])
 *   answer = kb.query("What are the payment terms?")
 *
 * @param {string} name   Identifier for this knowledge base.
 * @param {object} [opts] Options: { adapter, size, overlap }
 * @returns {object} Knowledge base with index(docs) and query(question) methods.
 */
export function create(name, opts = {}) {
  return createPipeline(String(name), opts);
}

/**
 * Index a local file directly — reads it and passes the content to the default pipeline.
 * Supports any text-based format: TXT, MD, JSON, CSV, HTML.
 * For PDFs, convert first: `system.exec("pdftotext manual.pdf manual.txt")`
 *
 * Future example:
 *   rag.indexFile("manual.txt")
 *   answer = rag.query("How do I reset the device?")
 *
 * @param {string} filePath  Path to the file.
 * @returns {Promise<{ indexed: number, total: number }>}
 */
export async function indexFile(filePath) {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(String(filePath), 'utf8');
  return _default.index([{ text: content, source: String(filePath) }]);
}

/**
 * Fetch a URL and index its text content.
 *
 * Future example:
 *   rag.indexUrl("https://docs.example.com/api")
 *   answer = rag.query("authentication")
 *
 * @param {string} url
 * @returns {Promise<{ indexed: number, total: number }>}
 */
export async function indexUrl(url) {
  const res  = await fetch(String(url));
  const text = await res.text();
  // Strip HTML tags for cleaner indexing.
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return _default.index([{ text: clean, source: String(url) }]);
}

/** Stats for the default pipeline (indexed chunk count, vector count). */
export function stats() {
  return _default.stats();
}

/**
 * Delete a document chunk by its ID from the default knowledge base.
 * @param {string} id  Chunk ID (from the internal `name:index` format).
 */
async function ragDelete(id) {
  return _default.delete(String(id));
}
export { ragDelete as delete };

/**
 * Clear all documents from the default knowledge base.
 */
export async function clear() {
  return _default.clear();
}
