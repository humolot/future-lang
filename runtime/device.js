// runtime/device.js — IoT device registry with optional file persistence.
//
// By default: in-process (lost on restart).
// Set FUTURE_DEVICE_FILE=./devices.json to auto-load on first use and
// auto-save on every write. Or call device.persist() / device.load() explicitly.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const registry = new Map();
let _loaded = false;

function ensureLoaded() {
  if (_loaded) return;
  _loaded = true;
  const file = process.env.FUTURE_DEVICE_FILE;
  if (!file) return;
  try {
    const data = JSON.parse(readFileSync(resolve(file), 'utf8'));
    for (const [k, v] of Object.entries(data)) registry.set(k, v);
  } catch { /* file doesn't exist yet — start empty */ }
}

function autoPersist() {
  const file = process.env.FUTURE_DEVICE_FILE;
  if (!file) return;
  try {
    writeFileSync(resolve(file), JSON.stringify(Object.fromEntries(registry), null, 2), 'utf8');
  } catch { /* ignore write errors */ }
}

/**
 * Register a device. `config` must have at least a `name` field.
 * @param {{ name: string, type?: string, location?: string, [key: string]: any }} config
 * @returns {object} the registered device record.
 */
export function register(config) {
  if (!config || !config.name) {
    throw new Error('device.register: config.name is required');
  }
  ensureLoaded();
  const record = { ...config, name: String(config.name), registeredAt: Date.now() };
  registry.set(record.name, record);
  autoPersist();
  return record;
}

/**
 * Look up a registered device by name.
 * @param {string} name
 * @returns {object|null}
 */
export function get(name) {
  ensureLoaded();
  return registry.get(String(name)) ?? null;
}

/**
 * List all registered devices.
 * @returns {object[]}
 */
export function list() {
  ensureLoaded();
  return [...registry.values()];
}

/**
 * Update an existing device by merging `changes` into its config.
 * @param {string} name
 * @param {object} changes  — fields to merge into the device record.
 * @returns {object} the updated record.
 */
export function update(name, changes) {
  ensureLoaded();
  const existing = registry.get(String(name));
  if (!existing) throw new Error(`device.update: device "${name}" not found`);
  const updated = { ...existing, ...changes, name: String(name) };
  registry.set(String(name), updated);
  autoPersist();
  return updated;
}

/**
 * Remove a device from the registry by name.
 * @param {string} name
 * @returns {boolean} true if the device existed and was removed.
 */
function _remove(name) {
  ensureLoaded();
  const existed = registry.delete(String(name));
  if (existed) autoPersist();
  return existed;
}
export { _remove as remove };

/**
 * Save the registry to a JSON file.
 * Uses FUTURE_DEVICE_FILE env var if no path is provided.
 * @param {string} [filePath]
 */
export function persist(filePath) {
  const file = filePath ?? process.env.FUTURE_DEVICE_FILE;
  if (!file) throw new Error('device.persist: provide a file path or set FUTURE_DEVICE_FILE');
  writeFileSync(resolve(file), JSON.stringify(Object.fromEntries(registry), null, 2), 'utf8');
}

/**
 * Load the registry from a JSON file, merging into existing records.
 * Uses FUTURE_DEVICE_FILE env var if no path is provided.
 * @param {string} [filePath]
 */
export function load(filePath) {
  const file = filePath ?? process.env.FUTURE_DEVICE_FILE;
  if (!file) throw new Error('device.load: provide a file path or set FUTURE_DEVICE_FILE');
  try {
    const data = JSON.parse(readFileSync(resolve(file), 'utf8'));
    for (const [k, v] of Object.entries(data)) registry.set(k, v);
    _loaded = true;
  } catch { /* file doesn't exist — start empty */ }
}
