# Future — Reference for LLMs

Future is a small language that compiles to JavaScript. It does NOT exist in your training data. Read this file before generating Future code.

---

## Capability layers

| Layer | Namespaces | Notes |
|-------|-----------|-------|
| **Core language** | *(none)* | variables, if/end, for/end, while/end, try/catch/end, functions, lists, objects, strings, index access |
| **Standard** | `math` `http` `memory` `system` `schedule` `server` `db` | General-purpose I/O; triggers async mode |
| **Extended** | `ai` `rag` `vision` `mqtt` `tts` `home` `device` `agent` | AI, IoT, automation; triggers async mode |
| **Testing** | `assert` | Use only in `*.test.future` files |

Any call from Standard or Extended triggers ASYNC mode automatically.

---

## Reserved words

```
print  if  else  end  function  return  true  false  null  none
and  or  not  for  in  while  try  catch  on  every  stream
agent  use  as
```

Reserved namespaces (cannot be reassigned or used as function names):
```
ai  http  mqtt  tts  rag  vision  home  memory  schedule  system  device  math  assert  server  db
```

---

## Grammar (simplified BNF)

```
program     = statement*
statement   = print | assignment | if | function | return
            | for | while | try | on | every | stream | agent | use | server_route | expr_stmt

print       = "print" expression
assignment  = IDENTIFIER "=" expression
if          = "if" expression block ("else if" expression block)* ("else" block)? "end"
function    = "function" IDENTIFIER "(" params ")" block "end"
return      = "return" expression?
for         = "for" IDENTIFIER "in" expression block "end"
while       = "while" expression block "end"
try         = "try" block "catch" IDENTIFIER block "end"
on          = "on" IDENTIFIER expression block "end"
every       = "every" expression block "end"
stream      = "stream" call_expr block "end"
agent       = "agent" IDENTIFIER ("use" IDENTIFIER)* block "end"
use         = "use" STRING ("as" IDENTIFIER)?
server_route = "server" "." METHOD "(" STRING ")" block "end"
METHOD      = "get" | "post" | "put" | "patch" | "delete"

block       = statement*
params      = (IDENTIFIER ("," IDENTIFIER)*)?
expression  = or_expr
primary     = atom ("." IDENTIFIER | "(" args ")" | "[" expression "]")*
call_expr   = IDENTIFIER "(" args ")"
            | IDENTIFIER "." IDENTIFIER "(" args ")"
args        = (expression ("," expression)*)?
```

---

## Syntax rules

- Blocks end with `end` — NO curly braces, NO semicolons
- `#` starts a line comment
- Strings: `"double"` or `'single'`
- Multi-line strings: `"""..."""` or `'''...'''` — first newline stripped; interpolation and escapes work inside
- String interpolation: `"Hello, {name}!"` — any `{identifier}` or `{identifier.prop}`
- Escape literal brace: `\{`
- Modulo: `a % b` — same precedence as `*` and `/`
- `null` and `none` are the same
- Commas in lists: required — `[1, 2, 3]`
- Commas in objects: optional — `{ name: "Alice"  age: 30 }` or `{ name: "Alice", age: 30 }`
- Index access: `list[0]`, `rows[i]`, `map["key"]` — any expression inside `[]`

---

## Operators

### Arithmetic
| Operator | Meaning        | Example          |
|----------|----------------|------------------|
| `+`      | Addition       | `x = 1 + 2`      |
| `-`      | Subtraction    | `x = 5 - 3`      |
| `*`      | Multiplication | `x = 4 * 2`      |
| `/`      | Division       | `x = 10 / 4`     |
| `%`      | Modulo         | `x = 10 % 3`     |

### Comparison
| Operator | Meaning               | Example       |
|----------|-----------------------|---------------|
| `==`     | Equal                 | `x == 5`      |
| `!=`     | Not equal             | `x != 5`      |
| `>`      | Greater than          | `x > 5`       |
| `<`      | Less than             | `x < 5`       |
| `>=`     | Greater than or equal | `x >= 5`      |
| `<=`     | Less than or equal    | `x <= 5`      |

### Logical
| Operator | Meaning | Example                  |
|----------|---------|--------------------------|
| `and`    | AND     | `x > 0 and x < 10`      |
| `or`     | OR      | `x == 0 or x == 1`      |
| `not`    | NOT     | `not active`             |

**Never use** `&&`, `||`, `!` — they are JavaScript operators and will cause a parse error.

---

## Operator precedence

Higher rows bind tighter (evaluated first).

