// ast.js
// AST node types and factory functions for Future.
//
// Design note: capabilities like HTTP/AI/MQTT/TTS are NOT special node types.
// They are ordinary calls whose callee is a `MemberExpression` (e.g. http.get).
// This keeps the AST tiny and means new capabilities (RAG, Vision AI, Home
// Automation, ...) need ZERO grammar/AST changes — only a new runtime module.

export const NodeType = Object.freeze({
  Program: 'Program',
  UseStatement: 'UseStatement',  // use "./file.future" [as alias]
  PrintStatement: 'PrintStatement',
  Assignment: 'Assignment',
  IfStatement: 'IfStatement',
  FunctionDeclaration: 'FunctionDeclaration',
  ReturnStatement: 'ReturnStatement',
  ExpressionStatement: 'ExpressionStatement',
  // Event-oriented statements.
  OnStatement: 'OnStatement',       // on <source> <channel> ... end
  EveryStatement: 'EveryStatement', // every <interval> ... end
  // Iteration.
  ForStatement: 'ForStatement',     // for <var> in <expr> ... end
  WhileStatement: 'WhileStatement', // while <condition> ... end
  // Error handling.
  TryStatement: 'TryStatement',     // try ... catch <var> ... end
  // Streaming.
  StreamStatement: 'StreamStatement', // stream <call> ... end
  // Agent declaration — architecture support (parser implementation pending).
  AgentDeclaration: 'AgentDeclaration', // agent <name> use <cap> ... end
  // Literals.
  ArrayLiteral: 'ArrayLiteral',     // [expr, expr, ...]
  ObjectLiteral: 'ObjectLiteral',   // { key: expr  key: expr }
  BinaryExpression: 'BinaryExpression',
  UnaryExpression: 'UnaryExpression',
  CallExpression: 'CallExpression',
  MemberExpression: 'MemberExpression',
  Identifier: 'Identifier',
  NumberLiteral: 'NumberLiteral',
  StringLiteral: 'StringLiteral',
  BooleanLiteral: 'BooleanLiteral',
  NullLiteral: 'NullLiteral',
});

// --- Statements ---
export const Program = (body) => ({ type: NodeType.Program, body });

/**
 * `use "./file.future"` or `use "./file.future" as alias`
 * Top-level file import. Compiles to an ES `import` statement.
 * @param {string}      path   Relative path to the imported .future file.
 * @param {string|null} alias  Namespace alias, or null for named imports.
 */
export const UseStatement = (path, alias, line, column) => ({
  type: NodeType.UseStatement, path, alias, line, column,
});

export const PrintStatement = (expression, line, column) => ({
  type: NodeType.PrintStatement, expression, line, column,
});

export const Assignment = (name, value, line, column) => ({
  type: NodeType.Assignment, name, value, line, column,
});

export const IfStatement = (condition, consequent, alternate, line, column) => ({
  type: NodeType.IfStatement, condition, consequent, alternate, line, column,
});

export const FunctionDeclaration = (name, params, body, line, column) => ({
  type: NodeType.FunctionDeclaration, name, params, body, line, column,
});

export const ReturnStatement = (argument, line, column) => ({
  type: NodeType.ReturnStatement, argument, line, column,
});

export const ExpressionStatement = (expression, line, column) => ({
  type: NodeType.ExpressionStatement, expression, line, column,
});

/**
 * `on <source> <channel> ... end`
 * Subscribes to an event source (e.g. mqtt) on a channel. The body receives an
 * implicit `message` binding containing the event payload.
 * @param {string} source   Runtime module name, e.g. "mqtt".
 * @param {object} channel  Expression node for the channel/topic string.
 * @param {object[]} body   Statement list (callback body).
 */
export const OnStatement = (source, channel, body, line, column) => ({
  type: NodeType.OnStatement, source, channel, body, line, column,
});

