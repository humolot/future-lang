import { runtime as __rt } from "../runtime/index.js";

const __safe = (ns, fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(`[future:${ns}]`, e.message); } };

await __rt.ai.configure("venice", "your-venice-api-key-here");
await __rt.server.post("/ask", async (req) => {
  let prompt, answer;
  prompt = req.body.prompt;
  if ((prompt === null)) {
    return { "error": "prompt is required" };
  }
  answer = await __rt.ai.ask(prompt);
  return { "answer": answer };
});
await __rt.server.post("/chat", async (req) => {
  let messages, reply;
  messages = req.body.messages;
  if ((messages === null)) {
    return { "error": "messages is required" };
  }
  reply = await __rt.ai.chat(messages);
  return { "reply": reply };
});
await __rt.server.post("/chat/simple", async (req) => {
  let message, messages, reply;
  message = req.body.message;
  if ((message === null)) {
    return { "error": "message is required" };
  }
  messages = [{ "role": "user", "content": message }];
  reply = await __rt.ai.chat(messages);
  return { "reply": reply };
});
await __rt.server.post("/complete", async (req) => {
  let prompt, result;
  prompt = req.body.prompt;
  if ((prompt === null)) {
    return { "error": "prompt is required" };
  }
  result = await __rt.ai.complete(prompt);
  return { "text": result.text, "model": result.model, "provider": result.provider, "tokens": result.tokens };
});
await __rt.server.get("/health", async (req) => {
  return { "status": "ok", "provider": "venice", "version": "1.0" };
});
await __rt.server.listen(3000);
console.log("AI server running at http://localhost:3000");
console.log("");
console.log("Try it:");
console.log("  curl -X POST http://localhost:3000/ask -H 'Content-Type: application/json' -d '{\"prompt\":\"What is the capital of France?\"}'");
console.log("  curl -X POST http://localhost:3000/chat/simple -H 'Content-Type: application/json' -d '{\"message\":\"Hello!\"}'");
console.log("  curl -X POST http://localhost:3000/complete -H 'Content-Type: application/json' -d '{\"prompt\":\"Explain recursion in one sentence.\"}'");
console.log("  curl http://localhost:3000/health");
