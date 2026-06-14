// src/sourcemap.js — Source map generation (Source Map v3).
// The generator embeds @FL:N markers (inside block comments) at statement lines.
// This module strips them and produces a v3 source map + clean JS.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeVlq(value) {
  let vlq = value < 0 ? ((-value) << 1) | 1 : (value << 1);
  let out = '';
  do {
    let digit = vlq & 0x1F;
    vlq >>>= 5;
    if (vlq > 0) digit |= 0x20;
    out += B64[digit];
  } while (vlq > 0);
  return out;
}

const MARKER_RE = /^\/\*@FL:(\d+)\*\//;

/**
 * Strip @FL:N markers from generated JS and build a v3 source map.
 *
 * @param {string} js           Generated JS (possibly with @FL markers)
 * @param {string} sourceFile   Original .future filename (for `sources` field)
 * @param {string} futureSource Original .future source text (for `sourcesContent`)
 * @returns {{ code: string, map: object }}
 */
export function buildSourceMap(js, sourceFile, futureSource) {
  const jsLines   = js.split('\n');
  const cleanLines = [];
  const mappings   = [];

  // Delta state for VLQ.
  let prevSrcLine = 0;
  let prevSrcCol  = 0;

  for (const line of jsLines) {
    const m = MARKER_RE.exec(line);
    if (m) {
      const srcLine = parseInt(m[1], 10) - 1; // 0-indexed
      const srcCol  = 0;
      // Segment: [genCol=0, sourceIdx=0, srcLine delta, srcCol delta]
      const seg = encodeVlq(0)
        + encodeVlq(0)
        + encodeVlq(srcLine - prevSrcLine)
        + encodeVlq(srcCol  - prevSrcCol);
      mappings.push(seg);
      prevSrcLine = srcLine;
      prevSrcCol  = srcCol;
      cleanLines.push(line.slice(m[0].length));
    } else {
      // No marker — emit an empty mapping for this line.
      mappings.push('');
      cleanLines.push(line);
    }
  }

  const map = {
    version: 3,
    file: sourceFile.replace(/\.future$/, '.js'),
    sources: [sourceFile],
    sourcesContent: [futureSource],
    names: [],
    mappings: mappings.join(';'),
  };

  return { code: cleanLines.join('\n'), map };
}