| Precedence | Operators          |
|------------|--------------------|
| Highest    | `*`  `/`  `%`      |
|            | `+`  `-`           |
|            | `>`  `<`  `>=`  `<=`  `==`  `!=` |
|            | `not`              |
|            | `and`              |
| Lowest     | `or`               |

```
print 1 + 2 * 3      # 7  — multiplication first
print (1 + 2) * 3    # 9  — parentheses override
print not true or true  # true — not binds tighter than or
```

Use parentheses whenever precedence is ambiguous to make intent clear.

---

## Every construct with example

### Variables
```
name = "Alice"
age  = 30
ok   = true
data = null
```

### Print
```
print "Hello, {name}!"
print age
```

### If / else if / else
```
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

### Function
```
function add(a, b)
    return a + b
end

result = add(3, 4)
print result
```

### For loop
```
fruits = ["apple", "banana", "cherry"]
for fruit in fruits
    print "I like {fruit}"
end
```

### While loop
```
count = 0
while count < 5
    count = count + 1
end
```

### Try / catch
```
try
    data = http.get("https://api.example.com/data")
    print data.title
catch err
    print "Error: {err}"
end
```

### Objects and lists
```
user   = { name: "João"  age: 30  city: "Lisbon" }
scores = [85, 92, 78]
print user.name
print scores.length
print scores[0]       # index access — 85
```

### Nested objects
```
user = {
    name: "Alice"
    profile: {
        city: "Lisbon"
        age: 30
    }
}

print user.name           # Alice
print user.profile.city   # Lisbon
print user.profile.age    # 30
```

### Arrays of objects
```
users = [
    { name: "Alice"  role: "admin" }
    { name: "Bob"    role: "user" }
    { name: "Carlos" role: "user" }
]

for user in users
    print "{user.name} is a {user.role}"
end

# Access by index
print users[0].name   # Alice
print users[1].role   # user
```

### String interpolation
```
msg = "Name: {user.name}, Age: {user.age}"
print msg
print "Pi is {math.pi}"
```

---

## Import system

```
# Import all functions from a file by name
use "./utils.future"
result = formatName("Alice")

# Import as a namespace
use "./math.future" as m
result = m.add(10, 20)

# Import an npm package as a namespace
use "date-fns" as df
```

Imported `.future` files must contain only top-level function declarations. They compile to ES module exports automatically.

---

## Capability namespaces

No `async`/`await` needed — the compiler handles it. Any namespace call switches the program to async mode automatically.

### `ai`
```
answer  = ai.ask("What is the capital of France?")
reply   = ai.chat([{ role: "user"  content: "Hello" }])
embed   = ai.embed("text to embed")
ai.configure("openai", "sk-...")
ai.configure("ollama")

# Structured extraction — returns a parsed object
person = ai.extract("John is 30 years old and lives in Lisbon", {
    name: "string"
    age: "number"
    city: "string"
})
print person.name   # John
print person.age    # 30

# Zero-shot classification — returns the matching label
label = ai.classify("I love this product!", ["positive", "negative", "neutral"])
print label   # positive

# With inference options
answer = ai.ask("Explain quantum physics", { temperature: 0.2  max_tokens: 200 })
reply  = ai.chat(messages, { model: "gpt-4o"  temperature: 0.7 })

# Structured response: text + token counts + model + provider
result = ai.complete("Summarise this in one line.")
print result.text
print result.tokens.total   # total tokens used
print result.model          # e.g. "claude-sonnet-4-6"
print result.provider       # e.g. "anthropic"

stream ai.ask("Tell me a story")
    print chunk
end
```

### `http`
```
data = http.get("https://api.example.com/todos/1")
print data.title

res  = http.post("https://api.example.com/items", { name: "Widget"  price: 9.99 })
res  = http.put("https://api.example.com/items/1", { name: "Widget Pro" })
res  = http.patch("https://api.example.com/items/1", { price: 12.99 })
http.delete("https://api.example.com/items/1")
print res.id

# Global config (call once at the top of your program)
http.configure({ headers: { Authorization: "Bearer {token}" }  timeout: 5000 })

# Errors have .status, .code, .url, .body properties
try
    data = http.get("https://api.example.com/private")
catch err
    print "Status: {err.status}"
    print "Code: {err.code}"
end
```

### `mqtt`
```
mqtt.publish("home/light", "on")

on mqtt "home/temp"
    print "Temperature: {message}"
