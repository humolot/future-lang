// formatter.js
// Source-level formatter for Future code.
// Uses a line-based indent tracker — fast and tolerant of partial parses.

const INDENT = '    '; // 4 spaces

// Regex patterns (match after leading whitespace is stripped).
const BLOCK_OPEN  = /^(if|function|for|while|try|on|every|stream|agent)\b/;
const BLOCK_CLOSE = /^end\b/;
const BLOCK_MID   = /^(else|catch)\b/;

/**
 * Format Future source code.
 * @param {string} source
 * @returns {string} Reformatted source.
 */
export function format(source) {
  const lines  = source.split('\n');
  const result = [];
  let   depth  = 0;

  for (const raw of lines) {
    const trimmed = raw.trim();

    // Preserve blank lines and comments at their natural indent.
    if (trimmed === '') {
      result.push('');
      continue;
    }
    if (trimmed.startsWith('#')) {
      result.push(INDENT.repeat(depth) + trimmed);
      continue;
    }

    if (BLOCK_CLOSE.test(trimmed)) {
      depth = Math.max(0, depth - 1);
      result.push(INDENT.repeat(depth) + trimmed);
    } else if (BLOCK_MID.test(trimmed)) {
      // `else` / `catch` sit at the same level as the opening keyword.
      result.push(INDENT.repeat(Math.max(0, depth - 1)) + trimmed);
    } else {
      result.push(INDENT.repeat(depth) + trimmed);
      if (BLOCK_OPEN.test(trimmed)) depth++;
    }
  }

  return result.join('\n').trimEnd() + '\n';
}
