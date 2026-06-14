# Future — Architecture & Folder Structure

## Overview

Future is an AI-first, IoT-first programming language that transpiles to JavaScript and runs on Node.js (and in the browser). The compiler is a classic three-phase pipeline: **Lex → Parse → Generate**. Capabilities (AI, HTTP, MQTT, math, …) are runtime modules — adding a new capability never requires a grammar change.

---

## Folder Structure

```
future-lang/
│
├── src/                            # Compiler frontend
│   ├── index.js                    # Public API — compile(source, options)
│   ├── lexer.js                    # Phase 1: source text → token list
│   ├── parser.js                   # Phase 2: token list → AST
│   ├── ast.js                      # AST node types and factory functions (24 types)
│   ├── generator.js                # Phase 3: AST → JavaScript source
│   ├── errors.js                   # FutureError with line/column tracking
│   ├── formatter.js                # Line-based auto-formatter (future fmt)
│   ├── sourcemap.js                # VLQ encoder + Source Map v3 builder
│   └── cli.js                      # CLI binary: 9 commands including future test
│
├── runtime/                        # Capability modules (imported by generated JS)
│   ├── index.js                    # Aggregator: runtime object + manifest + introspection
│   │
│   ├── ai.js                       # Text generation — ask/chat/stream accept opts {temperature, max_tokens, model}
│   ├── http.js                     # REST API — HttpError class, configure() for global headers/timeout
│   ├── mqtt.js                     # Pub/sub messaging (real broker or in-process loopback)
│   ├── tts.js                      # Text-to-speech (system engine)
│   ├── rag.js                      # RAG — chunk → embed → store → retrieve → answer
│   ├── vision.js                   # Vision AI — describe, detect, ocr, classify, compare
│   ├── home.js                     # Home automation (composes over MQTT)
│   │
│   ├── assert.js                   # Test assertions — ok/equal/notEqual/deepEqual/fail
│   ├── memory.js                   # In-process key-value store (set/get/search/delete/forget)
│   ├── schedule.js                 # Recurring / one-shot / cron scheduling
│   ├── system.js                   # OS utilities: exec, open, notify, read, write
│   ├── device.js                   # IoT device registry
│   ├── math.js                     # Math module: round/floor/ceil/abs/sqrt/pow/log/random/min/max/pi/e
│   ├── browser.js                  # Browser-compatible runtime (no Node.js deps)
│   ├── lsp-metadata.js             # VSCode / LSP metadata generated from the manifest
│   │
│   ├── providers/                  # AI provider implementations
│   │   ├── index.js                # Provider factory + env-var resolution
│   │   ├── anthropic.js            # Anthropic Messages API — AiError class, opts forwarding
│   │   ├── openai-compat.js        # OpenAI-compatible (OpenAI, Ollama, Gemini, OpenRouter, …)
│   │   └── util.js                 # SSE parser, keyword vector, cosine similarity
│   │
│   └── rag/                        # RAG pipeline internals
│       ├── chunker.js              # Document → overlapping text chunks
│       ├── vector-store.js         # Vector store adapters (memory, file, cloud stubs)
│       └── pipeline.js             # Full pipeline: index() and query()
│
├── test/                           # Node built-in test runner suites
│   ├── lexer.test.js
│   ├── parser.test.js
│   ├── generator.test.js
│   ├── runtime.test.js
│   ├── capabilities.test.js
│   └── e2e.test.js
│
├── examples/                       # Demo Future programs
│   ├── hello.future
│   ├── greet.future
│   ├── adult.future
│   ├── math.future
│   ├── api.future
│   ├── assistant.future
│   └── smarthome.future
│
├── future-browser.js               # Browser entry point: window.Future + <script type="future">
├── future-playground.html          # In-browser editor (11 examples, live compile)
├── FUTURE_FOR_LLMS.md              # BNF grammar + all APIs — quick-reference for AI assistants
├── package.json
├── ARCHITECTURE.md                 # This file
├── ROADMAP.md                      # Feature roadmap
└── MIGRATION.md                    # Changelog and migration notes
```

---

## Compiler Pipeline

