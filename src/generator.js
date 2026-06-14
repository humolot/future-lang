// generator.js
// Phase 3 — JavaScript code generation.
//
// Two modes:
//   * SIMPLE  — pure programs (print/vars/if/functions). Emits plain, sync JS,
//               exactly like before.
//   * ASYNC   — the program uses a capability (http/ai/mqtt/tts/...). Emits an
//               ES module that imports the runtime, makes every function async
//               and `await`s every call. The user never writes `await` — the
//               language stays human-readable while the JS stays correct.
//
// Capabilities are recognised purely by their namespace (the object of a member
// call). Adding rag/vision/home — or anything else — is just a name in this set
// plus a matching runtime module. No other compiler change required.

import { NodeType } from './ast.js';
import { FutureError } from './errors.js';

const INDENT = '  ';

/** Namespaces that resolve to runtime modules. Extend freely. */
export const NAMESPACES = new Set([
  'ai', 'http', 'mqtt', 'tts',          // core modules
  'rag', 'vision', 'home',              // AI / automation extension points
  'memory', 'schedule', 'system', 'device', // optional new modules
  'math',                               // general-purpose math
  'assert',                             // test assertions
]);

export class Generator {
  /**
   * @param {object} program
   * @param {{ runtimeSpecifier?: string }} [options]
   * @returns {string} JavaScript source.
   */
  generate(program, options = {}) {
    this.runtimeSpecifier = options.runtimeSpecifier ?? 'future-lang/runtime';
    this.browserMode = options.browserMode ?? false;
    this.isModule = options.isModule ?? false;
    this.sourceMaps = options.sourceMaps ?? false;
    // Map<importedFuturePath, string[]> — exported names for non-aliased use statements.
    this.importedNames = options.importedNames ?? new Map();
    // Map<importedFuturePath, resolvedJsPath> — path override for `future run` temp files.
    this.pathMap = options.pathMap ?? new Map();
    // Aliases declared by `use "..." as alias` — must NOT be routed through __rt.
    this.useAliases = new Set(
      program.body
        .filter((s) => s.type === NodeType.UseStatement && s.alias)
        .map((s) => s.alias),
    );
    this.asyncMode = usesRuntime(program, this.useAliases);

    const lines = [];

    // Emit use/import statements first (always, regardless of asyncMode).
    const useStmts = program.body.filter((s) => s.type === NodeType.UseStatement);
    for (const stmt of useStmts) {
      lines.push(this.genUseStatement(stmt));
    }
    if (useStmts.length > 0) lines.push('');

    if (this.asyncMode && !this.browserMode) {
      lines.push(`import { runtime as __rt } from ${JSON.stringify(this.runtimeSpecifier)};`);
      lines.push('');
    }

    // __safe wraps async event handlers so errors are logged instead of crashing silently.
    if (usesHandlers(program)) {
      lines.push('const __safe = (ns, fn) => async (...a) => { try { return await fn(...a); } catch (e) { console.error(`[future:${ns}]`, e.message); } };');
      lines.push('');
    }

    // Emit __len helper only when len() is actually used — keeps simple programs clean.
    if (usesBuiltin(program, 'len')) {
      lines.push('function __len(x) { return x == null ? 0 : (x.length ?? Object.keys(x).length); }');
    }

    const declarations = collectAssignedNames(program.body);
    if (declarations.length > 0) {
      lines.push(`let ${declarations.join(', ')};`);
    }
    for (const stmt of program.body) {
      if (stmt.type === NodeType.UseStatement) continue; // already emitted above
      const code = this.genStatement(stmt, 0, /* topLevel= */ true);
      if (this.sourceMaps && stmt.line != null) {
        lines.push(`/*@FL:${stmt.line}*/${code}`);
      } else {
        lines.push(code);
      }
    }
    return lines.join('\n') + '\n';
  }

