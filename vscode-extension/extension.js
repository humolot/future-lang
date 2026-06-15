'use strict';
const path = require('path');
const { workspace } = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(
    path.join('dist', 'lsp-server.mjs'),
  );

  const serverOptions = {
    run: {
      command: process.execPath,
      args: [serverModule],
      transport: TransportKind.stdio,
    },
    debug: {
      command: process.execPath,
      args: ['--inspect=6009', serverModule],
      transport: TransportKind.stdio,
    },
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'future' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.future'),
    },
  };

  client = new LanguageClient(
    'future-lang',
    'Future Language Server',
    serverOptions,
    clientOptions,
  );

  client.start();
}

function deactivate() {
  if (!client) return undefined;
  return client.stop();
}

module.exports = { activate, deactivate };
