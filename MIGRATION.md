# Future — Migration & Changelog

All releases are **additive only**. No existing Future program has ever required changes to compile and run.

---

## v0.3.1 → v0.3.2 (current — Phase 7: General-Purpose Programming)

**No breaking changes.**

### New built-in: `len(x)`

```future
items = [1, 2, 3, 4, 5]
print len(items)    # 5
print len("hello")  # 5
obj = { a: 1  b: 2 }
print len(obj)      # 2
```

`len()` is a sync built-in — it never triggers ASYNC mode on its own. Programs that only use `len()` still compile to plain synchronous JavaScript. Works on arrays, strings, and objects (falls back to `Object.keys().length` for objects).

### New module: `math`

```future
print math.round(3.7)         # 4
print math.floor(3.9)         # 3
print math.ceil(3.1)          # 4
print math.abs(-5)            # 5
print math.sqrt(16)           # 4
print math.pow(2, 8)          # 256
print math.min(1, 5, 3)       # 1
print math.max(1, 5, 3)       # 5
print math.random()           # 0.0–1.0
print math.log(math.e)        # 1
print math.pi                 # 3.14159...
print math.e                  # 2.71828...
```

`math.*` calls are capability calls — they trigger ASYNC mode and are routed through `__rt.math.*`. `math.pi` and `math.e` are constants (property access, not function calls).

### New built-in: `input(prompt)`

```future
name = input("What is your name? ")
print "Hello, {name}!"
```

`input()` is an async built-in — it always triggers ASYNC mode. In Node.js it reads a line from stdin via `readline`. In the browser it calls `window.prompt()`.

### Namespace references inside strings

String interpolation now correctly handles namespace property access:

```future
print "Pi is {math.pi}"
print "Euler: {math.e}"
```

Previously, `{math.pi}` inside a string literal would emit `${math.pi}` — a ReferenceError at runtime because `math` is not a JS variable. Now it emits `${__rt.math.pi}` in ASYNC mode.

The fix also triggers ASYNC mode detection for programs where the only namespace usage is inside a string.

### Browser runtime (`future-browser.js`)

The browser runtime bundles the full compiler and a browser-compatible capability set. It can be loaded with a single `<script>` tag.

```html
<script type="module" src="future-browser.js"></script>

<script type="module">
  import Future from './future-browser.js'
  Future.configure({ proxy: '/api/ai' })
  Future.runtime.print = (...args) =>
    document.getElementById('output').textContent += args.join(' ') + '\n'
</script>

<script type="future">
scores = [85, 92, 78]
n = len(scores)
avg = math.round((85 + 92 + 78) / n)
print "Average: {avg}"
</script>
```

API key security options:
- **Proxy mode** (`Future.configure({ proxy: '/api/ai' })`) — key stays on your server.
- **Demo mode** (`Future.configure({ provider: 'openai', apiKey: 'sk-...' })`) — key visible in source, dev/demos only.

### Internal compiler changes

- `NAMESPACES` in `src/generator.js` — `'math'` added.
- `usesRuntime()` — now detects `input()` calls, namespace `MemberExpression` nodes, and `{namespace.prop}` patterns inside `StringLiteral` values.
- `usesBuiltin(node, name)` — new helper to detect specific built-in call sites (used for `len`).
- `Generator.genStringLiteral()` — promoted from a standalone function to an instance method, gains access to `this.asyncMode` and `NAMESPACES` to correctly prefix namespace refs with `__rt.`.
- `genCall()` — special-cases `len` → `__len(args)` and `input` → `await __rt.input(args)`.
- `runtime/math.js` — new module, 12 exports (10 functions + 2 constants).
- `runtime/index.js` — `math` added to module list + manifest; `runtime.input` added (readline-based).
- `runtime/browser.js` — `math` module and `input` function added; `browserRuntime` object updated.

### Reserved keywords added

- `math` — now a reserved namespace identifier (cannot be used as a variable name).
- `input` — built-in identifier (shadowing it with a user variable is not recommended).

---

## v0.3.0 → v0.3.1 (Phase 6: Core Language)

**No breaking changes.**

### New language features

#### List literals

```future
items = [1, 2, 3]
names = ["Alice", "Bob"]
empty = []
```

Emits a standard JS array literal. Elements can be any expression.

