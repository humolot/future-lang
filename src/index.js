// index.js
// Public library API: ties the three phases together.

import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { generate } from './generator.js';

export { tokenize } from './lexer.js';
export { parse } from './parser.js';
export { generate, NAMESPACES } from './generator.js';
export { FutureError } from './errors.js';

/**
 * Compile Future source into JavaScript source.
 * @param {string} source
 * @param {object} [options]
 * @param {string}   [options.runtimeSpecifier]  Import path for the capability runtime.
 * @param {boolean}  [options.isModule]           Emit `export` for top-level functions.
 * @param {Function} [options.resolveSource]      (path: string) => string | null
 *                   Called for each non-aliased `use` to extract exported names.
 * @param {Map}      [options.pathMap]            Override resolved JS paths (for `run`).
 * @returns {string} JavaScript source.
 */
export function compile(source, options = {}) {
  const tokens = tokenize(source);
  const ast = parse(tokens);

  // For non-aliased `use` statements, read the imported file and extract function names
  // so we can emit named imports instead of wildcard imports.
  const importedNames = new Map();
  if (options.resolveSource) {
    for (const stmt of ast.body) {
      if (stmt.type !== 'UseStatement' || stmt.alias) continue;
      try {
        const importedSrc = options.resolveSource(stmt.path);
        if (importedSrc) {
          const importedAst = parse(tokenize(importedSrc));
          const names = importedAst.body
            .filter((s) => s.type === 'FunctionDeclaration')
            .map((s) => s.name);
          if (names.length > 0) importedNames.set(stmt.path, names);
        }
      } catch { /* missing file — fall back to wildcard import */ }
    }
  }

  return generate(ast, { ...options, importedNames });
}
