import { runtime as __rt } from "../runtime/index.js";

const __safe = (ns, fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(`[future:${ns}]`, e.message); } };

let existing, count, total;
await __rt.db.open("./users.db");
await __rt.db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
existing = await __rt.db.query("SELECT COUNT(*) as total FROM users");
count = existing[0];
total = count.total;
if ((total === 0)) {
  await __rt.db.insert("users", { "name": "Alice", "email": "alice@example.com" });
  await __rt.db.insert("users", { "name": "Bob", "email": "bob@example.com" });
  console.log("Seeded 2 users.");
}
await __rt.server.get("/api/users", async (req) => {
  let users;
  users = await __rt.db.query("SELECT * FROM users ORDER BY id");
  return users;
});
await __rt.server.get("/api/users/:id", async (req) => {
  let id, user;
  id = req.params.id;
  user = await __rt.db.get("SELECT * FROM users WHERE id = ?", [id]);
  if ((user === null)) {
    return { "error": "User not found" };
  }
  return user;
});
await __rt.server.post("/api/users", async (req) => {
  let name, email, result, user;
  name = req.body.name;
  email = req.body.email;
  if ((name === null)) {
    return { "error": "name is required" };
  }
  result = await __rt.db.insert("users", { "name": name, "email": email });
  user = await __rt.db.get("SELECT * FROM users WHERE id = ?", [result.id]);
  return user;
});
await __rt.server.delete("/api/users/:id", async (req) => {
  let id, deleted;
  id = req.params.id;
  deleted = await __rt.db.delete("users", "id = ?", [id]);
  if ((deleted.changes === 0)) {
    return { "error": "User not found" };
  }
  return { "ok": true, "deleted": id };
});
await __rt.server.get("/", async (req) => {
  let users, info;
  users = await __rt.db.query("SELECT COUNT(*) as total FROM users");
  info = users[0];
  return { "status": "ok", "users": info.total, "version": "1.0" };
});
await __rt.server.listen(3000);
console.log("API running at http://localhost:3000");
console.log("");
console.log("Try it:");
console.log("  curl http://localhost:3000/api/users");
console.log("  curl http://localhost:3000/api/users/1");
console.log("  curl -X POST http://localhost:3000/api/users -H 'Content-Type: application/json' -d '{\"name\":\"Carol\",\"email\":\"carol@example.com\"}'");
console.log("  curl -X DELETE http://localhost:3000/api/users/1");
