# Future

**An AI-first, IoT-first programming language that transpiles to JavaScript.**

Future reads like plain English, runs on Node.js, and gives every program built-in access to AI, HTTP, MQTT, memory, scheduling, and more — without `async`/`await` boilerplate. It also runs fully in the browser.

---

## Quick start

```bash
npm install -g future-lang
```

```future
# hello.future
name = "World"
print "Hello, {name}!"

scores = [85, 92, 78]
print "Count: {len(scores)}"
print "Best:  {math.max(85, 92, 78)}"

answer = ai.ask("What is the capital of Portugal? One word.")
print "AI says: {answer}"
```

```bash
npx future run hello.future
```

---

## Language features

### Variables and types

```future
name   = "Alice"
age    = 30
active = true
data   = null          # also: none
```

### String interpolation

```future
print "Hello, {name}! You are {age} years old."
print "Pi is approximately {math.pi}"
```

Any `{identifier}` or `{identifier.prop}` inside a string becomes a JS template literal. Escape a literal brace with `\{`.

### Arithmetic and logic

```future
sum  = 10 + 3 * 2
same = sum == 16
both = true and false
any  = true or false
neg  = not true
```

### Conditionals

```future
if age >= 18
  print "Adult"
else
  print "Minor"
end
```

### Lists and objects

```future
fruits = ["apple", "banana", "cherry"]
user   = { name: "João"  age: 30  city: "Lisbon" }

print user.name
print fruits.length
```

### Iteration

```future
for fruit in fruits
  print "I like {fruit}"
end

count = 0
while count < 5
  count = count + 1
end
```

### Functions

```future
function greet(name)
  return "Hello, {name}!"
end

msg = greet("Alice")
print msg
```

### Error handling

```future
try
  data = http.get("https://api.example.com/data")
  print data.title
catch err
  print "Request failed: {err}"
end
```

---

## Built-in functions

### `len(x)` — length of any value

```future
items = [1, 2, 3, 4, 5]
text  = "hello"
obj   = { a: 1  b: 2 }

print len(items)   # 5
print len(text)    # 5
print len(obj)     # 2 (number of keys)
```

### `math` — numeric operations

```future
print math.round(3.7)        # 4
print math.floor(3.9)        # 3
print math.ceil(3.1)         # 4
print math.abs(-5)           # 5
print math.sqrt(16)          # 4
print math.pow(2, 10)        # 1024
print math.max(1, 5, 3)      # 5
print math.min(1, 5, 3)      # 1
print math.random()          # random float 0–1
print math.log(math.e)       # 1
print math.pi                # 3.141592...
print math.e                 # 2.718281...
```

### `input(prompt)` — read user input

```future
name = input("What is your name? ")
print "Hello, {name}!"
```

In the browser this uses `window.prompt()`. In a Node.js CLI program it reads from stdin.

---

## Capabilities & the runtime

Future programs talk to the outside world through **namespace calls**. The compiler detects them and automatically switches the program to async mode — you never write `async` or `await`.

```future
# HTTP
todo = http.get("https://jsonplaceholder.typicode.com/todos/1")
print "Title: {todo.title}"

# AI
answer = ai.ask("Explain MQTT in one sentence")
tts.speak(answer)

# Home automation
home.turnOn("livingroom_light")
mqtt.publish("home/livingroom/light", "on")
```

### Available namespaces

