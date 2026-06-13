// runtime/system.js — OS-level utilities: run commands, open files/URLs, notify, read/write files.

import { execFile, spawn } from 'node:child_process';
import { promisify }       from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const execFileAsync = promisify(execFile);

/**
 * Run a shell command. Uses execFile (no shell expansion) for safety.
 * The command string is split on spaces; use exec(['cmd', 'arg with spaces']) for complex calls.
 * @param {string|string[]} command  Command + args as a string or array.
 * @returns {Promise<string>} stdout
 */
export async function exec(command) {
  const parts = Array.isArray(command) ? command : String(command).trim().split(/\s+/);
  const [cmd, ...args] = parts;
  const { stdout, stderr } = await execFileAsync(cmd, args);
  if (stderr) console.warn('[system.exec]', stderr.trim());
  return stdout.trim();
}

/**
 * Open a file path or URL with the OS default handler.
 * Uses the platform's native launcher (start / open / xdg-open).
 * @returns {Promise<string>} the target that was opened.
 */
export async function open(target) {
  const str = String(target);
  let cmd, args;
  if (process.platform === 'win32') {
    // `start` is a cmd built-in; spawn via cmd /c.
    cmd = 'cmd'; args = ['/c', 'start', '', str];
  } else if (process.platform === 'darwin') {
    cmd = 'open'; args = [str];
  } else {
    cmd = 'xdg-open'; args = [str];
  }
  await new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    proc.once('error', reject);
    proc.unref();
    // Resolve immediately — the opened app runs independently.
    resolve();
  });
  return str;
}

/**
 * Send a desktop notification.
 * macOS: AppleScript. Linux: notify-send. Windows: falls back to console.log.
 * @returns {Promise<string>} the message text.
 */
export async function notify(message) {
  const msg = String(message);
  try {
    if (process.platform === 'darwin') {
      // Sanitise for AppleScript: remove quotes.
      const safe = msg.replace(/['"\\]/g, '').slice(0, 200);
      await execFileAsync('osascript', ['-e', `display notification "${safe}" with title "Future"`]);
    } else if (process.platform === 'linux') {
      await execFileAsync('notify-send', ['Future', msg]);
    } else {
      // Windows: log clearly; a real toast would need a packaged app identity.
      console.log(`[notify] ${msg}`);
    }
  } catch {
    console.log(`[notify] ${msg}`);
  }
  return msg;
}

/**
 * Read a file and return its content as a string.
 * @param {string} path  Absolute or relative file path.
 * @returns {Promise<string>}
 */
export async function read(path) {
  return readFile(String(path), 'utf8');
}

/**
 * Write a string to a file (creates or overwrites).
 * @param {string} path     Absolute or relative file path.
 * @param {string} content  Content to write.
 * @returns {Promise<string>} The path that was written.
 */
export async function write(path, content) {
  await writeFile(String(path), String(content), 'utf8');
  return String(path);
}

/**
 * Read an environment variable. Returns null if not set.
 * @param {string} name  Variable name, e.g. "VENICE_API_KEY".
 * @returns {string|null}
 */
export function env(name) {
  return process.env[String(name)] ?? null;
}
