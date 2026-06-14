# Future — Migration & Changelog

All releases are **additive only**. No existing Future program has ever required changes to compile and run.

---

## v0.5.1 → v0.5.2 (current — `db.connect()` with PostgreSQL and MySQL)

**No breaking changes.** `db.open()` still works as before.

### `db.connect(url)` — multi-database support

A single function connects to any supported database. The driver is auto-detected from the URL scheme:

```future
# SQLite — local file, no server needed (default)
db.connect("./app.db")
db.connect(":memory:")                            # in-memory SQLite

# PostgreSQL
db.connect("postgres://user:pass@localhost/mydb")

# MySQL / MariaDB
db.connect("mysql://user:pass@localhost/mydb")
```

Install only the driver you need:

```bash
npm install better-sqlite3   # SQLite
npm install pg               # PostgreSQL
npm install mysql2           # MySQL / MariaDB
```

All `db.*` operations (`query`, `get`, `insert`, `update`, `delete`) work identically across all three drivers. `?` placeholders in SQL are automatically rewritten to `$1, $2, ...` for PostgreSQL — no code changes needed when switching databases.

`db.open(path)` remains as a backward-compatible alias for `db.connect(path)` with SQLite.

---

## v0.4.6 → v0.5.0 (HTTP server + SQLite database + array indexing)

**No breaking changes.**

### HTTP server namespace (`server`)

Register route handlers with a block syntax. The server keeps running until the process exits.

```future
server.get("/api/users")
  users = db.query("SELECT * FROM users")
  return users
end

server.post("/api/users")
  name = req.body.name
  result = db.insert("users", { name: name })
  return result
end

server.listen(3000)
print "Listening on http://localhost:3000"
```

- `server.get/post/put/patch/delete("path") ... end` — register a route; implicit `req` variable available inside
- `req.params` — URL path parameters (e.g. `:id` in `/users/:id`)
- `req.body` — parsed JSON or URL-encoded body
- `req.query` — parsed query string
- `req.headers` — request headers
- `server.listen(port)` — start the server (resolves when ready)
- `server.close()` — stop the server
- Returns JSON for objects, plain text for strings, 204 for null
- No external dependencies — uses Node.js built-in `http` module

### SQLite database namespace (`db`)

Requires `better-sqlite3` (already listed as an optional dependency):

```bash
npm install better-sqlite3   # first time only
```

```future
db.open("./app.db")
db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)")

# Query
rows = db.query("SELECT * FROM users WHERE name LIKE ?", ["%alice%"])
row  = db.get("SELECT * FROM users WHERE id = ?", [1])

# Write
result = db.insert("users", { name: "Alice" })
print result.id

db.update("users", { name: "Alicia" }, "id = ?", [result.id])
db.delete("users", "id = ?", [result.id])

db.close()
```

- `db.open(path)` — open or create an SQLite file
- `db.exec(sql)` — run DDL (CREATE TABLE, etc.)
- `db.query(sql, params?)` → array of rows
- `db.get(sql, params?)` → first row or null
- `db.insert(table, data)` → `{ id, changes }`
- `db.update(table, data, where, params?)` → `{ changes }`
- `db.delete(table, where, params?)` → `{ changes }`
- `db.close()` — close the connection

### Array / object index access (`expr[n]`)

```future
rows = db.query("SELECT COUNT(*) as total FROM users")
first = rows[0]
print first.total
```

Index expressions now work everywhere — on arrays, objects, and anything that returns a subscriptable value:

```future
items = [10, 20, 30]
print items[0]        # 10
print items[1]        # 20
```

Previously, `rows[0]` was incorrectly split into two statements. This is now fixed.

### New example: `api-server.future`

A complete REST CRUD API with SQLite persistence. See `examples/api-server.future`.

```bash
npm install better-sqlite3
future run examples/api-server.future
# curl http://localhost:3000/api/users
```

---

## v0.4.4 → v0.4.5 (`future demo` command)

**No breaking changes.**

### New CLI command: `future demo`

Run bundled examples directly from anywhere, no need to navigate to the package folder:

```bash
future demo                  # list all available demos
future demo dashboard        # run the dashboard demo
future demo crypto-tracker   # run the crypto tracker
future demo --copy           # copy all demos to ./examples/ in current directory
```

---

## v0.4.3 → v0.4.4 (Examples & VS Code extension)

**No breaking changes.**

### What's new

- **5 real working examples** using free public APIs (no key needed):
  - `examples/crypto-tracker.future` — BTC/ETH/SOL prices via Coinbase
  - `examples/weather-now.future` — current weather via Open-Meteo
  - `examples/hacker-news.future` — HN top stories via Firebase API
  - `examples/pokemon-ai.future` — Pokédex via PokeAPI + optional AI description
  - `examples/dashboard.future` — all APIs combined in one run
  - `examples/ai-memory-chat.future` — multi-turn AI with accumulated context
