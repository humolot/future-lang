# Future — Roadmap

**Version:** 0.4.1 · **Last updated:** 2026-06-13

Status legend: ✅ Done · 🔄 In progress · 📋 Planned · 💡 Idea

---

## General-Purpose Programming

| Feature | Status | Notes |
|---------|--------|-------|
| `len(x)` built-in | ✅ | Arrays, strings, and objects — no runtime needed (sync) |
| `math` module | ✅ | `round`, `floor`, `ceil`, `abs`, `sqrt`, `pow`, `log`, `random`, `min`, `max`, `pi`, `e` |
| `input(prompt)` built-in | ✅ | stdin (Node.js) / `window.prompt` (browser) |
| `while condition ... end` | ✅ | Condition-based loop |
| `null` / `none` literals | ✅ | Both compile to JS `null` |
| Multi-line strings | 📋 | Strings must be single-line today |
| String `+` concatenation | ✅ | Works via binary `+` operator |
| Integer division / modulo | 📋 | `math.trunc(a / b)` workaround for now |
| `use "other.future"` imports | ✅ | Named + namespace imports; npm packages; recursive deps |
| `else if` chains | ✅ | One `end` for the whole chain |
| Reserved namespace protection | ✅ | Compile-time error if reserved name is reassigned |
| REPL (`future repl`) | 💡 | Interactive shell with introspection |

---

## AI

| Feature | Status | Notes |
|---------|--------|-------|
| `ai.ask(prompt)` | ✅ | Single-turn Q&A |
| `ai.ask(prompt, opts)` | ✅ | `opts`: `temperature`, `max_tokens`, `model`, `system` |
| `ai.chat(messages)` | ✅ | Multi-turn conversation |
| `ai.chat(messages, opts)` | ✅ | Inference options forwarded to provider |
| `ai.embed(text)` | ✅ | Real embeddings (OpenAI/Ollama) + keyword fallback |
| `ai.stream(prompt, cb, opts?)` | ✅ | Streaming via SSE; opts forwarded |
| `stream ai.ask() ... end` syntax | ✅ | Language-level streaming with implicit `chunk` variable |
| `ai.configure(provider, key, model)` | ✅ | Pluggable provider from Future code |
| Structured `AiError` (status, code, provider) | ✅ | Catchable with rich properties |
| Provider: Anthropic | ✅ | Native Messages API |
| Provider: OpenAI | ✅ | Via OpenAI-compat layer |
| Provider: Ollama | ✅ | Local models, no key needed |
| Provider: OpenRouter | ✅ | Multi-model routing |
| Provider: Gemini | ✅ | Via Google's OpenAI-compat endpoint |
| Provider: Venice / Groq / Together | ✅ | Via OpenAI-compat layer |
| `FUTURE_AI_PROVIDER` env var | ✅ | Switch provider without code change |
| `ai.extract(text, schema)` | 📋 | Structured JSON extraction with a schema |
| `ai.classify(text, labels)` | 📋 | Zero-shot classification |

---

## RAG (Retrieval-Augmented Generation)

| Feature | Status | Notes |
|---------|--------|-------|
| `rag.index(docs)` | ✅ | Real pipeline: chunk → embed → store |
| `rag.query(question)` | ✅ | Similarity search + LLM answer generation |
| `rag.create(name)` — Knowledge Bases | ✅ | Isolated pipeline per KB |
| `kb.index(docs)` / `kb.query(q)` | ✅ | Fully awaited by compiler in async mode |
| `rag.stats()` | ✅ | Chunk count and vector count |
| `rag.indexFile(path)` | ✅ | Reads a local file and indexes it |
| `rag.indexUrl(url)` | ✅ | Fetches a URL and indexes its text |
| Chunker (sentence-aware, overlapping) | ✅ | 512-char chunks, 64-char overlap |
| Keyword vector fallback (offline RAG) | ✅ | Works with no embedding API |
| Vector store: memory | ✅ | In-process, cosine similarity |
| Vector store: file (JSON persistence) | ✅ | No native deps, survives restarts |
| Vector store: Qdrant | 📋 | Stub exists — implement `runtime/rag/qdrant.js` |
| Vector store: Pinecone / Weaviate | 📋 | Stubs exist |
| Source attribution in query results | 📋 | Return which chunks matched and their source |
| `rag.delete(id)` | 📋 | Remove a document from the index |