```
Source text (.future)
       │
       ▼
  [ Lexer ]           src/lexer.js
  Token list          24 keywords, operators, strings, numbers
       │
       ▼
  [ Parser ]          src/parser.js
  AST (Program node)  Recursive-descent, 23 node types
       │
       ▼
  [ Generator ]       src/generator.js
  JavaScript source   SIMPLE or ASYNC mode
       │
       ▼
  Node.js / Browser runtime
  (imports future-lang/runtime as __rt)
```

### Two output modes

| Mode | Trigger | Output |
|------|---------|--------|
| **SIMPLE** | No capability calls, no `on`/`every`, no `input()`, no `math.*` | Plain synchronous JS, no imports |
| **ASYNC** | Any capability call, `on`, `every`, `input()`, `math.*`, `agent`, `stream` | ES module with `import { runtime as __rt }`, all functions `async`, all method calls `await`ed |

The user never writes `async` or `await` — the compiler injects them automatically.

In **browser mode** (`browserMode: true` option), the `import` statement is omitted and `print` is routed through `__rt.print` so it can be redirected to the DOM.

---

## Lexer

### Keywords (26)

| Keyword | Token | Purpose |
|---------|-------|---------|
| `print` | PRINT | Output statement |
| `if` | IF | Conditional |
| `else` | ELSE | Else branch |
| `end` | END | Block terminator |
| `function` | FUNCTION | Function declaration |
| `return` | RETURN | Return statement |
| `true` / `false` | TRUE / FALSE | Boolean literals |
| `and` / `or` / `not` | AND / OR / NOT | Logical operators |
| `on` | ON | Event subscription |
| `every` | EVERY | Recurring task |
| `for` | FOR | List iteration |
| `in` | IN | Used with `for` |
| `try` | TRY | Error handling |
| `catch` | CATCH | Error handler branch |
| `while` | WHILE | Condition-based loop |
| `null` / `none` | NULL | Null literal (two spellings) |
| `stream` | STREAM | Streaming statement |
| `agent` | AGENT | Agent declaration |
| `use` | USE | Import statement / capability declaration inside `agent` |
| `as` | AS | Alias in `use "..." as alias` |

### String escape

`\{` in source text is stored as the placeholder `\x01` during lexing. The generator converts it back to a literal `{` when building template literals, preventing accidental interpolation.

---

## AST Node Types (24)

| Category | Nodes |
|----------|-------|
| Program | `Program` |
| Statements | `PrintStatement`, `Assignment`, `IfStatement`, `FunctionDeclaration`, `ReturnStatement`, `ExpressionStatement` |
| Import | `UseStatement` — `use "path"` / `use "path" as alias` |
| Control flow | `ForStatement`, `WhileStatement`, `TryStatement` |
| Event statements | `OnStatement`, `EveryStatement` |
| AI/IoT statements | `AgentDeclaration`, `StreamStatement` |
| Expressions | `BinaryExpression`, `UnaryExpression`, `CallExpression`, `MemberExpression` |
| Literals | `Identifier`, `NumberLiteral`, `StringLiteral`, `BooleanLiteral`, `NullLiteral`, `ArrayLiteral`, `ObjectLiteral` |

---

## Generator

### SIMPLE vs ASYNC detection (`usesRuntime`)

The generator walks the full AST before emitting any code. ASYNC mode is triggered by any of:

- A `CallExpression` whose callee is `<namespace>.<method>` (namespace call)
- A `CallExpression` to the built-in `input()` function
- A `MemberExpression` where the object is a known namespace (e.g. `math.pi`)
- A `StringLiteral` whose value contains `{namespace.prop}` interpolation
- An `OnStatement`, `EveryStatement`, `StreamStatement`, or `AgentDeclaration`

### Built-in functions

Two built-in identifiers are special-cased in the generator — they do not go through the namespace routing:

| Built-in | Trigger ASYNC? | Emitted JS |
|----------|---------------|------------|
| `len(x)` | No | `__len(x)` — helper emitted once at top of program |
| `input(prompt)` | Yes | `await __rt.input(prompt)` |

The `__len` helper is only emitted when `len` is actually used:
```js
function __len(x) { return x == null ? 0 : (x.length ?? Object.keys(x).length); }
```

### Namespace set

```js
export const NAMESPACES = new Set([
  'ai', 'http', 'mqtt', 'tts',
  'rag', 'vision', 'home',
  'memory', 'schedule', 'system', 'device',
  'math', 'assert',
]);
```

