// runtime/db.js
// Multi-database namespace for Future.
// Supports SQLite, PostgreSQL, and MySQL/MariaDB behind a unified API.
//
// Drivers are optional dependencies — install only what you need:
//   npm install better-sqlite3   # SQLite
//   npm install pg               # PostgreSQL
//   npm install mysql2           # MySQL / MariaDB
//
// Usage in Future:
//   db.connect("./app.db")                          # SQLite (file path)
//   db.connect("postgres://user:pass@host/dbname")  # PostgreSQL
//   db.connect("mysql://user:pass@host/dbname")     # MySQL
//
//   db.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)")
//   rows   = db.query("SELECT * FROM users WHERE age > ?", [18])
//   row    = db.get("SELECT * FROM users WHERE id = ?", [1])
//   result = db.insert("users", { name: "Alice", age: 30 })
//   db.update("users", { name: "Alicia" }, "id = ?", [result.id])
//   db.delete("users", "id = ?", [result.id])
//   db.close()
//
// db.open(path) is a backward-compatible alias for db.connect(path) with SQLite.

import { createRequire } from 'node:module';
const _require = createRequire(import.meta.url);

let _driver = null; // 'sqlite' | 'pg' | 'mysql'
let _db     = null; // driver-specific connection / pool

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertConnected() {
  if (!_db) throw new Error('No database connection. Call db.connect() or db.open() first.');
}

function detectDriver(url) {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'pg';
  if (url.startsWith('mysql://') || url.startsWith('mysql2://')) return 'mysql';
  return 'sqlite';
}

/** Rewrite ? placeholders to $1, $2, ... for PostgreSQL. */
function pgPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeParams(params) {
  return Array.isArray(params) ? params : [params];
}

// ---------------------------------------------------------------------------
// connect / open
// ---------------------------------------------------------------------------

/**
 * Connect to a database. Auto-detects the driver from the URL scheme.
 *   db.connect("./app.db")                          → SQLite
 *   db.connect(":memory:")                          → SQLite in-memory
 *   db.connect("postgres://user:pass@host/db")      → PostgreSQL
 *   db.connect("mysql://user:pass@host/db")         → MySQL / MariaDB
 */
