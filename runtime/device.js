// runtime/device.js — IoT device registry.
// Devices are stored in-process. For persistence, replace `registry` with a
// call to Home Assistant / AWS IoT / Azure IoT Hub, or write to disk.

const registry = new Map();

/**
 * Register a device. `config` must have at least a `name` field.
 * @param {{ name: string, type?: string, location?: string, [key: string]: any }} config
 * @returns {object} the registered device record.
 */
export function register(config) {
  if (!config || !config.name) {
    throw new Error('device.register: config.name is required');
  }
  const record = { ...config, name: String(config.name), registeredAt: Date.now() };
  registry.set(record.name, record);
  return record;
}

/**
 * Look up a registered device by name.
 * @param {string} name
 * @returns {object|null}
 */
export function get(name) {
  return registry.get(String(name)) ?? null;
}

/**
 * List all registered devices.
 * @returns {object[]}
 */
export function list() {
  return [...registry.values()];
}