Any identifier in this set, when used as the object of a `MemberExpression` or `CallExpression`, is routed through `__rt` in ASYNC mode. Adding a new capability is just a name in this set plus a matching runtime module — no grammar change.

`use ... as alias` imports are tracked in a `useAliases` Set and explicitly excluded from namespace routing — `m.add()` never becomes `__rt.m.add()`.

### Source maps (`sourceMaps` option)

When `compile(source, { sourceMaps: true })` is used, the generator prefixes each top-level statement line with `/*@FL:N*/` (where N is the original `.future` line number). `src/sourcemap.js` post-processes this output:

1. Scans the generated JS line by line.
2. Strips `/*@FL:N*/` markers.
3. Builds VLQ-encoded `mappings` in Source Map v3 format.
4. Returns `{ code: cleanJS, map: { version: 3, sources, sourcesContent, mappings } }`.

The CLI appends `//# sourceMappingURL=file.js.map` to the clean JS and writes the map as JSON.

### Import system (UseStatement)

`use "./file.future"` statements are emitted before all other code. At compile time, when `resolveSource` is provided, the compiler reads the imported file, parses it, and extracts top-level `FunctionDeclaration` names. This enables named imports:

```js
import { formatName, greet } from "./utils.js";   // named import (default)
import * as m from "./math.js";                    // namespace import (alias)
import * as df from "date-fns";                    // npm package (alias)
```

The `pathMap` option (a `Map<futurePath, fileURL>`) allows `future run` to redirect imports to temp `.mjs` files compiled in `tmpdir`.

### String interpolation

String literals containing `{identifier}` or `{identifier.prop}` are emitted as JS template literals. Namespace references inside strings are correctly prefixed with `__rt.` in ASYNC mode:

```future
print "π ≈ {math.pi}"
```

Emits (async/browser mode):
```js
__rt.print(`π ≈ ${__rt.math.pi}`);
```

The interpolation logic lives in `Generator.genStringLiteral()` — an instance method so it has access to `this.asyncMode` and `NAMESPACES`.

### Variable hoisting

All variables assigned at a scope level are collected by `collectAssignedNames` and declared as `let` at the top of that scope. The collector recurses into `if`, `for`, `while`, and `try/catch` bodies. Loop variables (`const item of …`) and catch variables (`catch (err)`) are **not** hoisted — they are block-scoped by JS design.

### Method call awaiting

In ASYNC mode, ALL call expressions where the callee is a `MemberExpression` are `await`ed — including calls on runtime-returned objects like `kb.query()`. `await` on a synchronous return value is harmless in JS, and this rule is required for the Knowledge Base API to work correctly.

---

## Runtime Architecture

```
runtime/index.js
│
├── Imports 13 capability modules (+ readline for input())
├── Exports `runtime` object  →  used as `__rt` in generated JS
├── Exports `manifest`        →  structured metadata for every function
└── Attaches introspection:
      runtime.listModules()       → string[]
      runtime.listFunctions(mod)  → string[]
      runtime.describe()          → { version, modules, manifest }
      runtime.input(prompt)       → Promise<string>  (stdin)
```

When `FUTURE_DEBUG=1` (`future run --debug`), the runtime is wrapped by `wrapDebug()` which proxies every namespace method to log timing and arguments to stderr with ANSI colours.

### Manifest shape (per function)

```js
{
  description: string,
  params: [{ name: string, type: string, optional?: boolean }],
  returns: string,
  async: boolean,
}
```

---

## Browser Runtime

`runtime/browser.js` is a self-contained browser-compatible runtime with no Node.js dependencies. It is bundled into `future-browser.js` along with the compiler.

```
future-browser.js
│
├── Imports compiler (lexer + parser + generator)
├── Imports browserRuntime from runtime/browser.js
└── Exposes window.Future:
      Future.configure({ proxy, provider, apiKey, model })
      Future.run(source)    → Promise (compile + execute)
      Future.compile(source) → string (JS output only)
      Future.runtime         → browserRuntime object
```

### `<script type="future">` interceptor