---

## MQTT

| Feature | Status | Notes |
|---------|--------|-------|
| `mqtt.publish(topic, message)` | ✅ | Real broker or in-process loopback |
| `mqtt.subscribe(topic, handler)` | ✅ | Callback on each message |
| `on mqtt "topic" ... end` | ✅ | Event-oriented syntax sugar |
| TLS/SSL connections (`mqtts://`) | 📋 | Already works via env var URL |
| QoS levels | 📋 | `mqtt.publish(topic, msg, { qos: 1 })` |
| Retained messages | 📋 | `mqtt.publish(topic, msg, { retain: true })` |
| `mqtt.unsubscribe(topic)` | 📋 | Cancel a subscription |
| `mqtt.disconnect()` | 📋 | Graceful shutdown |

---

## Home Automation

| Feature | Status | Notes |
|---------|--------|-------|
| `home.turnOn(device)` | ✅ | Publishes to `home/<device>/set` via MQTT |
| `home.turnOff(device)` | ✅ | |
| `home.set(device, value)` | ✅ | Arbitrary value (brightness, temperature, …) |
| `home.get(device)` | 📋 | Read current device state |
| `home.scene(name)` | 📋 | Activate a named scene |
| Home Assistant REST API backend | 📋 | Swap MQTT for HA long-lived token |
| Philips Hue direct integration | 💡 | `home.hue.*` sub-namespace |
| Matter / Thread support | 💡 | Local-network device control without cloud |

---

## Vision AI

| Feature | Status | Notes |
|---------|--------|-------|
| `vision.describe(image)` | ✅ | Uses configured AI provider (Claude/GPT-4o) |
| `vision.detect(image)` | ✅ | Object / label detection via prompt |
| `vision.ocr(image)` | ✅ | Text extraction from image |
| `vision.classify(image)` | ✅ | Primary category in 1–2 words |
| `vision.compare(imageA, imageB)` | ✅ | Similarity / diff description |
| Accepts URLs and base64 data-URIs | ✅ | |
| Local model (LLaVA via Ollama) | 📋 | Works with `FUTURE_AI_PROVIDER=ollama` + llava model |
| `vision.watch(cameraUrl, callback)` | 💡 | Continuous RTSP / webcam stream analysis |

---

## Device Management

| Feature | Status | Notes |
|---------|--------|-------|
| `device.register(config)` | ✅ | In-process registry |
| `device.get(name)` | ✅ | Look up by name |
| `device.list()` | ✅ | All registered devices |
| `device.update(name, changes)` | 📋 | Patch device config |
| `device.remove(name)` | 📋 | Deregister a device |
| `device.send(name, command)` | 📋 | Send a command to a registered device |
| Persistent registry (JSON / SQLite) | 📋 | Survives process restarts |
| AWS IoT Core / Azure IoT Hub | 💡 | Cloud-managed fleet |

---

## Memory

| Feature | Status | Notes |
|---------|--------|-------|
| `memory.set(key, value)` | ✅ | |
| `memory.get(key)` | ✅ | Returns null if not found |
| `memory.delete(key)` | ✅ | |
| `memory.search(query)` | ✅ | Substring match on key + value |
| `memory.forget(pattern?)` | ✅ | Delete by pattern or clear all |
| Persistent memory (file / Redis) | 📋 | Survives process restarts |
| Semantic memory search | 📋 | Use `ai.embed()` for similarity-based recall |
| Memory scoped to agents | 📋 | Namespaced per-agent store |

---

## Scheduling

| Feature | Status | Notes |
|---------|--------|-------|
| `schedule.every(interval, cb)` | ✅ | "30m", "5s", ms number |
| `schedule.once(delay, cb)` | ✅ | Run once after delay |
| `schedule.cron(expr, cb)` | ✅ | Requires optional `node-cron` package |
| `every "30m" ... end` syntax | ✅ | Compiles to `schedule.every` |
| `schedule.cancel(handle)` | 📋 | Stop a recurring task |
| `schedule.list()` | 📋 | List active tasks |

