// runtime/providers/index.js — Provider factory and resolution.
//
// Resolution order (first match wins):
//   1. ai.configure() called from Future code       → highest priority
//   2. FUTURE_AI_PROVIDER + FUTURE_AI_API_KEY        → named preset
//   3. FUTURE_AI_BASE_URL + FUTURE_AI_API_KEY        → custom OpenAI-compat endpoint
//   4. ANTHROPIC_API_KEY                             → Anthropic (original default)
//   5. Nothing found                                 → null (offline stub)
//
// Supported FUTURE_AI_PROVIDER values:
//   anthropic | openai | ollama | openrouter | gemini | venice | groq | together

import process from 'node:process';
import * as anthropic    from './anthropic.js';
import * as openaiCompat from './openai-compat.js';

// Holds a config set by ai.configure() from within a Future program.
let _runtimeConfig = null;

/**
 * Called by ai.configure() in the Future runtime.
 * Takes the highest priority over all environment variables.
 */
export function setRuntimeConfig(config) {
  _runtimeConfig = config;
}

export function getRuntimeConfig() {
  return _runtimeConfig;
}

/**
 * Resolve and instantiate the active AI provider.
 * Returns null if no provider is configured (offline mode).
 * @returns {{ name, ask, chat, stream, embed } | null}
 */
export function resolveProvider() {
  // 1. Programmatic config from ai.configure()
  if (_runtimeConfig) return buildProvider(_runtimeConfig);

  const providerName = process.env.FUTURE_AI_PROVIDER?.toLowerCase();
  const apiKey       = process.env.FUTURE_AI_API_KEY;
  const model        = process.env.FUTURE_AI_MODEL;

  // 2. Named preset via FUTURE_AI_PROVIDER
  if (providerName && apiKey) {
    if (providerName === 'anthropic') {
      return anthropic.create({ apiKey, model: model ?? undefined });
    }
    const preset = openaiCompat.PRESETS[providerName];
    const baseUrl = process.env.FUTURE_AI_BASE_URL ?? preset?.baseUrl;
    if (!baseUrl) {
      console.warn(`[ai] Unknown FUTURE_AI_PROVIDER "${providerName}". Set FUTURE_AI_BASE_URL.`);
      return null;
    }
    return openaiCompat.create({
      baseUrl,
      apiKey,
      model:      model ?? undefined,
      embedModel: preset?.embedModel ?? undefined,
    });
  }

  // 3. Custom OpenAI-compat endpoint via env
  if (process.env.FUTURE_AI_BASE_URL && apiKey) {
    return openaiCompat.create({
      baseUrl:    process.env.FUTURE_AI_BASE_URL,
      apiKey,
      model:      model ?? undefined,
    });
  }

  // 4. Anthropic legacy default
  if (process.env.ANTHROPIC_API_KEY) {
    return anthropic.create({ apiKey: process.env.ANTHROPIC_API_KEY, model: model ?? undefined });
  }

  return null; // offline
}

/** Build a provider from an explicit config object (used by ai.configure()). */
function buildProvider(config) {
  if (config.provider === 'anthropic' || (!config.baseUrl && !config.provider)) {
    return anthropic.create(config);
  }
  const preset = openaiCompat.PRESETS[config.provider ?? ''] ?? {};
  return openaiCompat.create({
    baseUrl:    config.baseUrl ?? preset.baseUrl,
    apiKey:     config.apiKey,
    model:      config.model   ?? undefined,
    embedModel: config.embedModel ?? preset.embedModel ?? undefined,
  });
}