end
```

### `tts`
```
tts.speak("Hello from Future!")
```

### `memory`
```
memory.set("key", "value")
val = memory.get("key")
memory.delete("key")
results = memory.search("query")           # substring search → [{ key, value }]
memory.forget()          # clear all
memory.forget("prefix")  # clear matching keys

# Semantic similarity search (uses AI embeddings; falls back to keyword vectors)
memory.set("note1", "the cat sat on the mat")
memory.set("note2", "quantum physics equations")
hits = memory.searchSemantic("feline animals", 2)  # topK=2
for h in hits
    print "{h.key}: {h.score}"
end

# Persistent memory — survives process restarts
memory.persist("./memory.json")   # save to file
memory.load("./memory.json")      # load from file

# Or set FUTURE_MEMORY_FILE=./memory.json to auto-load/save on every write
```

### `schedule`
```
every "30m"
    data = http.get("https://api.example.com/stats")
    print data.count
end

# Run once after a delay
schedule.once("10s", function()
    print "done"
end)

# Cancel a task
task = schedule.every("5s", function()
    print "tick"
end)
schedule.cancel(task)

# List all active tasks
tasks = schedule.list()
for t in tasks
    print "{t.type}: {t.interval}"
end
```

### `http`
```
data = http.get("https://api.example.com/todos/1")
print data.title

res = http.post("https://api.example.com/items", { name: "Widget"  price: 9.99 })
print res.id

# Global config (call once at the top of your program)
http.configure({ headers: { Authorization: "Bearer {token}" }  timeout: 5000 })

# Errors have .status, .code, .url, .body properties
try
    data = http.get("https://api.example.com/private")
catch err
    print "Status: {err.status}"
    print "Code: {err.code}"
end
```

### `server`

HTTP server. Route blocks have an implicit `req` variable.

```
# Register routes (call before server.listen)
server.get("/api/users")
    users = db.query("SELECT * FROM users")
    return users
end

server.post("/api/users")
    name   = req.body.name
    result = db.insert("users", { name: name })
    return result
end

server.get("/api/users/:id")
    id   = req.params.id
    user = db.get("SELECT * FROM users WHERE id = ?", [id])
    return user
end

server.delete("/api/users/:id")
    id = req.params.id
    db.delete("users", "id = ?", [id])
    return { ok: true }
end

server.listen(3000)   # start listening
server.close()        # stop the server
```

Inside a route block, `req` contains:
- `req.params` — path parameters (`:id` → `req.params.id`)
- `req.body` — parsed JSON or URL-encoded body
- `req.query` — parsed query string (`?foo=bar` → `req.query.foo`)
- `req.headers` — request headers
- `req.method`, `req.path`

`return` an object → JSON (`Content-Type: application/json`).
`return` a string → plain text.
`return null` → 204 No Content.

**Important:** `server` and `db` are reserved namespaces — cannot be reassigned.

### `db`

Multi-database namespace. Supports SQLite, PostgreSQL, and MySQL behind a unified API.

```
# Connect — driver is auto-detected from the URL
db.connect("./app.db")                              # SQLite (local file)
db.connect(":memory:")                              # SQLite in-memory
db.connect("postgres://user:pass@localhost/mydb")   # PostgreSQL
db.connect("mysql://user:pass@localhost/mydb")      # MySQL / MariaDB

# db.open(path) is a backward-compatible alias for SQLite
db.open("./app.db")

db.exec("CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY, name TEXT)")

rows = db.query("SELECT * FROM t WHERE name LIKE ?", ["%alice%"])  # → array
row  = db.get("SELECT * FROM t WHERE id = ?", [1])                 # → object or null

result = db.insert("t", { name: "Alice" })       # → { id, changes }
print result.id

db.update("t", { name: "Alicia" }, "id = ?", [result.id])  # → { changes }
db.delete("t", "id = ?", [result.id])                       # → { changes }

db.close()
```

Install only the driver you need:
```bash
npm install better-sqlite3   # SQLite
npm install pg               # PostgreSQL
npm install mysql2           # MySQL / MariaDB
```

Use `?` placeholders in all SQL regardless of the database — the runtime rewrites them to `$1, $2, ...` for PostgreSQL automatically.

### `assert` (use in *.test.future files)
```
assert.ok(value)
assert.equal(actual, expected)
assert.notEqual(a, b)
assert.deepEqual(obj1, obj2)
assert.fail("custom message")

# Assert that a function throws
assert.throws(function()
    error "boom"
end)

# Assert the error message contains a string
assert.throws(function()
    error "divide by zero"
end, "divide")
```

### `rag`
```
rag.index(["doc one", "doc two"])
answer = rag.query("What is doc one about?")
stats = rag.stats()   # { name, chunks, vectors }