- **VS Code extension** published to Marketplace — search "Future Lang" in VS Code or `ext install humolot.future-lang-vscode`
- README badges (npm · VS Code Marketplace · MIT)

---

## v0.4.2 → v0.4.3 (Browser runtime sync)

**No breaking changes.**

### Browser runtime fully synced with CLI runtime

`runtime/browser.js` now matches the CLI runtime feature-for-feature:

| Feature | Before | After |
|---------|--------|-------|
| `ai.ask/chat/stream` opts | ❌ | ✅ `{ temperature, max_tokens, model, system }` |
| `ai.complete()` | ❌ | ✅ Returns `{ text, model, provider, tokens }` |
| `AiError` class | ❌ | ✅ `.status`, `.code`, `.provider`, `.body` |
| `http.configure({ headers, timeout })` | ❌ | ✅ Global request defaults |
| `HttpError` class | ❌ | ✅ `.status`, `.statusText`, `.code`, `.url`, `.body` |
| `assert` namespace | ❌ | ✅ `ok`, `equal`, `notEqual`, `deepEqual`, `fail` |
| Token counts in `ai.complete()` | — | ✅ Reads from provider response |
| `AbortSignal.timeout` in `http` | ❌ | ✅ Used when timeout is configured |

The browser `assert` is implemented natively (no `node:assert` dependency) with the same error shape as the CLI version.

`AiError` and `HttpError` are now exported from `future-browser.js` for use in JS integrations:
```js
import Future, { AiError, HttpError } from './future-browser.js';
```

The proxy contract is extended — servers can now handle `/complete`:
```
POST {proxy}/complete  { prompt?, messages, ...opts }  → { text, model, provider, tokens }
```
If `/complete` is not implemented, the browser runtime falls back to `/ask` automatically.

---

## v0.4.1 → v0.4.2 (ai.complete, future ast, capability layers)

**No breaking changes.**

### `ai.complete(prompt, opts)` → structured response

```future
result = ai.complete("Explain recursion in one sentence.")
print result.text
print "Tokens: {result.tokens.total}"
print "Model:  {result.model}"
```

Returns `{ text, model, provider, tokens: { input, output, total } }`. Both Anthropic and OpenAI-compat providers read token usage from the API response.

### `future ast <file.future>` — new CLI command

```bash
future ast program.future           # compact JSON
future ast --pretty program.future  # indented JSON
```

Outputs the full AST. Useful for tooling, LSP integrations, and AI assistants generating Future code.

### Capability layers documentation

README and FUTURE_FOR_LLMS.md now include a three-layer table:

| Layer | Namespaces |
|-------|-----------|
| Core language | *(none — just syntax)* |
| Standard | `math` `http` `memory` `system` `schedule` |
| Extended | `ai` `rag` `vision` `mqtt` `tts` `home` `device` `agent` |
| Testing | `assert` |

---

## v0.4.0 → v0.4.1 (Gemini improvements)

**No breaking changes.**

### AI inference options

`ai.ask`, `ai.chat`, and `ai.stream` now accept an optional second argument with inference parameters:

```future
# temperature controls creativity (0.0 = deterministic, 1.0 = creative)
precise  = ai.ask("List the planets.", { temperature: 0.1  max_tokens: 100 })
creative = ai.chat(messages, { temperature: 0.9  model: "gpt-4o" })
ai.stream(prompt, { temperature: 0.7 })
```

Supported fields: `temperature`, `max_tokens`, `model`, `system` (Anthropic only).
Both providers (Anthropic native, OpenAI-compat) forward all opts to the API.

### Structured errors

`HttpError` and `AiError` replace generic `Error` objects. Catchable with `try/catch err`:

```future
try
    data = http.get("https://api.example.com/private")
catch err
    print "{err.status}"    # 401
    print "{err.code}"      # HTTP_401
    print "{err.url}"       # https://api.example.com/private
end

try
    reply = ai.ask("hello")
catch err
    print "{err.provider}"  # anthropic
    print "{err.status}"    # 429
    print "{err.code}"      # AI_HTTP_429
end
```

Error classes are exported from `runtime/providers/anthropic.js` (`AiError`) and `runtime/http.js` (`HttpError`) for use in JS integrations.

### `http.configure()` — global request defaults

```future
# Call once at the top of your program
http.configure({ headers: { Authorization: "Bearer {token}" }  timeout: 5000 })

# All subsequent http.get / http.post calls include the header and timeout automatically
data = http.get("https://api.example.com/me")
```

Supported fields: `headers` (merged with per-call headers), `timeout` (ms, uses `AbortSignal.timeout`).

### Source maps (`future compile --sourcemap`)

```bash
future compile --sourcemap program.future
# Produces: program.js  +  program.js.map
```

The `.js.map` is a standard Source Map v3 file. Stack traces in Node.js, VS Code, and browser DevTools automatically map back to the original `.future` line numbers.

The generator embeds `/*@FL:N*/` markers at each statement and `src/sourcemap.js` post-processes them into VLQ-encoded mappings.