  /** Emit an ES `import` for a `use` statement. */
  genUseStatement(node) {
    const isRelative = node.path.startsWith('./') || node.path.startsWith('../');
    const jsPath  = isRelative ? node.path.replace(/\.future$/, '.js') : node.path;
    const resolved = this.pathMap.get(node.path) ?? jsPath;

    if (node.alias) {
      return `import * as ${node.alias} from ${JSON.stringify(resolved)};`;
    }
    if (!isRelative) {
      // npm module without alias — side-effect import
      return `import ${JSON.stringify(resolved)};`;
    }
    const names = this.importedNames.get(node.path) ?? [];
    if (names.length > 0) {
      return `import { ${names.join(', ')} } from ${JSON.stringify(resolved)};`;
    }
    // Fallback: wildcard namespace (when imported file couldn't be analysed).
    const id = node.path.replace(/[^a-zA-Z0-9]/g, '_');
    return `import * as __mod${id} from ${JSON.stringify(resolved)};`;
  }

  genStatement(node, depth, topLevel = false) {
    const pad = INDENT.repeat(depth);
    switch (node.type) {
      case NodeType.PrintStatement:
        // In browser mode, route through __rt.print so the caller can redirect output.
        return this.browserMode
          ? `${pad}__rt.print(${this.genExpression(node.expression)});`
          : `${pad}console.log(${this.genExpression(node.expression)});`;

      case NodeType.Assignment:
        return `${pad}${node.name} = ${this.genExpression(node.value)};`;

      case NodeType.IfStatement: {
        let out = `${pad}if (${this.genExpression(node.condition)}) {\n`;
        out += this.genBody(node.consequent, depth + 1);
        out += `\n${pad}}`;
        if (node.alternate) {
          // Single chained IfStatement → `else if (...)` without extra braces.
          if (node.alternate.length === 1 && node.alternate[0].type === NodeType.IfStatement) {
            const elseIf = this.genStatement(node.alternate[0], depth);
            out += ` else ${elseIf.trimStart()}`;
          } else {
            out += ` else {\n${this.genBody(node.alternate, depth + 1)}\n${pad}}`;
          }
        }
        return out;
      }

      case NodeType.FunctionDeclaration: {
        const exportKw = (this.isModule && topLevel) ? 'export ' : '';
        const kw = this.asyncMode ? 'async function' : 'function';
        const params = node.params.join(', ');
        const locals = collectAssignedNames(node.body)
          .filter((name) => !node.params.includes(name));
        const inner = [];
        if (locals.length > 0) {
          inner.push(`${INDENT.repeat(depth + 1)}let ${locals.join(', ')};`);
        }
        for (const stmt of node.body) inner.push(this.genStatement(stmt, depth + 1));
        return `${pad}${exportKw}${kw} ${node.name}(${params}) {\n${inner.join('\n')}\n${pad}}`;
      }

      case NodeType.ReturnStatement:
        return node.argument
          ? `${pad}return ${this.genExpression(node.argument)};`
          : `${pad}return;`;

      case NodeType.ExpressionStatement:
        return `${pad}${this.genExpression(node.expression)};`;

      case NodeType.ForStatement: {
        // `for item in list ... end`  →  `for (const item of list) { ... }`
        const iter  = this.genExpression(node.iterable);
        const inner = this.genBody(node.body, depth + 1);
        return `${pad}for (const ${node.variable} of ${iter}) {\n${inner}\n${pad}}`;
      }

      case NodeType.WhileStatement: {
        // `while cond ... end`  →  `while (cond) { ... }`
        const cond  = this.genExpression(node.condition);
        const inner = this.genBody(node.body, depth + 1);
        return `${pad}while (${cond}) {\n${inner}\n${pad}}`;
      }

      case NodeType.StreamStatement: {
        // `stream ai.ask("prompt") ... end`
        // → `await __rt.ai.stream("prompt", async (chunk) => { ... })`
        // The call must be a namespace capability call.
        const call = node.call;
        if (
          call.type !== NodeType.CallExpression ||
          call.callee.type !== NodeType.MemberExpression ||
          call.callee.object.type !== NodeType.Identifier ||
          !NAMESPACES.has(call.callee.object.name)
        ) {
          throw new FutureError(
            'stream requires a capability call, e.g. stream ai.ask("prompt")',
            node.line, node.column, 'codegen',
          );
        }
        const ns   = call.callee.object.name;
        const args = call.arguments.map((a) => this.genExpression(a)).join(', ');
        const sep  = args ? ', ' : '';
        const inner = this.genBody(node.body, depth + 1);
        return `${pad}await __rt.${ns}.stream(${args}${sep}__safe("stream", async (chunk) => {\n${inner}\n${pad}}));`;
      }

      case NodeType.TryStatement: {
        // `try ... catch err ... end`  →  `try { ... } catch (err) { ... }`
        const tryBody   = this.genBody(node.body, depth + 1);
        const catchBody = this.genBody(node.catchBody, depth + 1);
        return (
          `${pad}try {\n${tryBody}\n${pad}} catch (${node.catchVar}) {\n${catchBody}\n${pad}}`
        );
      }

      case NodeType.AgentDeclaration: {
        // `agent name use cap ... end`
        // Compiles to: async function name(goal) { let locals; body }
        // `use` declarations are no-ops in generated code — they exist for tooling.
        // `goal` is the implicit parameter; filter it from hoisted locals.
        const locals = collectAssignedNames(node.body)
          .filter((n) => n !== 'goal');
        const inner = [];
        if (locals.length > 0) {
          inner.push(`${INDENT.repeat(depth + 1)}let ${locals.join(', ')};`);
        }
        for (const stmt of node.body) inner.push(this.genStatement(stmt, depth + 1));
        return `${pad}async function ${node.name}(goal) {\n${inner.join('\n')}\n${pad}}`;
      }

      case NodeType.OnStatement: {
        // `on mqtt "topic" ... end`
        // → await __rt.<source>.subscribe(<channel>, __safe("<source>", async (message) => { ... }))
        const inner = this.genBody(node.body, depth + 1);
        const chan  = this.genExpression(node.channel);
        const ns    = JSON.stringify(node.source);
        return `${pad}await __rt.${node.source}.subscribe(${chan}, __safe(${ns}, async (message) => {\n${inner}\n${pad}}));`;
      }

      case NodeType.EveryStatement: {
        // `every "30m" ... end`
        // → await __rt.schedule.every(<interval>, __safe("schedule", async () => { ... }))
        const inner    = this.genBody(node.body, depth + 1);
        const interval = this.genExpression(node.interval);
        return `${pad}await __rt.schedule.every(${interval}, __safe("schedule", async () => {\n${inner}\n${pad}}));`;
      }

      default:
        throw new FutureError(
          `Cannot generate statement of type ${node.type}`,
          node.line, node.column, 'codegen',
        );
    }
  }