---

## System & OS

| Feature | Status | Notes |
|---------|--------|-------|
| `system.exec(command)` | ✅ | Run shell commands |
| `system.open(target)` | ✅ | OS default handler for files/URLs |
| `system.notify(message)` | ✅ | Desktop notification |
| `system.read(path)` | ✅ | Read a local file to string |
| `system.write(path, content)` | ✅ | Write (create or overwrite) a local file |
| `system.env(name)` | ✅ | Read environment variables; browser reads from `window.__env` |

---

## Agents

| Feature | Status | Notes |
|---------|--------|-------|
| `AgentDeclaration` AST node | ✅ | Architecture complete |
| `agent <name> use <cap> ... end` | ✅ | Compiles to `async function name(goal)` |
| `use <capability>` declarations | ✅ | Collected for tooling; no-op in generated JS |
| Implicit `goal` parameter | ✅ | Available inside agent body without declaration |
| Agent memory isolation | 📋 | Per-agent namespaced memory |
| Agent tools (function binding) | 📋 | Map Future functions to tool calls |
| Multi-agent orchestration | 💡 | Agents calling other agents |
| Tool-calling loop (ReAct) | 💡 | AI decides which tool to call each step |

---

## Language & Compiler

| Feature | Status | Notes |
|---------|--------|-------|
| Print, variables, if/else, functions | ✅ | Core language |
| Capability calls (auto-async, auto-await) | ✅ | |
| `on <source> <channel> ... end` | ✅ | Event subscription |
| `every <interval> ... end` | ✅ | Recurring task |
| Method calls on dynamic objects awaited | ✅ | Enables `kb.query()` pattern |
| `for item in list ... end` | ✅ | List iteration |
| `while condition ... end` | ✅ | Condition-based loop |
| `try ... catch err ... end` | ✅ | Error handling |
| Lists `[1, 2, 3]` | ✅ | Array literals |
| Object literals `{ key: value }` | ✅ | No commas required (Future style) |
| String interpolation `"Hello {name}"` | ✅ | Template literal output |
| Namespace refs in strings `"{math.pi}"` | ✅ | Correctly emits `${__rt.math.pi}` in async mode |
| `null` / `none` literals | ✅ | Both spellings compile to JS `null` |
| `stream <call> ... end` | ✅ | Streams chunks via implicit `chunk` variable |
| `agent <name> ... end` | ✅ | Named async task with implicit `goal` parameter |
| `len(x)` built-in | ✅ | Arrays, strings, objects — sync, no runtime needed |
| `math.*` module | ✅ | Full JS Math wrapper |
| `input(prompt)` built-in | ✅ | stdin (Node.js) / `window.prompt` (browser) |
| `else if` chains | ✅ | One `end` closes the whole chain |
| `use "./file.future"` imports | ✅ | Named or namespace imports, recursive deps |
| `use "npm-pkg" as alias` | ✅ | Import npm packages as namespaces |
| Reserved namespace protection | ✅ | Compile-time error on redefinition |
| Multi-line strings | 📋 | Strings must be single-line |
| REPL (`future repl`) | 💡 | Interactive shell with introspection |

---

## Browser Runtime

| Feature | Status | Notes |
|---------|--------|-------|
| `future-browser.js` — browser entry point | ✅ | Compiler + runtime bundled, no Node.js required |
| `<script type="future">` interceptor | ✅ | Deferred via `setTimeout` so modules run first |
| `Future.configure({ proxy })` | ✅ | Proxy mode — API key stays on server |
| `Future.configure({ provider, apiKey })` | ✅ | Demo mode — key visible in source |
| `Future.runtime.print` override | ✅ | Redirect output to DOM |
| `Future.run(source)` / `Future.compile(source)` | ✅ | Programmatic API |
| `future-playground.html` | ✅ | Live editor with 11 examples |
| AI modules (ai, rag, vision) | ✅ | Require key or proxy |
| http, memory, schedule, tts, math, device | ✅ | Fully supported in browser |
| `input()` in browser | ✅ | Uses `window.prompt` |
| MQTT in browser | 📋 | Needs WebSocket broker |
| `system.exec/read/write` in browser | ✗ | Not available (sandboxed) |

