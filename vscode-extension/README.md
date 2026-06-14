# Future Lang — VS Code Extension

Syntax highlighting and snippets for the [Future programming language](https://github.com/humolot/future-lang).

## Features

- **Syntax highlighting** — keywords, control flow, namespaces (`ai`, `http`, `mqtt`, `tts`, `rag`, `vision`, `home`, `memory`, `schedule`, `system`, `device`, `math`, `assert`), string interpolation `{variable}`, line comments `#`, numbers, and booleans
- **Code snippets** for every language construct (see list below)
- **Language configuration** — `#` comment toggling, bracket matching, auto-close pairs, auto-indent inside `if/function/for/…` blocks, de-indent on `end/else/catch`

## Quick Example

```future
# Ask AI and print the result
answer = ai.ask("What is the capital of Portugal?")
print "AI says: {answer}"

# HTTP with error handling
try
  data = http.get("https://api.example.com/users")
  print "Got {data.length} users"
catch err
  print "Request failed: {err.message}"
end
```

## Snippets

| Prefix | Expands to |
|--------|-----------|
| `if` | `if … end` |
| `ife` | `if … else … end` |
| `ifei` | `if … else if … else … end` |
| `fn` / `function` | `function name(params) … end` |
| `for` | `for item in list … end` |
| `while` | `while condition … end` |
| `try` | `try … catch err … end` |
| `on` | `on mqtt "topic" … end` |
| `every` | `every "30m" … end` |
| `stream` | `stream ai.ask(…) print chunk end` |
| `agent` | `agent name use ai … end` |
| `use` | `use "./file.future"` |
| `useas` | `use "./file.future" as alias` |
| `ask` | `answer = ai.ask("…")` |
| `complete` | `result = ai.complete("…")` |
| `chat` | multi-turn `ai.chat(messages)` |
| `httpget` | `data = http.get("…")` |
| `httppost` | `result = http.post("…", body)` |
| `httpconf` | `http.configure({ headers, timeout })` |
| `memset` | `memory.set("key", value)` |
| `memget` | `value = memory.get("key")` |
| `print` | `print "…"` |
| `printi` | `print "Label: {variable}"` |
| `aeq` | `assert.equal(actual, expected)` |
| `adeq` | `assert.deepEqual(actual, expected)` |
| `aok` | `assert.ok(value)` |
| `speak` | `tts.speak("…")` |
| `mqttpub` | `mqtt.publish("topic", payload)` |
| `schedule` | one-time scheduled task |

## Installation

### From the Marketplace

Search for **Future Lang** in the VS Code Extensions panel (`Ctrl+Shift+X`), then click **Install**.

### From a `.vsix` file

```sh
code --install-extension future-lang-vscode-0.4.3.vsix
```

## Links

- [GitHub](https://github.com/humolot/future-lang)
- [npm: future-lang](https://www.npmjs.com/package/future-lang)
- [Language Reference](https://github.com/humolot/future-lang#readme)
- [Architecture](https://github.com/humolot/future-lang/blob/main/ARCHITECTURE.md)
