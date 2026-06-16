# Future Lang — Examples

Real, working examples using free public APIs.

## No API key required

### `system-dashboard.future` — Real-time web dashboard ⭐

A dark-theme web UI served at `http://localhost:3000`. Shows live memory usage (with animated progress bar), CPU cores, uptime, hostname, platform, and Node.js version — refreshed every 3 seconds.
Includes an AI chat panel: configure any provider and chat with your system assistant right in the browser.

Demonstrates: `server.get/post`, `system.exec`, `system.read`, `ai.ask`, `ai.configure`, HTML auto Content-Type.

```bash
future run examples/system-dashboard.future
# Open http://localhost:3000
```

Configure AI (optional — edit `system-dashboard.future`):
```future
ai.configure({ provider: "venice",    apiKey: "your-key", model: "llama-3.3-70b" })
ai.configure({ provider: "openai",    apiKey: "sk-...",   model: "gpt-4o-mini" })
ai.configure({ provider: "anthropic", apiKey: "sk-ant-..." })
ai.configure({ provider: "ollama",    apiKey: "ollama",   model: "llama3.2" })
```

---

### `crypto-tracker.future` — Live crypto prices
Fetches BTC, ETH, and SOL in real time from the [Coinbase API](https://api.coinbase.com/v2/prices/BTC-USD/spot).
Demonstrates: `http.get`, `memory.set/get`, `try/catch`.

```bash
future run examples/crypto-tracker.future
```

---

### `weather-now.future` — Current weather
Current conditions for Lisbon (or any city — edit lat/lon) via [Open-Meteo](https://open-meteo.com/).
Demonstrates: `http.get`, URL string interpolation, `if/else` to decode WMO codes.

```bash
future run examples/weather-now.future
```

---

### `hacker-news.future` — Hacker News top 5
Fetches the top-voted stories right now via the [HN Firebase API](https://hacker-news.firebaseio.com/).
Demonstrates: `http.get` inside a `for` loop, chained HTTP calls, `try/catch`.

```bash
future run examples/hacker-news.future
```

---

### `pokemon-ai.future` — Pokédex with optional AI
Full Pokémon data from [PokeAPI](https://pokeapi.co/). If an AI provider is configured, generates an epic battle description automatically.
Demonstrates: `http.get`, `for` over nested arrays, graceful AI fallback.

```bash
future run examples/pokemon-ai.future
# Change the pokémon by editing the pokemon_name variable in the file
```

---

### `dashboard.future` — Multi-API live dashboard
Weather + crypto + Hacker News + Pokémon + AI tip — all in one run.
Demonstrates: multiple `http.get`, per-section `try/catch`, `for` loops.

```bash
future run examples/dashboard.future
```

---

## Requires an AI provider

Set up first:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
# or
export OPENAI_API_KEY=sk-...
# or install Ollama for free local inference:
#   https://ollama.ai → ollama pull llama3.2
#   export FUTURE_AI_PROVIDER=ollama
```

### `ai-memory-chat.future` — Multi-turn chat with context
A 3-turn conversation where each question includes the context of previous answers.
The third turn uses `ai.complete()` to also return the model name, provider, and token count.
Demonstrates: `ai.ask`, `ai.complete`, `memory.set/get`, accumulated context.

```bash
future run examples/ai-memory-chat.future
```

---

## Requires `better-sqlite3`

Install once:
```bash
npm install better-sqlite3
```

### `api-server.future` — REST API with SQLite
A complete CRUD API running on `http://localhost:3000`. Creates a `users` table, seeds two rows, and exposes five routes.
Demonstrates: `server.get/post/delete`, `db.open/exec/query/get/insert/delete`, `req.params`, `req.body`, `server.listen`.

```bash
npm install better-sqlite3
future run examples/api-server.future
# curl http://localhost:3000/api/users
# curl http://localhost:3000/api/users/1
# curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d '{"name":"Carol","email":"carol@example.com"}'
# curl -X DELETE http://localhost:3000/api/users/1
```

---

### `db-test-sqlite.future` — SQLite connection test
Connects to a local SQLite file, creates a table, inserts a row, and reads it back.
Demonstrates: `db.connect`, `db.exec`, `db.insert`, `db.get`, `try/catch`.

```bash
npm install better-sqlite3
future run examples/db-test-sqlite.future
```

---

### `db-test-mysql.future` — MySQL connection test (XAMPP)
Connects to a local MySQL server (e.g. XAMPP), creates a table, inserts a row, and reads it back.

```bash
npm install mysql2
# Start MySQL in the XAMPP control panel, then create the database:
#   CREATE DATABASE test_future;
future run examples/db-test-mysql.future
```

---

## Other examples

| File | Description |
|------|-------------|
| `hello.future` | Hello World |
| `math.future` | Functions and arithmetic |
| `api.future` | Simple HTTP GET (JSONPlaceholder) |
| `assistant.future` | AI + TTS (speaks the answer aloud) |
| `smarthome.future` | Home automation with MQTT |

---

## Free APIs used

| API | Endpoint | Rate limit |
|-----|----------|------------|
| Coinbase | `api.coinbase.com/v2/prices/…` | No documented limit |
| Open-Meteo | `api.open-meteo.com/v1/forecast` | 10,000/day free |
| Hacker News | `hacker-news.firebaseio.com/v0/…` | No limit |
| PokeAPI | `pokeapi.co/api/v2/pokemon/…` | 100/min free |
