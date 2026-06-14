// runtime/db.js
// SQLite database namespace for Future via better-sqlite3.
//
// Install the driver (optional dependency):
//   npm install better-sqlite3
//
// Usage in Future:
//   db.open("./myapp.db")
//   db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)")
//   db.insert("users", { name: "Alice" })
//   users = db.query("SELECT * FROM users")
//   user  = db.get("SELECT * FROM users WHERE id = ?", [1])
//   db.update("users", { name: "Alice Smith" }, "id = ?", [1])
//   db.delete("users", "id = ?", [1])
//   db.close()

import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);

let BetterSQLite3 = null;
try {
  BetterSQLite3 = _require('better-sqlite3');
} catch {
  // Not installed — db.open() will throw a helpful error.
}

let _db = null;

function assertOpen() {
  if (!_db) throw new Error('No database open. Call db.open(path) first.');
}

/** Open (or create) a SQLite database file. Use ":memory:" for an in-memory database. */
export function open(path = ':memory:') {
  if (!BetterSQLite3) {
    throw new Error(
      'better-sqlite3 is not installed.\n' +
      'Run: npm install better-sqlite3\n' +
      'Then restart your Future program.',
    );
  }
  _db = new BetterSQLite3(path);
  return path;
}

/** Execute raw SQL with no return value — for CREATE TABLE, DROP, PRAGMA, etc. */
export function exec(sql) {
  assertOpen();
  _db.exec(sql);
}

/**
 * Run a SELECT and return all matching rows as an array of objects.
 * @param {string} sql       SQL query, use ? for parameters.
 * @param {any[]}  [params]  Positional parameter values.
 */
export function query(sql, params = []) {
  assertOpen();
  const p = Array.isArray(params) ? params : [params];
  return _db.prepare(sql).all(...p);
}

/**
 * Run a SELECT and return the first matching row, or null if not found.
 * @param {string} sql       SQL query, use ? for parameters.
 * @param {any[]}  [params]  Positional parameter values.
 */
export function get(sql, params = []) {
  assertOpen();
  const p = Array.isArray(params) ? params : [params];
  return _db.prepare(sql).get(...p) ?? null;
}

/**
 * Insert a row into a table.
 * @param {string} table  Table name.
 * @param {object} data   Column → value mapping.
 * @returns {{ id: number, changes: number }}
 */
export function insert(table, data) {
  assertOpen();
  const keys  = Object.keys(data);
  const cols  = keys.join(', ');
  const marks = keys.map(() => '?').join(', ');
  const stmt  = _db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${marks})`);
  const info  = stmt.run(...Object.values(data));
  return { id: Number(info.lastInsertRowid), changes: info.changes };
}

/**
 * Update rows in a table.
 * @param {string} table       Table name.
 * @param {object} data        Columns to update.
 * @param {string} where       WHERE clause, e.g. "id = ?"
 * @param {any[]}  [params]    Positional values for the WHERE clause.
 * @returns {{ changes: number }}
 */
export function update(table, data, where, params = []) {
  assertOpen();
  const set   = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const wp    = Array.isArray(params) ? params : [params];
  const stmt  = _db.prepare(`UPDATE ${table} SET ${set} WHERE ${where}`);
  const info  = stmt.run(...Object.values(data), ...wp);
  return { changes: info.changes };
}

/**
 * Delete rows from a table.
 * @param {string} table       Table name.
 * @param {string} where       WHERE clause, e.g. "id = ?"
 * @param {any[]}  [params]    Positional values for the WHERE clause.
 * @returns {{ changes: number }}
 */
function _delete(table, where, params = []) {
  assertOpen();
  const wp   = Array.isArray(params) ? params : [params];
  const stmt = _db.prepare(`DELETE FROM ${table} WHERE ${where}`);
  const info = stmt.run(...wp);
  return { changes: info.changes };
}
export { _delete as delete };

/** Close the database connection. */
export function close() {
  if (_db) { _db.close(); _db = null; }
}
