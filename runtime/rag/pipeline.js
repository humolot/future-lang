// runtime/rag/pipeline.js — Full RAG pipeline.
//
// Architecture:
//   Documents → Chunking → Embedding → Vector Store → Similarity Search → LLM → Answer
//
// Each Knowledge Base is an isolated pipeline instance.
// The default KB used by rag.index() / rag.query() is a singleton.

import { chunkDocs, docToText } from './chunker.js';
import { createVectorStore }    from './vector-store.js';
import { resolveProvider }      from '../providers/index.js';

let _idCounter = 0;

/**
 * Create a named RAG pipeline (Knowledge Base).
 * @param {string} name   Identifier shown in logs.
 * @param {object} [opts]
 * @param {string} [opts.adapter]  Vector store adapter: "memory" | "file" | "qdrant" | …
 * @returns {KnowledgeBase}
 */
export function createPipeline(name = 'default', opts = {}) {
  const store = createVectorStore(opts);
  let   totalChunks = 0;

  /**
   * Index an array of documents (or file paths — file loading is caller's responsibility).
   * @param {any[]} docs
   */
  async function index(docs) {
    const provider = resolveProvider();
    const normalised = Array.isArray(docs) ? docs : [docs];
    const chunks     = chunkDocs(normalised, opts);

    for (const c of chunks) {
      const id     = `${name}:${_idCounter++}`;
      const vector = provider ? await provider.embed(c.text) : await import('../providers/util.js').then(m => m.keywordVector(c.text));
      store.add(id, vector, { text: c.text, source: String(c.source).slice(0, 200), chunkIndex: c.chunkIndex });
      totalChunks++;
    }
    return { indexed: chunks.length, total: totalChunks };
  }

  /**
   * Query the knowledge base and generate an LLM answer from retrieved context.
   * @param {string} question
   * @param {{ topK?: number, answerWithAI?: boolean }} [opts]
   * @returns {Promise<string>}
   */
  async function query(question, { topK = 5, answerWithAI = true } = {}) {
    if (store.size() === 0) {
      return '[rag] No documents indexed. Call rag.index(docs) first.';
    }

    const provider = resolveProvider();
    const { keywordVector } = await import('../providers/util.js');
    const qVector = provider ? await provider.embed(question) : keywordVector(question);
    const hits    = store.search(qVector, topK);

    if (hits.length === 0) return '[rag] No relevant documents found.';

    // Build context from top-k chunks
    const context = hits
      .map((h, i) => `[${i + 1}] ${h.metadata.text}`)
      .join('\n\n');

    if (!answerWithAI || !provider) {
      // Return raw context when no LLM is available
      return `Context:\n${context}`;
    }

    const prompt =
      `You are a helpful assistant. Answer the question using only the context below.\n\n` +
      `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;

    return provider.ask(prompt);
  }

  return {
    name,
    index,
    query,
    store,
    stats: () => ({ name, chunks: totalChunks, vectors: store.size() }),
  };
}
