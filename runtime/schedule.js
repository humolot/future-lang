// runtime/schedule.js — Scheduling utilities for Future programs.
// Intervals can be a number (milliseconds) or a human-readable string: "5s", "30m", "2h".
// Cron support requires the optional `node-cron` package.

const handles = [];

/**
 * Run `callback` repeatedly every `interval`.
 * @param {number|string} interval  Duration: ms number or string like "30m", "5s", "1h".
 * @param {Function} callback
 * @returns {Promise<NodeJS.Timeout>}
 */
export async function every(interval, callback) {
  const ms = parseInterval(interval);
  const handle = setInterval(async () => {
    try { await callback(); } catch (e) { console.error('[schedule.every]', e.message); }
  }, ms);
  handles.push(handle);
  return handle;
}

/**
 * Run `callback` once after `delay`.
 * @param {number|string} delay
 * @param {Function} callback
 * @returns {Promise<any>} resolves with callback's return value.
 */
export async function once(delay, callback) {
  const ms = parseInterval(delay);
  return new Promise((resolve) => {
    setTimeout(async () => {
      try { resolve(await callback()); }
      catch (e) { console.error('[schedule.once]', e.message); resolve(null); }
    }, ms);
  });
}

/**
 * Run `callback` on a cron schedule. Requires `node-cron` to be installed.
 * Falls back to a clear warning stub if the package is missing.
 * @param {string} expression  Standard 5-field cron expression, e.g. "* * * * *".
 * @param {Function} callback
 * @returns {Promise<any>}
 */
export async function cron(expression, callback) {
  try {
    const mod = await import('node-cron');
    const task = mod.default.schedule(String(expression), callback);
    handles.push(task);
    return task;
  } catch {
    console.warn(
      `[schedule.cron] node-cron is not installed — run: npm install node-cron\n` +
      `Expression "${expression}" will not fire.`,
    );
    return null;
  }
}

// --- helpers ---

/** Parse a duration string like "30m", "5s", "2h", "500ms" into milliseconds. */
function parseInterval(interval) {
  if (typeof interval === 'number') return interval;
  const str = String(interval).trim();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
  if (!match) throw new Error(`Invalid interval: "${str}" — use a number or a string like "30m", "5s", "2h".`);
  const [, num, unit = 'ms'] = match;
  const n = parseFloat(num);
  switch (unit.toLowerCase()) {
    case 'd':  return n * 86_400_000;
    case 'h':  return n * 3_600_000;
    case 'm':  return n * 60_000;
    case 's':  return n * 1_000;
    default:   return n;
  }
}