rag.indexFile("manual.txt")
rag.indexUrl("https://docs.example.com")

# Delete a chunk by ID
rag.delete("default:0")

# Clear the entire default knowledge base
rag.clear()

# Named knowledge bases (isolated vector stores)
kb = rag.create("legal")
kb.index(["Contract clause A...", "Contract clause B..."])
answer = kb.query("What are the payment terms?")
```

### `device`
```
device.register({ name: "lamp"  type: "light"  location: "living room" })
device.update("lamp", { brightness: 80 })
device.remove("lamp")
devices = device.list()
lamp = device.get("lamp")

# Persistence — survives process restarts
device.persist("./devices.json")   # explicit save
device.load("./devices.json")      # explicit load
# Or: set FUTURE_DEVICE_FILE=./devices.json to auto-load/save on every write
```

### `system`, `vision`, `home`
See [README.md](README.md) for full API tables.

### `math`
```
print math.round(3.7)    # 4
print math.sqrt(16)      # 4
print math.pi            # 3.14159…
print math.random()      # 0–1
print math.max(1, 5, 3)  # 5
```

### `len` (built-in, not a namespace)
```
print len([1, 2, 3])          # 3
print len("hello")            # 5
print len({ a: 1  b: 2 })     # 2
```

---

## Agents

```
agent support
    use rag
    use memory

    docs = rag.query(goal)
    memory.set("last", goal)
    return docs
end

answer = support("How do I reset the device?")
print answer
```

`goal` is the implicit parameter. `use` inside an agent declares capabilities (documentation only — no generated code).

---

## Common mistakes

| Wrong | Correct |
|-------|---------|
| `if (x > 0) {` | `if x > 0` |
| `end if` | `end` |
| `elif` | `else if` |
| `&&` / `\|\|` / `!` | `and` / `or` / `not` |
| `x++` | `x = x + 1` |
| `x += 1` | `x = x + 1` |
| `// comment` | `# comment` |
| `import "./utils.js"` | `use "./utils.future"` |
| `let x = 5` | `x = 5` |
| `function f() { }` | `function f()` + body + `end` |

---

## What compiles to what

```future
x = 1
```
```js
let x;
x = 1;
```

```future
if x > 0
    print "positive"
else if x < 0
    print "negative"
else
    print "zero"
end
```
```js
if (x > 0) {
  console.log("positive");
} else if (x < 0) {
  console.log("negative");
} else {
  console.log("zero");
}
```

```future
answer = ai.ask("Hello?")
```
```js
import { runtime as __rt } from "future-lang/runtime";
let answer;
answer = await __rt.ai.ask("Hello?");
```

```future
use "./utils.future"
name = formatName("Alice")
```
```js
import { formatName } from "./utils.js";
let name;
name = formatName("Alice");
```

---

## Generation Rules

Rules for LLMs generating Future code. Follow these exactly — violations produce invalid programs.

### Never generate
- Curly braces `{}` as block delimiters — blocks use `end`, not `{}`
- Semicolons `;` — not part of the language
- `async` or `await` — the compiler handles async automatically
- `let`, `const`, or `var` — variables are declared by assignment only
- `&&`, `||`, `!` — use `and`, `or`, `not` instead
- `x++` or `x += 1` — use `x = x + 1` instead
- `import` statements — use `use "./file.future"` instead
- `// comments` — use `#` instead
- `function f() {}` with braces — use `function f()` + body + `end`
- `elif` — use `else if` instead

### Always do
- Close every block (`if`, `for`, `while`, `function`, `try`, `agent`, `every`, `on`, `stream`) with `end`
- Use `and` / `or` / `not` for logical operators
- Use `{name}` string interpolation instead of concatenation where possible
- Use `#` for comments
- Use `null` or `none` (both valid) for null values

### Async is invisible
Never add `async`/`await`. Every capability call (`ai.ask`, `http.get`, `db.query`, etc.) is automatically awaited by the compiler. Just write the call directly:
```
# Correct
answer = ai.ask("Hello?")
data = http.get("https://api.example.com")

# Wrong — do not write this
answer = await ai.ask("Hello?")
```

### String interpolation is preferred
```
# Preferred
print "Hello, {name}! You are {age} years old."

# Avoid unless necessary
print "Hello, " + name + "! You are " + age + " years old."
```

### Object commas are optional
```
# Both are valid Future
user = { name: "Alice"  age: 30 }
user = { name: "Alice", age: 30 }
```