/**
 * `every <interval> ... end`
 * Runs the body on a recurring schedule. Compiles to schedule.every(interval, callback).
 * @param {object} interval  Expression node (string or number literal).
 * @param {object[]} body    Statement list (callback body).
 */
export const EveryStatement = (interval, body, line, column) => ({
  type: NodeType.EveryStatement, interval, body, line, column,
});

/**
 * `for <variable> in <iterable> ... end`
 * Compiles to `for (const <variable> of <iterable>) { ... }`
 */
export const ForStatement = (variable, iterable, body, line, column) => ({
  type: NodeType.ForStatement, variable, iterable, body, line, column,
});

/**
 * `try ... catch <errorVar> ... end`
 * Compiles to `try { ... } catch (<errorVar>) { ... }`
 */
export const TryStatement = (body, catchVar, catchBody, line, column) => ({
  type: NodeType.TryStatement, body, catchVar, catchBody, line, column,
});

/**
 * `while <condition> ... end`
 * Compiles to `while (condition) { ... }`
 */
export const WhileStatement = (condition, body, line, column) => ({
  type: NodeType.WhileStatement, condition, body, line, column,
});

/**
 * `agent <name> ... end`
 * Declares an agent with a set of capabilities and an optional body.
 * Parser implementation is pending; this node supports architecture and tooling.
 * @param {string}   name          Agent name identifier.
 * @param {string[]} capabilities  List of runtime modules the agent uses (e.g. ['rag','ai']).
 * @param {object[]} body          Statement list (agent body).
 */
export const AgentDeclaration = (name, capabilities, body, line, column) => ({
  type: NodeType.AgentDeclaration, name, capabilities, body, line, column,
});

/**
 * `stream <callExpr> ... end`
 * Streams a response and binds each chunk to the implicit `chunk` variable in the body.
 * Compiles to: await __rt.ai.stream(args, async (chunk) => { ... })
 * Parser implementation is pending.
 * @param {object}   call  CallExpression node representing the streaming call.
 * @param {object[]} body  Statement list executed for each chunk.
 */
export const StreamStatement = (call, body, line, column) => ({
  type: NodeType.StreamStatement, call, body, line, column,
});

// --- Expressions ---
export const BinaryExpression = (operator, left, right, line, column) => ({
  type: NodeType.BinaryExpression, operator, left, right, line, column,
});

export const UnaryExpression = (operator, argument, line, column) => ({
  type: NodeType.UnaryExpression, operator, argument, line, column,
});

/** `callee` is any expression (an Identifier or a MemberExpression). */
export const CallExpression = (callee, args, line, column) => ({
  type: NodeType.CallExpression, callee, arguments: args, line, column,
});

/** `object.property` — e.g. http.get or todo.title. `property` is a string. */
export const MemberExpression = (object, property, line, column) => ({
  type: NodeType.MemberExpression, object, property, line, column,
});

export const Identifier = (name, line, column) => ({
  type: NodeType.Identifier, name, line, column,
});

export const NumberLiteral = (value, line, column) => ({
  type: NodeType.NumberLiteral, value, line, column,
});

export const StringLiteral = (value, line, column) => ({
  type: NodeType.StringLiteral, value, line, column,
});

export const BooleanLiteral = (value, line, column) => ({
  type: NodeType.BooleanLiteral, value, line, column,
});

export const NullLiteral = (line, column) => ({
  type: NodeType.NullLiteral, line, column,
});

/** `[expr, expr, ...]` — array literal. */
export const ArrayLiteral = (elements, line, column) => ({
  type: NodeType.ArrayLiteral, elements, line, column,
});

/**
 * `{ key: expr  key: expr }` — object literal.
 * `properties` is an array of `{ key: string, value: node }`.
 * No commas between properties — separator is whitespace/newline.
 */
export const ObjectLiteral = (properties, line, column) => ({
  type: NodeType.ObjectLiteral, properties, line, column,
});