#### `for item in list ... end`

```future
for name in names
  print "Hello {name}"
end
```

Compiles to `for (const item of list) { … }`. The loop variable is block-scoped (`const`), not hoisted.

#### `try ... catch err ... end`

```future
try
  result = ai.ask("question")
catch err
  print "Error: {err}"
end
```

Compiles to a standard JS `try/catch`. The catch variable is block-scoped — not hoisted to the outer `let` block. Before this, any runtime error would crash the program with an unhandled rejection.

#### Object literals

```future
user = {
  name: "João"
  age: 30
}
```

No commas between properties — whitespace and newlines act as separators. Optional commas are also accepted for users who prefer them. Emits a standard JS object literal with quoted keys.

#### String interpolation

```future
name = "João"
print "Olá {name}, você tem {user.age} anos"
```

Any string containing `{identifier}` or `{identifier.prop}` is automatically emitted as a JS template literal. No syntax changes required. To emit a literal `{` without interpolation, escape it: `\{`.

### New runtime functions

#### `system.read(path)` and `system.write(path, content)`

```future
content = system.read("config.json")
system.write("output.txt", result)
```

`read` returns the file content as a string (UTF-8). `write` creates or overwrites the file, and returns the path that was written.

#### `rag.indexFile(path)` and `rag.indexUrl(url)`

```future
rag.indexFile("manual.txt")
rag.indexUrl("https://docs.example.com/api")
answer = rag.query("How do I reset the device?")
```

`indexFile` reads a local file and indexes its content into the default knowledge base. `indexUrl` fetches a URL, strips HTML tags, and indexes the resulting text. Both support any text-based format (TXT, MD, JSON, CSV, HTML). For PDFs, convert first: `system.exec("pdftotext manual.pdf manual.txt")`.

### Reserved keywords added

The following words are now reserved and cannot be used as variable names:

- `for`, `in` — iteration
- `try`, `catch` — error handling
- `while` — condition-based loop
- `null`, `none` — null literal
- `stream` — streaming statement
- `agent`, `use` — agent declaration

No real-world program is expected to be affected — these are common programming keywords.

### New language constructs

#### `while condition ... end`

```future
count = 0
while count < 10
  count = count + 1
end
```

Compiles to `while (cond) { ... }`. Variables assigned inside the body are hoisted to the outer scope.

#### `null` and `none` literals

```future
x = null
if x == none
  print "sem valor"
end
```

Both `null` and `none` are synonyms — both compile to JS `null`.

#### `stream <call> ... end`

```future
stream ai.ask("Conta uma história")
  print chunk
end
```

Compiles to `await __rt.<namespace>.stream(args, async (chunk) => { ... })`. The body receives an implicit `chunk` variable with each streamed piece of text. Activates ASYNC mode automatically. The call must be a capability call (e.g. `ai.ask`, `ai.chat`).

#### `agent <name> ... end`

```future
agent support
  use rag
  use memory

  docs = rag.query(goal)
  memory.set("last", goal)
  return docs
end

answer = support("Como faço reset?")
```

Compiles to `async function name(goal) { ... }`. The body receives an implicit `goal` parameter — no need to declare it. `use <capability>` lines are documentation only (no generated code). An `agent` declaration always activates ASYNC mode so the call site correctly `await`s the result.

### Internal compiler changes

- Lexer: tokens LBRACKET (`[`), RBRACKET (`]`), LBRACE (`{`), RBRACE (`}`), COLON (`:`) added.
- Lexer: `\{` in string literals is stored as `\x01` (placeholder) to prevent generator from treating it as an interpolation start.
- Parser: `parseFor()`, `parseTry()`, `parseArrayLiteral()`, `parseObjectLiteral()` added.
- Parser: `EXPR_TERMINATORS` now includes `CATCH` — prevents `return` inside a `try` block from trying to parse `catch` as a value.
- Generator: `collectAssignedNames` now recurses into `ForStatement.body` and `TryStatement.body/catchBody`. Loop and catch variables are intentionally excluded from hoisting.
- Generator: `genStringLiteral()` function replaces direct `JSON.stringify` for all string values — handles interpolation detection and `\x01` restoration.

---

## v0.2.0 → v0.3.0 (Phase 5: AI Stack)

**No breaking changes.**