---

## HTTP

| Feature | Status | Notes |
|---------|--------|-------|
| `http.get(url, headers?)` | ✅ | Parses JSON or returns text |
| `http.post(url, body, headers?)` | ✅ | JSON body; parses response |
| `http.configure({ headers, timeout })` | ✅ | Global defaults for all requests |
| Structured `HttpError` (status, code, url, body) | ✅ | Catchable with rich properties |
| `http.put / patch / delete` | 📋 | Additional HTTP verbs |
| Response headers access | 📋 | `res.headers.get("content-type")` |

---

## Testing

| Feature | Status | Notes |
|---------|--------|-------|
| `future test` command | ✅ | Finds `*.test.future` / `test/**/*.future`, runs all |
| `future test <pattern>` | ✅ | Filter by filename substring |
| `assert` namespace | ✅ | `ok`, `equal`, `notEqual`, `deepEqual`, `fail` |
| Per-file pass/fail reporting | ✅ | `✓` / `✗` with error message |
| Exit code 1 on failure | ✅ | Integrates with CI |
| Test isolation (separate process) | 📋 | Currently runs in same Node process |
| `assert.throws(fn)` | 📋 | Assert that a function throws |
| Coverage reporting | 💡 | Line coverage for `.future` files |

---

## Tooling

| Feature | Status | Notes |
|---------|--------|-------|
| CLI: `future run` | ✅ | |
| CLI: `future compile` | ✅ | |
| CLI: `future compile --sourcemap` | ✅ | Emits Source Map v3 `.js.map` |
| CLI: `future run --debug` | ✅ | Per-call timing via `FUTURE_DEBUG=1` |
| CLI: `future test` | ✅ | Test runner for `*.test.future` files |
| CLI: `future new` | ✅ | Project scaffold |
| CLI: `future check` | ✅ | Syntax-check without running |
| CLI: `future fmt` | ✅ | Auto-formatter |
| CLI: `future doctor` | ✅ | Environment health check |
| CLI: `future playground` | ✅ | Launches browser playground server |
| Source maps (`.js.map`) | ✅ | VLQ-encoded Source Map v3 |
| Structured manifest | ✅ | All 13 modules, 50+ functions fully described |
| Runtime introspection API | ✅ | `runtime.describe()` / `listModules()` / `listFunctions()` |
| LSP metadata module | ✅ | Completions, hover, signatures |
| Browser playground | ✅ | `future-playground.html` — 11 examples |
| `FUTURE_FOR_LLMS.md` | ✅ | BNF grammar + all APIs for AI code assistants |
| npm publish (`future-lang`) | ✅ | Public — `npm install -g future-lang` |
| VSCode extension | 📋 | Syntax highlighting, completions, hover |
| Language Server (LSP) | 📋 | Full editor integration |

---

## Priority Matrix

| Priority | Item | Why it matters |
|----------|------|----------------|
| 🔴 Critical | VSCode extension (syntax highlighting) | First impression for new users |
| 🔴 Critical | Language Server (LSP) | Completions and hover for all IDEs |
| 🟠 High | `ai.extract(text, schema)` | Structured output is the #1 AI use case |
| 🟠 High | Test isolation (separate process) | Prevents test state leakage |
| 🟠 High | `assert.throws(fn)` | Needed for error-handling tests |
| 🟡 Medium | Home Assistant REST API | Most HA users don't run MQTT |
| 🟡 Medium | Persistent memory / device registry | Most programs are stateless today |
| 🟡 Medium | Agent tool-calling loop (ReAct) | True autonomous agents |
| 🟡 Medium | `http.put / patch / delete` | Needed for full REST APIs |
| 🟢 Low | `rag.delete(id)` | Selective document removal |
| 🟢 Low | REPL | Nice-to-have for exploration |
| 🟢 Low | Coverage reporting | `.future` line coverage |