  genBody(statements, depth) {
    return statements.map((s) => this.genStatement(s, depth)).join('\n');
  }

  genExpression(node) {
    switch (node.type) {
      case NodeType.NumberLiteral:
        return String(node.value);
      case NodeType.StringLiteral:
        return this.genStringLiteral(node.value);
      case NodeType.BooleanLiteral:
        return node.value ? 'true' : 'false';
      case NodeType.NullLiteral:
        return 'null';
      case NodeType.Identifier:
        return node.name;
      case NodeType.MemberExpression: {
        const obj = node.object;
        // In async mode, direct member access on a runtime namespace routes through __rt.
        // Aliases from `use "..." as alias` are NOT runtime namespaces.
        if (
          this.asyncMode &&
          obj.type === NodeType.Identifier &&
          NAMESPACES.has(obj.name) &&
          !this.useAliases.has(obj.name)
        ) {
          return `__rt.${obj.name}.${node.property}`;
        }
        return `${this.genExpression(obj)}.${node.property}`;
      }
      case NodeType.CallExpression:
        return this.genCall(node);
      case NodeType.UnaryExpression: {
        const op = node.operator === 'not' ? '!' : '-';
        return `${op}${this.genExpression(node.argument)}`;
      }
      case NodeType.BinaryExpression: {
        const op = mapOperator(node.operator);
        return `(${this.genExpression(node.left)} ${op} ${this.genExpression(node.right)})`;
      }
      case NodeType.ArrayLiteral: {
        const els = node.elements.map((e) => this.genExpression(e)).join(', ');
        return `[${els}]`;
      }
      case NodeType.ObjectLiteral: {
        if (node.properties.length === 0) return '{}';
        const props = node.properties
          .map((p) => `${JSON.stringify(p.key)}: ${this.genExpression(p.value)}`)
          .join(', ');
        return `{ ${props} }`;
      }
      default:
        throw new FutureError(
          `Cannot generate expression of type ${node.type}`,
          node.line, node.column, 'codegen',
        );
    }
  }

