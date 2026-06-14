// future-browser.js — Browser runtime for the Future programming language.
//
// Usage:
//   <script type="module" src="future-browser.js"></script>
//
//   <!-- Option A: Proxy mode (production — key stays on your server) -->
//   <script>Future.configure({ proxy: '/api/ai' })</script>
//
//   <!-- Option B: Demo mode (key visible in HTML — dev/demos only) -->
//   <script>Future.configure({ provider: 'openai', apiKey: 'sk-...' })</script>
//
//   <!-- Then write Future code anywhere on the page -->
//   <script type="future">
//     answer = ai.ask("Olá mundo")
//     print answer
//   </script>
//
// Proxy contract (for Option A):
//   POST {proxy}/ask      { prompt, ...opts }    → { text }
//   POST {proxy}/chat     { messages, ...opts }  → { text }
//   POST {proxy}/complete { prompt, messages }   → { text, model, provider, tokens }
//   POST {proxy}/stream   { prompt, ...opts }    → SSE (OpenAI delta format)
//   POST {proxy}/embed    { text }               → { embedding: number[] }
//
// opts: { temperature?, max_tokens?, model? }

import { tokenize } from './src/lexer.js';
import { parse }    from './src/parser.js';
import { generate } from './src/generator.js';
import { browserRuntime, setProxy, ai, AiError, HttpError } from './runtime/browser.js';

// ─── Public API ───────────────────────────────────────────────────────────────

const Future = {
  /**
   * Configure the browser runtime.
   *
   * Proxy mode (production):
   *   Future.configure({ proxy: '/api/ai' })
   *
   * Demo mode (development):
   *   Future.configure({ provider: 'openai', apiKey: 'sk-...' })
   *   Future.configure({ provider: 'anthropic', apiKey: 'sk-ant-...' })
   *   Future.configure({ provider: 'ollama' })   // local, no key needed
   */
  configure(options = {}) {
    if (options.proxy) {
      setProxy(options.proxy);
    }
    if (options.provider || options.apiKey) {
      ai.configure(options.provider ?? 'openai', options.apiKey ?? null, options.model ?? null);
    }
  },

  /**
   * Compile and run a Future source string.
   * Returns a Promise that resolves when the program finishes.
   */
  async run(source) {
    let js;
    try {
      js = generate(parse(tokenize(String(source))), { browserMode: true });
    } catch (e) {
      console.error('[Future] Compile error:', e.message);
      throw e;
    }
    // Wrap in async IIFE; __rt is passed as parameter (not a global).
    // __rt is always passed — even in SIMPLE mode — so __rt.print is available.
    const fn = new Function('__rt', `return (async () => {\n${js}\n})()`);
    return fn(browserRuntime);
  },

  /** Compile Future source to JavaScript without running it. */
  compile(source) {
    return generate(parse(tokenize(String(source))), { browserMode: true });
  },

  /** The underlying runtime object — useful for REPL or direct capability calls. */
  runtime: browserRuntime,
};

// ─── <script type="future"> interceptor ──────────────────────────────────────

async function runScripts() {
  const scripts = document.querySelectorAll('script[type="future"]');
  for (const script of scripts) {
    const source = script.textContent ?? '';
    if (!source.trim()) continue;
    try {
      await Future.run(source);
    } catch (e) {
      console.error(`[Future] Runtime error in <script type="future">:`, e);
    }
  }
}

// Defer runScripts with setTimeout so all <script type="module"> blocks on the
// page (including configuration scripts that set proxy or override print) finish
// initialising before any <script type="future"> block runs.
setTimeout(runScripts, 0);

// ─── Expose globally ──────────────────────────────────────────────────────────

window.Future = Future;
export default Future;
export { AiError, HttpError };
