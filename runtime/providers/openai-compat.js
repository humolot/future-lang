// runtime/providers/openai-compat.js
// Handles ALL OpenAI-compatible APIs with a single implementation:
//   OpenAI, Ollama, OpenRouter, Venice, Groq, Together, and
//   Gemini (via Google's official OpenAI-compatible endpoint).
//
// Gemini note: Google exposes /v1beta/openai/ which is fully compatible.
// No separate SDK or special casing needed.

import { parseSSE, keywordVector } from './util.js';
import { AiError } from './anthropic.js';

/**
 * Well-known provider presets. Used when FUTURE_AI_PROVIDER is set without FUTURE_AI_BASE_URL.
 * Users can always override by setting FUTURE_AI_BASE_URL directly.
 */
export const PRESETS = {
  openai:      { baseUrl: 'https://api.openai.com/v1',                              embedModel: 'text-embedding-3-small' },
  ollama:      { baseUrl: 'http://localhost:11434/v1',                               embedModel: 'nomic-embed-text' },
  openrouter:  { baseUrl: 'https://openrouter.ai/api/v1',                            embedModel: null },
  gemini:      { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', embedModel: 'text-embedding-004' },
  venice:      { baseUrl: 'https://api.venice.ai/api/v1',                            embedModel: null },
  groq:        { baseUrl: 'https://api.groq.com/openai/v1',                          embedModel: null },
  together:    { baseUrl: 'https://api.together.xyz/v1',                             embedModel: 'togethercomputer/m2-bert-80M-8k-retrieval' },
};

/**
 * Create an OpenAI-compatible provider instance.
 * @param {{ baseUrl: string, apiKey: string, model?: string, embedModel?: string }} config
 */
export function create(config) {
  const baseUrl      = config.baseUrl.replace(/\/$/, '');
  const apiKey       = config.apiKey;
  const defaultModel = config.model      ?? 'gpt-4o-mini';
  const embedModel   = config.embedModel ?? null;
  const providerTag  = `openai-compat(${baseUrl})`;

  const headers = {
    'content-type':  'application/json',
    'authorization': `Bearer ${apiKey}`,
  };

  async function chat(messages, opts = {}) {
    const model      = opts.model      ?? defaultModel;
    const max_tokens = opts.max_tokens ?? 1024;
    const body       = { model, messages, max_tokens };
    if (opts.temperature != null) body.temperature = opts.temperature;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let errBody;
      try { errBody = await res.json(); } catch { errBody = await res.text(); }
      throw new AiError(res.status, providerTag, errBody);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  async function ask(prompt, opts = {}) {
    return chat([{ role: 'user', content: String(prompt) }], opts);
  }

  async function stream(messages, onChunk, opts = {}) {
    const model      = opts.model      ?? defaultModel;
    const max_tokens = opts.max_tokens ?? 1024;
    const body       = { model, messages, max_tokens, stream: true };
    if (opts.temperature != null) body.temperature = opts.temperature;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new AiError(res.status, providerTag, `stream HTTP ${res.status}`);
    for await (const { data } of parseSSE(res.body)) {
      const chunk = data.choices?.[0]?.delta?.content;
      if (chunk) onChunk(chunk);
    }
  }

  async function embed(text) {
    if (!embedModel) return keywordVector(String(text));
    try {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: embedModel, input: String(text) }),
      });
      if (!res.ok) return keywordVector(String(text));
      const data = await res.json();
      return data.data?.[0]?.embedding ?? keywordVector(String(text));
    } catch {
      return keywordVector(String(text));
    }
  }

  return { name: providerTag, ask, chat, stream, embed };
}
