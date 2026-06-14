# Future Lang — Exemplos

Exemplos funcionais usando APIs gratuitas reais.

## Exemplos sem chave de API (rodam imediatamente)

### `crypto-tracker.future` — Preços de Crypto ao vivo
Busca BTC, ETH e SOL em tempo real via [Coinbase API](https://api.coinbase.com/v2/prices/BTC-USD/spot).
Demonstra: `http.get`, `memory.set/get`, `try/catch`.

```bash
future run examples/crypto-tracker.future
```

---

### `weather-now.future` — Clima atual
Clima em Lisboa (ou qualquer cidade — edite lat/lon) via [Open-Meteo](https://open-meteo.com/).
Demonstra: `http.get`, string interpolation em URLs, `if/else` para decodificar códigos WMO.

```bash
future run examples/weather-now.future
```

---

### `hacker-news.future` — Top 5 do Hacker News
Busca as histórias mais votadas via [HN Firebase API](https://hacker-news.firebaseio.com/).
Demonstra: `http.get` com `for` loop, múltiplas chamadas encadeadas, `try/catch`.

```bash
future run examples/hacker-news.future
```

---

### `pokemon-ai.future` — Pokédex com IA opcional
Dados completos de qualquer Pokémon via [PokeAPI](https://pokeapi.co/). Se tiver uma chave de IA configurada, gera uma descrição épica automaticamente.
Demonstra: `http.get`, `for` em arrays aninhados, `try/catch` com fallback.

```bash
future run examples/pokemon-ai.future
# Troque o pokémon editando a variável pokemon_name no arquivo
```

---

### `dashboard.future` — Dashboard multi-API
Combina clima + crypto + Hacker News + Pokémon + dica de IA numa única execução.
Demonstra: múltiplos `http.get`, `try/catch` por seção, `for` loops.

```bash
future run examples/dashboard.future
```

---

## Exemplos com chave de IA

Configure primeiro:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
# ou
export OPENAI_API_KEY=sk-...
# ou instale Ollama para rodar localmente (sem custo):
#   https://ollama.ai → ollama pull llama3.2
#   export FUTURE_AI_PROVIDER=ollama
```

### `ai-memory-chat.future` — Chat multi-turno com contexto
Conversa de 3 turnos onde cada pergunta inclui o contexto das respostas anteriores.
No terceiro turno usa `ai.complete()` para obter também o modelo, provider e tokens usados.
Demonstra: `ai.ask`, `ai.complete`, `memory.set/get`, contexto acumulado.

```bash
future run examples/ai-memory-chat.future
```

---

## Outros exemplos

| Arquivo | Descrição |
|---------|-----------|
| `hello.future` | Hello World |
| `math.future` | Funções e aritmética |
| `api.future` | HTTP GET simples (JSONPlaceholder) |
| `assistant.future` | IA + TTS (fala a resposta) |
| `smarthome.future` | Automação com MQTT |

---

## APIs usadas (todas gratuitas)

| API | Endpoint | Limite |
|-----|----------|--------|
| Coinbase | `api.coinbase.com/v2/prices/…` | Sem limite documentado |
| Open-Meteo | `api.open-meteo.com/v1/forecast` | 10.000/dia grátis |
| Hacker News | `hacker-news.firebaseio.com/v0/…` | Sem limite |
| PokeAPI | `pokeapi.co/api/v2/pokemon/…` | 100/min grátis |