| Namespace  | Functions | Notes |
|------------|-----------|-------|
| `http`     | `get(url)`, `post(url, body)`, `configure(opts)` | Parses JSON automatically; throws `HttpError` with `.status`, `.code`, `.body` |
| `ai`       | `ask(prompt, opts?)`, `chat(messages, opts?)`, `embed(text)`, `stream(prompt, cb, opts?)`, `configure(provider, key)` | opts: `{ temperature, max_tokens, model }`; throws `AiError` |
| `tts`      | `speak(text)` | System engine (`say` / SAPI / `espeak-ng`) |
| `mqtt`     | `publish(topic, msg)`, `subscribe(topic, handler)` | Real broker or in-process loopback |
| `memory`   | `set(key, v)`, `get(key)`, `delete(key)`, `search(q)`, `forget(pattern?)` | In-process key-value store |
| `schedule` | `every(interval, cb)`, `once(delay, cb)`, `cron(expr, cb)` | "30m", "5s", or milliseconds |
| `system`   | `exec(cmd)`, `open(target)`, `notify(msg)`, `read(path)`, `write(path, content)` | OS utilities |
| `rag`      | `index(docs)`, `query(question)`, `create(name)`, `indexFile(path)`, `indexUrl(url)` | Vector search + LLM answer |
| `vision`   | `describe(img)`, `detect(img)`, `ocr(img)`, `classify(img)`, `compare(a, b)` | Needs AI provider |
| `home`     | `turnOn(device)`, `turnOff(device)`, `set(device, value)` | Home automation via MQTT |
| `math`     | `round`, `floor`, `ceil`, `abs`, `sqrt`, `pow`, `log`, `random`, `min`, `max`, `pi`, `e` | Full Math wrapper |
| `device`   | `register(config)`, `get(name)`, `list()` | IoT device registry |
| `assert`   | `ok(val)`, `equal(a, b)`, `notEqual(a, b)`, `deepEqual(a, b)`, `fail(msg?)` | Use in `*.test.future` files |

### Configuration (environment variables)

```bash
FUTURE_AI_PROVIDER=anthropic     # anthropic | openai | gemini | ollama | openrouter | groq
FUTURE_AI_API_KEY=sk-...
FUTURE_AI_MODEL=claude-sonnet-4-6
ANTHROPIC_API_KEY=sk-ant-...     # legacy shortcut
MQTT_URL=mqtt://localhost:1883
FUTURE_VECTOR_DB=memory          # memory | file | qdrant
```

---

## AI configuration

```future
# Provider selection
ai.configure("openai", "sk-...")
ai.configure("ollama")           # local, no key needed

# Basic usage
answer = ai.ask("What is 2 + 2?")
print answer

# With inference options
precise = ai.ask("List the planets.", { temperature: 0.1  max_tokens: 150 })
creative = ai.chat(messages, { temperature: 0.9  model: "gpt-4o" })
```

## HTTP configuration

```future
# Set global headers and timeout once at the top of your program
http.configure({ headers: { Authorization: "Bearer {token}" }  timeout: 5000 })

data = http.get("https://api.example.com/me")   # Authorization header included automatically
```

## Structured errors

HTTP and AI errors now carry structured data you can inspect:

```future
try
    data = http.get("https://api.example.com/private")
catch err
    print "Status: {err.status}"     # e.g. 401
    print "Code:   {err.code}"       # e.g. HTTP_401
    print "URL:    {err.url}"
end

try
    reply = ai.ask("hello")
catch err
    print "Provider: {err.provider}"  # e.g. anthropic
    print "Status:   {err.status}"    # e.g. 429
end
```

---

## Agents

Agents are named async tasks with an implicit `goal` parameter. `use` declarations are documentation — they don't generate code.

```future
agent support
  use rag
  use memory

  docs = rag.query(goal)
  memory.set("last_query", goal)
  return docs
end

answer = support("How do I reset the device?")
print answer
```

Compiles to `async function support(goal) { ... }`.

---

## Streaming

```future
stream ai.ask("Tell me a short story")
  print chunk
end
```

Compiles to `await __rt.ai.stream(prompt, async (chunk) => { ... })`.

---

## Event-driven programming

```future
on mqtt "house/temp"
  print "Temperature: {message}"
end

every "30m"
  data = http.get("https://api.example.com/stats")
  print data.count
end
```

---

## RAG (Retrieval-Augmented Generation)

