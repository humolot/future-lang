import esbuild from 'esbuild';

// Bundle the extension host entry point (CJS, external: vscode)
await esbuild.build({
  entryPoints: ['extension.js'],
  bundle: true,
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  minify: false,
  sourcemap: false,
});

// Bundle the LSP server as ESM.
// vscode-languageserver and friends use internal require() — keep them external
// so they load from node_modules at runtime (included in VSIX via "files").
await esbuild.build({
  entryPoints: ['server/lsp-server.mjs'],
  bundle: true,
  outfile: 'dist/lsp-server.mjs',
  format: 'esm',
  platform: 'node',
  target: 'node18',
  external: [
    'vscode-languageserver',
    'vscode-languageserver/node.js',
    'vscode-languageserver-textdocument',
    'vscode-languageserver-protocol',
    'vscode-languageserver-types',
    'vscode-jsonrpc',
  ],
  minify: false,
  sourcemap: false,
});

console.log('Build complete: dist/extension.js  dist/lsp-server.mjs');
