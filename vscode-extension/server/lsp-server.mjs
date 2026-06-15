import {
  createConnection,
  TextDocuments,
  DiagnosticSeverity,
  ProposedFeatures,
  CompletionItemKind,
  TextDocumentSyncKind,
  MarkupKind,
  InsertTextFormat,
} from 'vscode-languageserver/node.js';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
  generateCompletions,
  generateHoverInfo,
  generateSignatureHelp,
} from 'future-lang/runtime/lsp-metadata';
import { compile } from 'future-lang';

const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
const documents = new TextDocuments(TextDocument);

const NAMESPACES = [
  'ai', 'http', 'mqtt', 'tts', 'rag', 'vision', 'home',
  'memory', 'schedule', 'system', 'device', 'math', 'assert', 'server', 'db',
];

const KEYWORDS = [
  'print', 'if', 'else', 'end', 'function', 'return',
  'true', 'false', 'null', 'none', 'and', 'or', 'not',
  'for', 'in', 'while', 'try', 'catch', 'on', 'every',
  'stream', 'agent', 'use', 'as',
];

let allCompletions = [];

connection.onInitialize(() => {
  allCompletions = generateCompletions();
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['.'],
      },
      hoverProvider: true,
      signatureHelpProvider: {
        triggerCharacters: ['(', ','],
      },
    },
  };
});

// --- Completions ---
connection.onCompletion((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const pos = params.position;
  const lineText = doc.getText({
    start: { line: pos.line, character: 0 },
    end: pos,
  });

  // After "ns." → show methods for that namespace
  const nsDot = lineText.match(/(\w+)\.\s*$/);
  if (nsDot) {
    const ns = nsDot[1];
    const methods = allCompletions.filter((c) => c.module === ns);
    if (methods.length > 0) {
      return methods.map((c) => ({
        label: c.method,
        kind: CompletionItemKind.Function,
        detail: c.detail.replace(`${ns}.`, ''),
        documentation: { kind: MarkupKind.PlainText, value: c.documentation || '' },
        insertText: c.insertText.replace(`${c.module}.`, ''),
        insertTextFormat: InsertTextFormat.Snippet,
      }));
    }
  }

  // Default: namespace names + keywords
  const items = NAMESPACES.map((ns) => ({
    label: ns,
    kind: CompletionItemKind.Module,
    detail: `${ns} namespace`,
    insertText: `${ns}.`,
  }));

  for (const kw of KEYWORDS) {
    items.push({ label: kw, kind: CompletionItemKind.Keyword });
  }

  return items;
});

// --- Hover ---
connection.onHover((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const pos = params.position;
  const lineText = doc.getText({
    start: { line: pos.line, character: 0 },
    end: { line: pos.line, character: 500 },
  });

  const match = findNsMethodAt(lineText, pos.character);
  if (!match) return null;

  const info = generateHoverInfo(match.ns, match.method);
  if (!info) return null;

  const paramDocs = info.params.length
    ? '\n\n**Parameters:**\n' +
      info.params.map((p) => `- \`${p.name}${p.optional ? '?' : ''}: ${p.type}\``).join('\n')
    : '';

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `\`\`\`\n${info.signature}\n\`\`\`\n\n${info.description}${paramDocs}`,
    },
  };
});

// --- Signature help ---
connection.onSignatureHelp((params) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const pos = params.position;
  const lineText = doc.getText({
    start: { line: pos.line, character: 0 },
    end: pos,
  });

  // Most recent unclosed ns.method(
  const callMatch = lineText.match(/(\w+)\.(\w+)\s*\([^)]*$/);
  if (!callMatch) return null;

  const [, ns, method] = callMatch;
  const sig = generateSignatureHelp(ns, method);
  if (!sig) return null;

  const afterParen = lineText.slice(lineText.lastIndexOf('(') + 1);
  const activeParam = Math.min(
    (afterParen.match(/,/g) || []).length,
    Math.max(sig.parameters.length - 1, 0),
  );

  return {
    signatures: [{
      label: sig.label,
      documentation: { kind: MarkupKind.PlainText, value: sig.documentation || '' },
      parameters: sig.parameters,
    }],
    activeSignature: 0,
    activeParameter: activeParam,
  };
});

// --- Diagnostics ---
function validate(doc) {
  const diagnostics = [];
  try {
    compile(doc.getText());
  } catch (err) {
    if (err.line != null) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: err.line - 1, character: (err.column ?? 1) - 1 },
          end: { line: err.line - 1, character: 500 },
        },
        message: err.message,
        source: 'future',
      });
    }
  }
  connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

documents.onDidOpen((e) => validate(e.document));
documents.onDidChangeContent((e) => validate(e.document));

documents.listen(connection);
connection.listen();

// Helper: find ns.method at cursor position in a line
function findNsMethodAt(line, char) {
  const re = /(\w+)\.(\w+)/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (char >= m.index && char <= m.index + m[0].length) {
      return { ns: m[1], method: m[2] };
    }
  }
  return null;
}
