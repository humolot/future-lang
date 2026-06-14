// runtime/providers/anthropic.js — Anthropic native Messages API.
// Supports: ask, chat, stream. embed() falls back to keyword vectors
// because Anthropic doesn't have a public embeddings endpoint yet.

import { parseSSE, keywordVector } from './util.js';

const BASE = 'https://api.anthropic.com/v1';

export class AiError extends Error {
  constructor(status, provider, body) {
    const msg = body?.error?.message ?? body ?? `HTTP ${status}`;
    super(`[ai:${provider}] ${msg}`);
    this.name = 'AiError';
    this.status = status;
    this.code = `AI_HTTP_${status}`;
    this.namespace = 'ai';
    this.provider = provider;
    this.body = body;
  }
}

/**
 * Create an Anthropic provider instance.
 * @param {{ apiKey: string, model?: string }} config
 */
export function create(config) {
  const key          = config.apiKey;
  const defaultModel = config.model ?? 'claude-sonnet-4-6';

  const headers = {
    'content-type':      'application/json',
    'x-api-key':         key,
    'anthropic-version': '2023-06-01',
  };

  async function chat(messages, opts = {}) {
    const model      = opts.model      ?? defaultModel;
    const max_tokens = opts.max_tokens ?? 1024;
    const body       = { model, max_tokens, messages };
    if (opts.temperature != null) body.temperature = opts.temperature;
    if (opts.system)              body.system      = opts.system;

    const res = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errBody;
      try { errBody = await res.json(); } catch { errBody = await res.text(); }
      throw new AiError(res.status, 'anthropic', errBody);
    }
    const data = await res.json();
    return (data.content ?? []).map((b) => b.text ?? '').join('').trim();
  }

  async function ask(prompt, opts = {}) {
    return chat([{ role: 'user', content: String(prompt) }], opts);
  }

  async function stream(messages, onChunk, opts = {}) {
    const model      = opts.model      ?? defaultModel;
    const max_tokens = opts.max_tokens ?? 1024;
    const body       = { model, max_tokens, messages, stream: true };
    if (opts.temperature != null) body.temperature = opts.temperature;

    const res = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new AiError(res.status, 'anthropic', `stream HTTP ${res.status}`);
    for await (const { event, data } of parseSSE(res.body)) {
      if (event === 'content_block_delta' || data?.type === 'content_block_delta') {
        onChunk(data.delta?.text ?? '');
      }
    }
  }

  async function complete(messages, opts = {}) {
    const model      = opts.model      ?? defaultModel;
    const max_tokens = opts.max_tokens ?? 1024;
    const body       = { model, max_tokens, messages };
    if (opts.temperature != null) body.temperature = opts.temperature;
    if (opts.system)              body.system      = opts.system;

    const res = await fetch(`${BASE}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errBody;
      try { errBody = await res.json(); } catch { errBody = await res.text(); }
      throw new AiError(res.status, 'anthropic', errBody);
    }
    const data = await res.json();
    const text = (data.content ?? []).map((b) => b.text ?? '').join('').trim();
    return {
      text,
      model: data.model ?? model,
      provider: 'anthropic',
      tokens: {
        input:  data.usage?.input_tokens  ?? 0,
        output: data.usage?.output_tokens ?? 0,
        total:  (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
      },
    };
  }

  async function embed(text) {
    // Anthropic has no public embeddings endpoint — use keyword vector fallback.
    // For production semantic search, configure an OpenAI-compatible provider with an embed model.
    return keywordVector(String(text));
  }

  return { name: 'anthropic', ask, chat, complete, stream, embed };
}
