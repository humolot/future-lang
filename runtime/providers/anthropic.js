// runtime/providers/anthropic.js — Anthropic native Messages API.
// Supports: ask, chat, stream. embed() falls back to keyword vectors
// because Anthropic doesn't have a public embeddings endpoint yet.

import { parseSSE, keywordVector } from './util.js';

const BASE = 'https://api.anthropic.com/v1';

/**
 * Create an Anthropic provider instance.
 * @param {{ apiKey: string, model?: string }} config
 */
export function create(config) {
  const key   = config.apiKey;
  const model = config.model ?? 'claude-sonnet-4-6';

  const headers = {
    'content-type':      'application/json',
    'x-api-key':         key,
    'anthropic-version': '2023-06-01',
  };

  async function chat(messages) {
    const res = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, max_tokens: 1024, messages }),
    });
    if (!res.ok) throw new Error(`[anthropic] HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.content ?? []).map((b) => b.text ?? '').join('').trim();
  }

  async function ask(prompt) {
    return chat([{ role: 'user', content: String(prompt) }]);
  }

  async function stream(messages, onChunk) {
    const res = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, max_tokens: 1024, messages, stream: true }),
    });
    if (!res.ok) throw new Error(`[anthropic] stream HTTP ${res.status}`);
    for await (const { event, data } of parseSSE(res.body)) {
      if (event === 'content_block_delta' || data?.type === 'content_block_delta') {
        onChunk(data.delta?.text ?? '');
      }
    }
  }

  async function embed(text) {
    // Anthropic has no public embeddings endpoint — use keyword vector fallback.
    // For production semantic search, configure an OpenAI-compatible provider with an embed model.
    return keywordVector(String(text));
  }

  return { name: 'anthropic', ask, chat, stream, embed };
}