  genCall(node) {
    const args = node.arguments.map((a) => this.genExpression(a)).join(', ');
    const callee = node.callee;

    // Capability call, e.g. http.get(...) -> await __rt.http.get(...)
    if (isNamespaceCall(node, this.useAliases)) {
      return `await __rt.${callee.object.name}.${callee.property}(${args})`;
    }

    if (callee.type === NodeType.Identifier) {
      // len(x) → __len(x)  (sync built-in, no runtime dependency)
      if (callee.name === 'len') return `__len(${args})`;
      // input(prompt) → await __rt.input(prompt)  (async built-in)
      if (callee.name === 'input') return `await __rt.input(${args})`;
      // User function call. In async mode every function is async, so await it.
      return this.asyncMode ? `await ${callee.name}(${args})` : `${callee.name}(${args})`;
    }
    // Method call on a runtime-returned object (e.g. kb.query(), kb.index()).
    // In async mode we await ALL method calls: `await x` on a sync value is harmless,
    // and it ensures calls like kb.query() — where kb holds an async-returning object —
    // are properly awaited. This is required for the Knowledge Base API to work correctly.
    if (this.asyncMode && callee.type === NodeType.MemberExpression) {
      return `await ${this.genExpression(callee)}(${args})`;
    }
    return `${this.genExpression(callee)}(${args})`;
  }

  /**
   * Generate a JS string literal from a Future string value.
   * If the string contains `{identifier}` patterns, emits a JS template literal.
   * `\{` in the source was stored as \x01 by the lexer — we restore it as a literal `{`.
   * In async mode, `{namespace.prop}` is rewritten to `${__rt.namespace.prop}`.
   */
  genStringLiteral(value) {
    const withEscapes = value.replace(/\x01/g, '{');
    const INTERP = /\{[a-zA-Z_][a-zA-Z0-9_.]*\}/;
    if (!INTERP.test(withEscapes)) {
      return JSON.stringify(withEscapes);
    }
    const safe = withEscapes
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\$\{/g, '\\${');
    const templated = safe.replace(/\{([a-zA-Z_][a-zA-Z0-9_.]*)\}/g, (_, expr) => {
      if (this.asyncMode) {
        const dot = expr.indexOf('.');
        const first = dot === -1 ? expr : expr.slice(0, dot);
        if (NAMESPACES.has(first)) return `\${__rt.${expr}}`;
      }
      return `\${${expr}}`;
    });
    return `\`${templated}\``;
  }
}

/**
 * True if a CallExpression's callee is `<namespace>.<method>` where the namespace
 * is a runtime module (not a user-defined `use ... as` alias).
 */
function isNamespaceCall(node, useAliases = new Set()) {
  const c = node.callee;
  return (
    node.type === NodeType.CallExpression &&
    c.type === NodeType.MemberExpression &&
    c.object.type === NodeType.Identifier &&
    NAMESPACES.has(c.object.name) &&
    !useAliases.has(c.object.name)
  );
}