`future-browser.js` intercepts all `<script type="future">` tags on the page and executes them via `Future.run()`. Execution is deferred with `setTimeout(runScripts, 0)` so all `<script type="module">` configuration blocks (which set proxy, API key, or `print` override) finish initialising before any Future script runs.

### API key security (browser)

| Mode | Setup | Security |
|------|-------|----------|
| **Proxy** | `Future.configure({ proxy: '/api/ai' })` | Key stays on your server — recommended for production |
| **Demo** | `Future.configure({ provider: 'openai', apiKey: 'sk-...' })` | Key visible in source — dev/demos only |

Proxy contract:
```
POST {proxy}/ask    { prompt }    → { text }
POST {proxy}/chat   { messages }  → { text }
POST {proxy}/stream { prompt }    → SSE stream
POST {proxy}/embed  { text }      → { embedding: number[] }
```

---

## AI Provider Architecture

```
runtime/providers/index.js   ← resolveProvider()
│
├── runtime/providers/anthropic.js       ask / chat / stream / embed (keyword fallback)
└── runtime/providers/openai-compat.js   ask / chat / stream / embed (real embeddings)
    │
    └── Preset base URLs for:
        openai | ollama | openrouter | gemini | venice | groq | together
```

### Provider resolution order

```
1. ai.configure(provider, key, model)    ← called from Future code (highest priority)
2. FUTURE_AI_PROVIDER + FUTURE_AI_API_KEY    ← named preset (anthropic/openai/gemini/…)
3. FUTURE_AI_BASE_URL + FUTURE_AI_API_KEY    ← custom OpenAI-compat endpoint
4. ANTHROPIC_API_KEY                         ← legacy default
5. (nothing)                                 ← offline stub — program keeps running
```

---

## RAG Pipeline Architecture

```
Documents (strings, objects, or local files)
       │
       ▼
  [ Chunker ]           runtime/rag/chunker.js
  Overlapping chunks    sentence-aware splitting (512 chars, 64 overlap)
       │
       ▼
  [ Embedder ]          runtime/ai.js → provider.embed()
  Float vectors         real (OpenAI/Ollama) or keyword-based fallback
       │
       ▼
  [ Vector Store ]      runtime/rag/vector-store.js
  Indexed chunks        memory | file | qdrant* | pinecone* | weaviate*
       │                (* stubs — implement adapter to activate)
       ▼
  [ Retriever ]         cosine similarity search (top-k)
       │
       ▼
  [ Context Builder ]   runtime/rag/pipeline.js
  Ranked passages
       │
       ▼
  [ LLM Answer ]        ai.ask() with injected context
```

---

## Event-Oriented Statements

```future
on mqtt "house/temp"    →  await __rt.mqtt.subscribe(ch, async (message) => { … })
  print message
end

every "30m"             →  await __rt.schedule.every(interval, async () => { … })
  print "tick"
end
```

---

## Agent Architecture

```future
agent support
  use rag
  use memory
  docs = rag.query(goal)
  return docs
end
```

Compiles to:

```js
async function support(goal) {
  let docs;
  docs = await __rt.rag.query(goal);
  return docs;
}
```

- `goal` is the implicit parameter — automatically available inside the body.
- `use <capability>` lines are documentation only — no generated code.
- An `agent` declaration always forces ASYNC mode — callers `await` the result.

---

## Streaming Architecture

```future
stream ai.ask("Tell me a story")
  print chunk
end
```

Compiles to:

```js
await __rt.ai.stream("Tell me a story", async (chunk) => {
  __rt.print(chunk);
});
```

`chunk` is an implicit variable provided by the streaming callback. The call must be a namespace capability call.

---

## Adding a New Capability (5 steps)

1. Create `runtime/mymodule.js` with named exports.
2. Import it in `runtime/index.js`, add to `runtime` object, `MODULE_NAMES`, and `manifest`.
3. Add the namespace name to `NAMESPACES` in `src/generator.js`.
4. Add the namespace name to `RESERVED_NAMESPACES` in `src/parser.js`.
5. Add the module to `browserRuntime` in `runtime/browser.js` if browser support is wanted.

No grammar, lexer, or AST changes needed.

---

## Package Exports

```json
{
  ".":                       "./src/index.js",
  "./runtime":               "./runtime/index.js",
  "./runtime/lsp-metadata":  "./runtime/lsp-metadata.js"
}
```