### Added — PROMPT_1 (Runtime Foundation)

#### New language keywords
- `on` — event subscription: `on mqtt "topic" ... end`
- `every` — recurring task: `every "30m" ... end`

> These are reserved words. Rename variables named `on` or `every` if any exist.

#### New runtime modules
| Module | Functions |
|--------|-----------|
| `memory` | `set`, `get`, `delete`, `search`, `forget` |
| `schedule` | `every`, `once`, `cron` |
| `system` | `exec`, `open`, `notify` |
| `device` | `register`, `get`, `list` |

#### Runtime introspection
- `runtime.listModules()` → all module names
- `runtime.listFunctions(mod)` → all function names in a module
- `runtime.describe()` → full manifest + version

#### Manifest upgrade
- Function signatures changed from `'async (prompt)'` strings to structured objects with `description`, `params`, `returns`, `async`.
- The manifest is consumed by tooling only — not by generated JS. No program is affected.

#### New exports
- `future-lang/runtime/lsp-metadata` — VSCode / LSP metadata module

---

### Added — PROMPT_2 (AI Stack)

#### AI provider abstraction
- `ai.configure(provider, key, model)` — configure from code
- `FUTURE_AI_PROVIDER` env var — switch providers without code change
- Supported: `anthropic`, `openai`, `gemini`, `ollama`, `openrouter`, `venice`, `groq`, `together`
- Gemini uses Google's OpenAI-compat endpoint — no extra SDK

#### New AI functions
- `ai.embed(text)` → `number[]` — vector embeddings (real or keyword fallback)
- `ai.stream(prompt, onChunk)` — streaming SSE response

#### Real RAG pipeline
- `rag.index(docs)` now runs a full pipeline: **chunk → embed → vector store → cosine index**
- `rag.query(question)` now runs: **embed query → similarity search → LLM answer**
- `rag.create(name)` → named Knowledge Base with isolated vector store
- `rag.stats()` → chunk and vector count
- Vector stores: `memory` (default), `file` (JSON persistence), cloud stubs (Qdrant/Pinecone/Weaviate)
- Offline mode: keyword-based vectors if no embedding API is configured

#### Vision upgrade
- `vision.describe` / `vision.detect` — now use real AI provider (were stubs)
- `vision.ocr(image)` — new: extract text from image
- `vision.classify(image)` — new: categorise image
- `vision.compare(imageA, imageB)` — new: describe differences

#### Memory upgrade
- `memory.forget(pattern?)` — delete by substring pattern or clear all

#### Generator fix
- In async mode, ALL method calls on dynamic objects are now `await`ed.
- `await` on a synchronous return value is harmless (`await "str"` returns `"str"`).
- This is required for `kb.query()` and any future runtime-returned objects.
- Existing programs: no change in behaviour.

#### AST additions (architecture only — no parser yet)
- `AgentDeclaration` — for `agent <name> ... end`
- `StreamStatement` — for `stream <call> ... end`

#### Internal refactoring (no public API change)
- `runtime/providers/` — provider factory, Anthropic, OpenAI-compat, SSE util
- `runtime/rag/` — chunker, vector store adapters, pipeline

---

## Verification

After any upgrade, run:

```bash
node --test
```

Expected: **33 tests, 0 failures.**

All existing example programs in `examples/` compile and run without modifications.

---

## Environment variable reference

| Variable | Default | Purpose |
|----------|---------|---------|
| `FUTURE_AI_PROVIDER` | *(auto)* | `anthropic` \| `openai` \| `gemini` \| `ollama` \| `openrouter` \| `venice` \| `groq` \| `together` |
| `FUTURE_AI_API_KEY` | — | API key for the selected provider |
| `FUTURE_AI_BASE_URL` | *(from preset)* | Override base URL for any OpenAI-compat provider |
| `FUTURE_AI_MODEL` | provider default | Model ID |
| `ANTHROPIC_API_KEY` | — | Legacy — activates Anthropic without `FUTURE_AI_PROVIDER` |
| `FUTURE_VECTOR_DB` | `memory` | `memory` \| `file` \| `qdrant` \| `pinecone` \| `weaviate` |
| `MQTT_URL` | *(loopback)* | MQTT broker URL, e.g. `mqtt://localhost:1883` |
