// runtime/lsp-metadata.js
// Generates VSCode / Language Server Protocol compatible metadata from the
// runtime manifest. Consume this in a Future LSP server or VSCode extension to
// provide completion items, hover documentation, and signature help.

import { manifest } from './index.js';

/**
 * Generate a flat list of completion items for all capability methods.
 * Each item follows the LSP CompletionItem shape (kind names, not numeric codes).
 * @returns {object[]}
 */
export function generateCompletions() {
  const items = [];
  for (const [module, methods] of Object.entries(manifest)) {
    for (const [name, meta] of Object.entries(methods)) {
      const required = meta.params.filter((p) => !p.optional);
      const optional = meta.params.filter((p) => p.optional);
      const paramList = [
        ...required.map((p) => p.name),
        ...optional.map((p) => `${p.name}?`),
      ].join(', ');
      const snippet = `${module}.${name}(${
        meta.params.map((p, i) => `\${${i + 1}:${p.name}}`).join(', ')
      })`;
      items.push({
        label: `${module}.${name}`,
        kind: 'Function',
        detail: `${module}.${name}(${paramList}) → ${meta.async ? `Promise<${meta.returns}>` : meta.returns}`,
        documentation: meta.description,
        insertText: snippet,
        insertTextFormat: 'Snippet',
        module,
        method: name,
        async: meta.async,
      });
    }
  }
  return items;
}

/**
 * Generate hover documentation for a specific module.method pair.
 * @param {string} module
 * @param {string} method
 * @returns {{ signature: string, description: string, params: object[] } | null}
 */
export function generateHoverInfo(module, method) {
  const meta = manifest[module]?.[method];
  if (!meta) return null;
  const paramList = meta.params
    .map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
    .join(', ');
  const ret = meta.async ? `Promise<${meta.returns}>` : meta.returns;
  return {
    signature: `${module}.${method}(${paramList}): ${ret}`,
    description: meta.description,
    params: meta.params,
  };
}

/**
 * Signature help for a specific module.method — used when the user types `(`.
 * @returns {{ label: string, parameters: object[] } | null}
 */
export function generateSignatureHelp(module, method) {
  const meta = manifest[module]?.[method];
  if (!meta) return null;
  const paramStrings = meta.params.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`);
  const label = `${module}.${method}(${paramStrings.join(', ')})`;
  return {
    label,
    documentation: meta.description,
    parameters: meta.params.map((p, i) => ({
      label: paramStrings[i],
      documentation: p.optional ? `Optional. Type: ${p.type}` : `Type: ${p.type}`,
    })),
  };
}

/**
 * All reserved keywords in the Future language.
 * Used by syntax highlighters, LSP semantic tokens, and editor grammar files.
 * @returns {string[]}
 */
export function generateLanguageKeywords() {
  return ['print', 'if', 'else', 'end', 'function', 'return', 'true', 'false', 'and', 'or', 'not', 'on', 'every'];
}

/**
 * Full LSP-ready metadata bundle.
 * Suitable for initialising a Language Server or generating a VSCode extension's language contribution.
 * @returns {object}
 */
export function generateLanguageMetadata() {
  return {
    languageId: 'future',
    fileExtensions: ['.future'],
    keywords: generateLanguageKeywords(),
    completions: generateCompletions(),
    modules: Object.keys(manifest),
    manifest,
  };
}
