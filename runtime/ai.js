// runtime/ai.js — Public AI module for Future programs.
//
// Provider resolution is delegated to runtime/providers/index.js.
// See that file for the full resolution order and supported providers.
//
// Quick-start:
//   FUTURE_AI_PROVIDER=openai FUTURE_AI_API_KEY=sk-... future run my.future
//   FUTURE_AI_PROVIDER=ollama FUTURE_AI_MODEL=llama3.2 future run my.future
//   FUTURE_AI_PROVIDER=gemini FUTURE_AI_API_KEY=... future run my.future
//
// Or from Future code:
//   ai.configure("https://api.venice.ai/api/v1", "my-key", "llama-3.3-70b")

import { resolveProvider, setRuntimeConfig } from './providers/index.js';

/**
 * Configure the AI provider from Future code.
 * Accepts either a baseUrl (OpenAI-compat) or a named provider.
 *
 * Examples:
 *   ai.configure("https://api.venice.ai/api/v1", "key", "llama-3.3-70b")
 *   ai.configure("openai", "sk-...", "gpt-4o")
 *   ai.configure("anthropic", "sk-ant-...", "claude-sonnet-4-6")
 */
export function configure(baseUrlOrProvider, apiKey, model) {
  const first = String(baseUrlOrProvider);
  // If first arg looks like a URL, treat as OpenAI-compat baseUrl.
  const isUrl = first.startsWith('http');
  setRuntimeConfig({
    provider:  isUrl ? 'openai-compat' : first,
    baseUrl:   isUrl ? first : undefined,
    apiKey:    String(apiKey),
    model:     model ? String(model) : undefined,
  });
}

/**
 * Ask a single question.
 * @param {string} prompt
 * @param {{ temperature?: number, max_tokens?: number, model?: string, system?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function ask(prompt, opts = {}) {
  return chat([{ role: 'user', content: String(prompt) }], opts);
}

/**
 * Multi-turn chat.
 * @param {Array<{role,content}>} messages
 * @param {{ temperature?: number, max_tokens?: number, model?: string, system?: string }} [opts]
 * @returns {Promise<string>}
 */
export async function chat(messages, opts = {}) {
  const provider = resolveProvider();
  if (!provider) return offlineStub(messages);
  return provider.chat(messages, opts);
}

/**
 * Stream a response chunk-by-chunk.
 * @param {string|Array} promptOrMessages
 * @param {(chunk: string) => void} onChunk
 * @param {{ temperature?: number, max_tokens?: number, model?: string }} [opts]
 * @returns {Promise<void>}
 */
export async function stream(promptOrMessages, onChunk, opts = {}) {
  const messages = Array.isArray(promptOrMessages)
    ? promptOrMessages
    : [{ role: 'user', content: String(promptOrMessages) }];
  const provider = resolveProvider();
  if (!provider) { onChunk(offlineStub(messages)); return; }
  return provider.stream(messages, onChunk, opts);
}

/**
 * Like ask(), but returns a structured result object instead of a plain string.
 * Includes the generated text, model used, provider name, and token counts.
 *
 * @param {string|Array} prompt  String prompt or messages array
 * @param {{ temperature?: number, max_tokens?: number, model?: string, system?: string }} [opts]
 * @returns {Promise<{ text: string, model: string, provider: string, tokens: { input: number, output: number, total: number } }>}
 */
export async function complete(prompt, opts = {}) {
  const messages = Array.isArray(prompt)
    ? prompt
    : [{ role: 'user', content: String(prompt) }];
  const provider = resolveProvider();
  if (!provider) {
    return {
      text:     offlineStub(messages),
      model:    'none',
      provider: 'offline',
      tokens:   { input: 0, output: 0, total: 0 },
    };
  }
  if (typeof provider.complete === 'function') {
    return provider.complete(messages, opts);
  }
  // Fallback for providers that don't implement complete() yet.
  const text = await provider.chat(messages, opts);
  return {
    text,
    model:    opts.model ?? 'unknown',
    provider: provider.name,
    tokens:   { input: 0, output: 0, total: 0 },
  };
}

/**
 * Generate a vector embedding for a piece of text.
 * With OpenAI/Ollama providers, returns real semantic embeddings.
 * With Anthropic (no public embed API) or offline, returns keyword-based vectors.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  const provider = resolveProvider();
  if (!provider) {
    const { keywordVector } = await import('./providers/util.js');
    return keywordVector(String(text));
  }
  return provider.embed(text);
}

// --- helpers ---

function offlineStub(messages) {
  const preview = messages.map((m) => m.content).join(' ').slice(0, 80);
  return (
    '[ai offline] No provider configured.\n' +
    '  Option A — env: FUTURE_AI_PROVIDER=openai  FUTURE_AI_API_KEY=sk-...\n' +
    '             env: FUTURE_AI_PROVIDER=anthropic ANTHROPIC_API_KEY=sk-ant-...\n' +
    '             env: FUTURE_AI_PROVIDER=ollama   (no key needed for local)\n' +
    '  Option B — code: ai.configure("openai", "sk-...", "gpt-4o")\n' +
    `  Prompt: ${preview}`
  );
}