/** Walk the whole AST and report whether any capability call is present. */
function usesRuntime(node, useAliases = new Set()) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === NodeType.CallExpression && isNamespaceCall(node, useAliases)) return true;
  // input() is a built-in async function that needs __rt.
  if (node.type === NodeType.CallExpression &&
      node.callee.type === NodeType.Identifier &&
      node.callee.name === 'input') return true;
  // Direct namespace property access (e.g. math.pi, math.e) also needs __rt.
  if (node.type === NodeType.MemberExpression &&
      node.object?.type === NodeType.Identifier &&
      NAMESPACES.has(node.object.name) &&
      !useAliases.has(node.object.name)) return true;
  // String interpolation referencing a namespace, e.g. "π = {math.pi}".
  // The {namespace.prop} pattern lives inside the string value, not as an AST node.
  if (node.type === NodeType.StringLiteral) {
    const RE = /\{([a-zA-Z_][a-zA-Z0-9]*)\.[a-zA-Z0-9_.]+\}/g;
    for (const m of String(node.value).matchAll(RE)) {
      if (NAMESPACES.has(m[1])) return true;
    }
  }
  // Event-oriented, streaming, and agent statements always require async mode.
  if (node.type === NodeType.OnStatement || node.type === NodeType.EveryStatement) return true;
  if (node.type === NodeType.StreamStatement) return true;
  // AgentDeclaration always compiles to an async function — callers must await it.
  if (node.type === NodeType.AgentDeclaration) return true;
  // For, While, and Try: walk their bodies (handled by the generic key loop below).
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      if (value.some((v) => usesRuntime(v, useAliases))) return true;
    } else if (value && typeof value === 'object' && value.type) {
      if (usesRuntime(value, useAliases)) return true;
    }
  }
  return false;
}

/** True if the program has any async event handlers (on/every/stream). */
function usesHandlers(node) {
  if (!node || typeof node !== 'object') return false;
  if (
    node.type === NodeType.OnStatement ||
    node.type === NodeType.EveryStatement ||
    node.type === NodeType.StreamStatement
  ) return true;
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) { if (v.some(usesHandlers)) return true; }
    else if (v && typeof v === 'object' && v.type) { if (usesHandlers(v)) return true; }
  }
  return false;
}

/** Walk the AST and check if a specific built-in function name is called. */
function usesBuiltin(node, name) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === NodeType.CallExpression &&
      node.callee.type === NodeType.Identifier &&
      node.callee.name === name) return true;
  for (const key of Object.keys(node)) {
    const v = node[key];
    if (Array.isArray(v)) { if (v.some((c) => usesBuiltin(c, name))) return true; }
    else if (v && typeof v === 'object' && v.type) { if (usesBuiltin(v, name)) return true; }
  }
  return false;
}

function mapOperator(op) {
  switch (op) {
    case '==': return '===';
    case '!=': return '!==';
    case 'and': return '&&';
    case 'or': return '||';
    default: return op;
  }
}

/**
 * Names assigned at one scope level — hoisted to a `let` declaration.
 * Recurses into if/for/try bodies (all share the same JS scope).
 * Does NOT recurse into FunctionDeclaration, OnStatement, EveryStatement
 * (those create new JS function scopes).
 */
function collectAssignedNames(statements) {
  const names = new Set();
  const visit = (stmts) => {
    for (const node of stmts) {
      if (node.type === NodeType.Assignment) {
        names.add(node.name);
      } else if (node.type === NodeType.IfStatement) {
        visit(node.consequent);
        if (node.alternate) visit(node.alternate);
      } else if (node.type === NodeType.ForStatement) {
        // Loop variable is declared `const` in the for-of — do NOT hoist it.
        // But assignments inside the body DO belong to the outer scope.
        visit(node.body);
      } else if (node.type === NodeType.WhileStatement) {
        visit(node.body);
      } else if (node.type === NodeType.TryStatement) {
        // Catch variable is declared in catch() — do NOT hoist it.
        // But other assignments in try/catch bodies belong to the outer scope.
        visit(node.body);
        visit(node.catchBody);
      }
    }
  };
  visit(statements);
  return [...names];
}

/**
 * @param {object} program
 * @param {{ runtimeSpecifier?: string }} [options]
 * @returns {string}
 */
export function generate(program, options = {}) {
  return new Generator().generate(program, options);
}