```future
# Index documents
rag.index(["Future is a language.", "It compiles to JavaScript."])
rag.indexFile("manual.txt")
rag.indexUrl("https://docs.example.com")

# Query
answer = rag.query("What does Future compile to?")
print answer

# Named knowledge bases
kb = rag.create("products")
kb.index(["Product A costs $10."])
reply = kb.query("How much is Product A?")
print reply
```

---

## Browser runtime

Future also runs in the browser — no Node.js required.

```html
<script type="module" src="future-browser.js"></script>

<!-- Option A: proxy mode (API key stays on your server) -->
<script type="module">
  import Future from './future-browser.js'
  Future.configure({ proxy: '/api/ai' })
  Future.runtime.print = (...args) => {
    document.getElementById('output').textContent += args.join(' ') + '\n'
  }
</script>

<!-- Option B: direct key (dev/demos only — key is visible in source) -->
<script type="module">
  import Future from './future-browser.js'
  Future.configure({ provider: 'openai', apiKey: 'sk-...' })
</script>

<script type="future">
names = ["Alice", "Bob", "Carlos"]
for name in names
  print "Hello, {name}!"
end

answer = ai.ask("One fun fact about Lisbon.")
print answer
</script>
```

Open `future-playground.html` in any browser for a live editor with 11 built-in examples.

---

## CLI

```bash
npm install -g future-lang

future --version                         # show version
future new myapp                         # create a new project
future run program.future                # compile + run
future run --debug program.future        # run with per-call timing logs
future compile program.future            # compile to JavaScript
future compile --sourcemap program.future  # compile + emit .js.map
future test                              # run all *.test.future files
future test myfeature                    # run matching test files
future check program.future              # syntax check only
future fmt program.future                # format source in-place
future playground                        # launch the interactive playground
future doctor                            # check your environment
```

---

## Testing

Name your test files `*.test.future` (or put them in a `test/` folder) and use the `assert` namespace:

```future
# math.test.future

assert.equal(math.round(3.7), 4)
assert.equal(math.sqrt(16), 4)
assert.ok(math.pi > 3.14)
assert.notEqual(math.random(), math.random())
print "math tests passed"
```

```bash
future test            # runs all *.test.future files
future test math       # runs files matching "math"
```

Output:
```
math tests passed
  ✓ math.test.future

1/1 tests passed
```

---

## Import system

Split code across files with `use`:

```future
# utils.future
function formatName(name)
    return "User: {name}"
end
```

```future
# main.future

# import all functions by name
use "./utils.future"
print formatName("Alice")

# import as a namespace
use "./math.future" as m
result = m.add(10, 20)
print result
```

Compiles to standard ES module imports:

```js
import { formatName } from "./utils.js";
import * as m from "./math.js";
```

---

## How it works

The compiler is a three-phase pipeline:

```
Source (.future)  →  Lexer  →  Parser  →  Generator  →  JavaScript
```

**SIMPLE mode** — programs with no capability calls compile to plain, synchronous JS with no imports.

**ASYNC mode** — any capability call (`http.get`, `ai.ask`, `math.round`, `input`, …) switches the program to async mode. The generator imports `future-lang/runtime` as `__rt` and wraps every function in `async`/`await`. The user writes none of this.

---

## Package exports

```json
{
  ".":                      "./src/index.js",
  "./runtime":              "./runtime/index.js",
  "./runtime/lsp-metadata": "./runtime/lsp-metadata.js"
}
```

---

## Documentation

- [ARCHITECTURE.md](https://github.com/humolot/future-lang/blob/main/ARCHITECTURE.md) — compiler pipeline, folder structure, AST node types
- [ROADMAP.md](https://github.com/humolot/future-lang/blob/main/ROADMAP.md) — feature status and priorities
- [MIGRATION.md](https://github.com/humolot/future-lang/blob/main/MIGRATION.md) — changelog, what changed between versions