export async function connect(url) {
  _driver = detectDriver(url);

  if (_driver === 'sqlite') {
    let BetterSQLite3;
    try { BetterSQLite3 = _require('better-sqlite3'); }
    catch { throw new Error('better-sqlite3 not installed. Run: npm install better-sqlite3'); }
    const path = url.replace(/^sqlite:\/\//, '');
    _db = new BetterSQLite3(path);

  } else if (_driver === 'pg') {
    let pg;
    try { pg = _require('pg'); }
    catch { throw new Error('pg not installed. Run: npm install pg'); }
    const { Pool } = pg;
    _db = new Pool({ connectionString: url });
    // Verify the connection immediately.
    const client = await _db.connect();
    client.release();

  } else if (_driver === 'mysql') {
    let mysql2;
    try { mysql2 = _require('mysql2/promise'); }
    catch { throw new Error('mysql2 not installed. Run: npm install mysql2'); }
    _db = await mysql2.createPool(url);
  }
}

/** Backward-compatible alias — opens a SQLite file (or :memory:). */
export async function open(path = ':memory:') {
  return connect(path);
}

// ---------------------------------------------------------------------------
// DDL
// ---------------------------------------------------------------------------

/** Execute raw SQL with no return value (CREATE TABLE, ALTER TABLE, etc.). */
export async function exec(sql) {
  assertConnected();
  if (_driver === 'sqlite') {
    _db.exec(sql);
  } else if (_driver === 'pg') {
    await _db.query(sql);
  } else if (_driver === 'mysql') {
    await _db.execute(sql);
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Run a SELECT and return all matching rows as an array of objects.
 * Use ? for parameters regardless of the database — the driver normalizes them.
 */
export async function query(sql, params = []) {
  assertConnected();
  const p = normalizeParams(params);
  if (_driver === 'sqlite') {
    return _db.prepare(sql).all(...p);
  } else if (_driver === 'pg') {
    const result = await _db.query(pgPlaceholders(sql), p);
    return result.rows;
  } else if (_driver === 'mysql') {
    const [rows] = await _db.execute(sql, p);
    return rows;
  }
}

/**
 * Run a SELECT and return the first matching row, or null if not found.
 */
export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Insert a row and return { id, changes }.
 * @param {string} table
 * @param {object} data  — column → value mapping
 */
export async function insert(table, data) {
  assertConnected();
  const keys   = Object.keys(data);
  const values = Object.values(data);
  const cols   = keys.join(', ');

  if (_driver === 'sqlite') {
    const marks = keys.map(() => '?').join(', ');
    const info  = _db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${marks})`).run(...values);
    return { id: Number(info.lastInsertRowid), changes: info.changes };

  } else if (_driver === 'pg') {
    const marks = keys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await _db.query(
      `INSERT INTO ${table} (${cols}) VALUES (${marks}) RETURNING *`,
      values,
    );
    return { id: result.rows[0]?.id ?? null, changes: result.rowCount };

  } else if (_driver === 'mysql') {
    const marks = keys.map(() => '?').join(', ');
    const [result] = await _db.execute(`INSERT INTO ${table} (${cols}) VALUES (${marks})`, values);
    return { id: result.insertId, changes: result.affectedRows };
  }
}

/**
 * Update rows and return { changes }.
 * @param {string} table
 * @param {object} data    — columns to update
 * @param {string} where   — WHERE clause using ? placeholders, e.g. "id = ?"
 * @param {any[]}  params  — values for the WHERE clause
 */
export async function update(table, data, where, params = []) {
  assertConnected();
  const keys   = Object.keys(data);
  const values = [...Object.values(data), ...normalizeParams(params)];

  if (_driver === 'sqlite') {
    const set  = keys.map((k) => `${k} = ?`).join(', ');
    const info = _db.prepare(`UPDATE ${table} SET ${set} WHERE ${where}`).run(...values);
    return { changes: info.changes };

  } else if (_driver === 'pg') {
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    let idx = keys.length + 1;
    const whereNorm = where.replace(/\?/g, () => `$${idx++}`);
    const result = await _db.query(`UPDATE ${table} SET ${set} WHERE ${whereNorm}`, values);
    return { changes: result.rowCount };

  } else if (_driver === 'mysql') {
    const set = keys.map((k) => `${k} = ?`).join(', ');
    const [result] = await _db.execute(`UPDATE ${table} SET ${set} WHERE ${where}`, values);
    return { changes: result.affectedRows };
  }
}

/**
 * Delete rows and return { changes }.
 * @param {string} table
 * @param {string} where   — WHERE clause using ? placeholders
 * @param {any[]}  params  — values for the WHERE clause
 */
async function _delete(table, where, params = []) {
  assertConnected();
  const p = normalizeParams(params);

  if (_driver === 'sqlite') {
    const info = _db.prepare(`DELETE FROM ${table} WHERE ${where}`).run(...p);
    return { changes: info.changes };

  } else if (_driver === 'pg') {
    const result = await _db.query(`DELETE FROM ${table} WHERE ${pgPlaceholders(where)}`, p);
    return { changes: result.rowCount };

  } else if (_driver === 'mysql') {
    const [result] = await _db.execute(`DELETE FROM ${table} WHERE ${where}`, p);
    return { changes: result.affectedRows };
  }
}
export { _delete as delete };

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

/** Close the database connection / pool. */
export async function close() {
  if (!_db) return;
  if (_driver === 'sqlite') {
    _db.close();
  } else if (_driver === 'pg') {
    await _db.end();
  } else if (_driver === 'mysql') {
    await _db.end();
  }
  _db = null;
  _driver = null;
}
