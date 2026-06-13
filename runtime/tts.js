// runtime/tts.js — text-to-speech.
// Uses a system engine when present (macOS `say`, Windows SAPI, Linux espeak-ng)
// and falls back to printing `[tts] ...` so it never crashes a program.

import { spawn } from 'node:child_process';
import process from 'node:process';

/** Speak text aloud. @returns {Promise<string>} the spoken text. */
export async function speak(text) {
  const str = String(text);
  const ok = await trySpeak(str);
  if (!ok) console.log(`[tts] ${str}`);
  return str;
}

function trySpeak(str) {
  return new Promise((resolve) => {
    let cmd; let args;
    if (process.platform === 'darwin') {
      cmd = 'say'; args = [str];
    } else if (process.platform === 'win32') {
      const safe = str.replace(/'/g, "''");
      cmd = 'powershell';
      args = ['-NoProfile', '-Command',
        `Add-Type -AssemblyName System.Speech; ` +
        `(New-Object System.Speech.Synthesis.SpeechSynthesizer).Speak('${safe}')`];
    } else {
      cmd = 'espeak-ng'; args = [str];
    }
    try {
      const p = spawn(cmd, args, { stdio: 'ignore' });
      p.on('error', () => resolve(false));     // engine not installed
      p.on('close', (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
}