### `future test` command + `assert` namespace

```bash
future test            # finds and runs all *.test.future / test/**/*.future files
future test myfeature  # filter by filename substring
```

Test files use the reserved `assert` namespace:

```future
# calculator.test.future
assert.equal(1 + 1, 2)
assert.ok(math.sqrt(16) == 4)
assert.notEqual("hello", "world")
assert.deepEqual([1, 2, 3], [1, 2, 3])
```

Exit code 0 when all pass, 1 when any fail. `assert.*` calls throw `AssertionError` on failure — the test runner catches them and reports per-file results.

`assert` is a reserved namespace — it cannot be redefined by user code.

### Internal changes

- `runtime/assert.js` — new module, wraps `node:assert/strict`
- `src/sourcemap.js` — new module, VLQ encoder + Source Map v3 builder
- `runtime/providers/anthropic.js` — exports `AiError` class; `chat`/`stream` accept `opts`
- `runtime/providers/openai-compat.js` — imports `AiError`; `chat`/`stream` accept `opts`
- `runtime/http.js` — exports `HttpError` class; `get`/`post` throw it; adds `configure()`; uses `AbortSignal.timeout`
- `runtime/index.js` — `assert` added to module list, `_base`, and `manifest`
- `src/generator.js` — `assert` added to `NAMESPACES`; `sourceMaps` option emits `/*@FL:N*/` markers
- `src/parser.js` — `assert` added to `RESERVED_NAMESPACES`
- `src/cli.js` — `future test` command; `--sourcemap` flag in `future compile`; calls `buildSourceMap()` to strip markers and write `.js.map`

---

## v0.3.2 → v0.4.0 (CLI + Import system + Language improvements)

**No breaking changes.**

### CLI commands

```bash
future run <file.future>        # compile + run
future compile <file.future>    # compile to .js next to source
future new <name>               # scaffold a new project directory
future check <file.future>      # syntax-check only, no output
future fmt <file.future>        # auto-format source in-place
future playground               # launch the interactive playground
future doctor                   # check Node.js version, runtime, AI env, MQTT, etc.
future --version                # show version
future run --debug <file>       # print per-call timing to stderr (FUTURE_DEBUG=1)
```

### Import system (`use`)

```future
# Import all top-level functions by name
use "./utils.future"
print formatName("Alice")

# Import as a namespace
use "./math.future" as m
result = m.add(10, 20)

# Import an npm package as a namespace
use "date-fns" as df
```

Compiles to standard ES module imports:

```js
import { formatName } from "./utils.js";
import * as m from "./math.js";
import * as df from "date-fns";
```

The compiler reads imported `.future` files at compile time, parses them, and extracts top-level function names to generate named imports instead of wildcard imports. Dependencies are compiled recursively.

`use ... as alias` aliases are excluded from `__rt` routing — `m.add()` does not become `__rt.m.add()`.

### `else if` chains

```future
if score >= 90
    print "A"
else if score >= 80
    print "B"
else if score >= 70
    print "C"
else
    print "F"
end
```

One `end` closes the entire chain. Previously required nesting.

### Reserved namespace protection

Trying to reassign a namespace name now raises a compile-time error:

```future
math = 42   # error[parse]: 'math' is a reserved namespace
http = {}   # error[parse]: 'http' is a reserved namespace
```

### Async handler error safety (`__safe`)

Programs that use `on`, `every`, or `stream` now wrap their handlers in `__safe`. Errors inside handlers are logged to `stderr` with `[future:ns]` prefix instead of crashing the process silently:

```js
const __safe = (ns, fn) => async (...a) => {
  try { return await fn(...a); }
  catch (e) { console.error(`[future:${ns}]`, e.message); }
};
```

### Better error messages

Parse errors now show the source line and a `^` pointer:

```
error[parse]: Expected 'end' to close 'if' — did you forget 'end'?
  --> hello.future:5:1
   5 | x = 1
      ^
```

### `FUTURE_FOR_LLMS.md`

A complete quick-reference for AI assistants generating Future code: BNF grammar, all keywords, all namespace APIs, every construct with an example, common mistakes, and what-compiles-to-what pairs.

### Internal changes

- `src/lexer.js` — `as` keyword added (`AS` token)
- `src/ast.js` — `UseStatement` node type and factory added
- `src/parser.js` — `parseUse()`, `parseIf(isChained)` updated; `RESERVED_NAMESPACES` set added
- `src/generator.js` — `genUseStatement()`, `useAliases` Set, `isModule` and `pathMap` options, `__safe` emission, `else if` chain detection
- `src/index.js` — `compile()` accepts `resolveSource`, `isModule`, `pathMap`, `importedNames` options
- `src/formatter.js` — new module: line-based indentation formatter
- `src/cli.js` — full rewrite; `compileDepsToTemp()` for `future run`; all CLI commands implemented

---

## v0.3.1 → v0.3.2 (Phase 7: General-Purpose Programming)

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
