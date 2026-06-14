// parser.js
// Phase 2 — Parser.
// A hand-written recursive-descent parser that turns a token list into an AST.
//
// Statement boundaries are determined structurally (not by newlines), so
// `name = "John" age = 30` correctly parses as two statements: after the
// expression `"John"` there is no operator, so the assignment ends and a new
// statement begins.

import { FutureError } from './errors.js';
import * as AST from './ast.js';

/**
 * Tokens that can never *start* an expression. Used to decide whether an
 * optional expression (e.g. the value after `return`) is present.
 */
const EXPR_TERMINATORS = new Set(['END', 'ELSE', 'CATCH', 'EOF']);

/** Built-in namespace names that cannot be redefined by user code. */
const RESERVED_NAMESPACES = new Set([
  'ai', 'http', 'mqtt', 'tts', 'rag', 'vision', 'home',
  'memory', 'schedule', 'system', 'device', 'math', 'assert',
  'server', 'db',
]);

/** HTTP verbs that open a server route block: server.METHOD("path") ... end */
const SERVER_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch']);

export class Parser {
  /** @param {import('./lexer.js').Token[]} tokens */
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  // --- token stream helpers ---------------------------------------------------

  peek(offset = 0) {
    const i = Math.min(this.pos + offset, this.tokens.length - 1);
    return this.tokens[i];
  }

  advance() {
    const token = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return token;
  }

  check(type) {
    return this.peek().type === type;
  }

  /** Consume and return the next token if it matches any given type, else null. */
  match(...types) {
    return types.includes(this.peek().type) ? this.advance() : null;
  }

  /** Consume a token of `type` or throw a diagnostic. */
  expect(type, description) {
    if (this.check(type)) return this.advance();
    const tok = this.peek();
    const found = tok.type === 'EOF' ? 'end of file' : `'${tok.value}'`;
    throw new FutureError(
      `Expected ${description ?? type} but found ${found}`,
      tok.line, tok.column, 'parse',
    );
  }

  // --- grammar ----------------------------------------------------------------

  /** Entry point. @returns {object} a Program node. */
  parse() {
    const body = [];
    while (!this.check('EOF')) {
      body.push(this.parseStatement());
    }
    return AST.Program(body);
  }

  parseStatement() {
    const tok = this.peek();
    switch (tok.type) {
      case 'PRINT':    return this.parsePrint();
      case 'IF':       return this.parseIf();
      case 'FUNCTION': return this.parseFunction();
      case 'RETURN':   return this.parseReturn();
      case 'ON':       return this.parseOn();
      case 'EVERY':    return this.parseEvery();
      case 'FOR':      return this.parseFor();
      case 'WHILE':    return this.parseWhile();
      case 'TRY':      return this.parseTry();
      case 'STREAM':   return this.parseStream();
      case 'AGENT':    return this.parseAgent();
      case 'USE':      return this.parseUse();
      case 'IDENTIFIER':
        // One token of lookahead separates assignment from a bare call/expression.
        if (this.peek(1).type === 'ASSIGN') return this.parseAssignment();
        // server.METHOD("path") ... end  — HTTP route block
        if (
          this.peek(0).value === 'server' &&
          this.peek(1).type === 'DOT' &&
          SERVER_METHODS.has(this.peek(2).value) &&
          this.peek(3).type === 'LPAREN'
        ) return this.parseServerRoute();
        return this.parseExpressionStatement();
      default:
        return this.parseExpressionStatement();
    }
  }

  parsePrint() {
    const kw = this.advance(); // PRINT
    const expression = this.parseExpression();
    return AST.PrintStatement(expression, kw.line, kw.column);
  }

  /**
   * Top-level `use "./file.future"` or `use "./file.future" as alias`.
   * Inside an agent block, `use capability` (IDENTIFIER) is handled by parseAgent.
   */
  parseUse() {
    const kw = this.advance(); // USE
    const path = this.expect('STRING', 'file path string after "use"');
    let alias = null;
    if (this.match('AS')) {
      alias = this.expect('IDENTIFIER', 'alias name after "as"').value;
    }
    return AST.UseStatement(path.value, alias, kw.line, kw.column);
  }

  parseAssignment() {
    const name = this.advance(); // IDENTIFIER
    if (RESERVED_NAMESPACES.has(name.value)) {
      throw new FutureError(
        `'${name.value}' is a reserved namespace and cannot be reassigned`,
        name.line, name.column, 'parse',
      );
    }
    this.expect('ASSIGN', "'='");
    const value = this.parseExpression();
    return AST.Assignment(name.value, value, name.line, name.column);
  }

  /**
   * `if cond ... [else if cond ...]* [else ...] end`
   * @param {boolean} isChained  True when parsing an `else if` branch — the
   *   outer `if` owns the single `end`, so this call must NOT consume it.
   */
  parseIf(isChained = false) {
    const kw = this.advance(); // IF
    const condition = this.parseExpression();
    const consequent = this.parseBlock(['ELSE', 'END'], 'if');
    let alternate = null;
    if (this.check('ELSE')) {
      this.advance(); // ELSE
      if (this.check('IF')) {
        // else if — recurse; the chained call skips its own `end`
        alternate = [this.parseIf(true)];
      } else {
        alternate = this.parseBlock(['END'], 'else');
      }
    }
    if (!isChained) {
      this.expect('END', "'end' to close 'if'");
    }
    return AST.IfStatement(condition, consequent, alternate, kw.line, kw.column);
  }

  parseFunction() {
    const kw = this.advance(); // FUNCTION
    const name = this.expect('IDENTIFIER', 'function name');
    if (RESERVED_NAMESPACES.has(name.value)) {
      throw new FutureError(
        `'${name.value}' is a reserved namespace and cannot be used as a function name`,
        name.line, name.column, 'parse',
      );
    }
    this.expect('LPAREN', "'('");
    const params = [];
    if (!this.check('RPAREN')) {
      do {
        params.push(this.expect('IDENTIFIER', 'parameter name').value);
      } while (this.match('COMMA'));
    }
    this.expect('RPAREN', "')'");
    const body = this.parseBlock(['END'], 'function');
    this.expect('END', "'end' to close 'function'");
    return AST.FunctionDeclaration(name.value, params, body, kw.line, kw.column);
  }

  parseReturn() {
    const kw = this.advance(); // RETURN
    let argument = null;
    if (!EXPR_TERMINATORS.has(this.peek().type)) {
      argument = this.parseExpression();
    }
    return AST.ReturnStatement(argument, kw.line, kw.column);
  }

  parseExpressionStatement() {
    const expr = this.parseExpression();
    return AST.ExpressionStatement(expr, expr.line, expr.column);
  }

  /**
   * `for <variable> in <iterable-expr> ... end`
   */
  parseFor() {
    const kw       = this.advance(); // FOR
    const variable = this.expect('IDENTIFIER', 'loop variable name');
    this.expect('IN', "'in'");
    const iterable = this.parseExpression();
    const body     = this.parseBlock(['END'], 'for');
    this.expect('END', "'end' to close 'for'");
    return AST.ForStatement(variable.value, iterable, body, kw.line, kw.column);
  }

  /**
   * `try ... catch <errorVar> ... end`
   */
  parseTry() {
    const kw      = this.advance(); // TRY
    const body    = this.parseBlock(['CATCH'], 'try');
    this.expect('CATCH', "'catch' after 'try' block");
    const errVar  = this.expect('IDENTIFIER', 'error variable name');
    const catchBody = this.parseBlock(['END'], 'catch');
    this.expect('END', "'end' to close 'try'");
    return AST.TryStatement(body, errVar.value, catchBody, kw.line, kw.column);
  }

  /**
   * `agent <name>
   *    use <capability>
   *    ... body statements ...
   *  end`
   *
   * `use <cap>` lines are collected as the capabilities list.
   * The body receives an implicit `goal` variable — the argument passed at call-site.
   * Compiles to: async function name(goal) { ... }
   */
  parseAgent() {
    const kw   = this.advance(); // AGENT
    const name = this.expect('IDENTIFIER', 'agent name');
    const capabilities = [];
    const body = [];
    while (!this.check('END') && !this.check('EOF')) {
      if (this.check('USE')) {
        this.advance(); // USE
        const cap = this.expect('IDENTIFIER', 'capability name after "use"');
        capabilities.push(cap.value);
      } else {
        body.push(this.parseStatement());
      }
    }
    this.expect('END', "'end' to close 'agent'");
    return AST.AgentDeclaration(name.value, capabilities, body, kw.line, kw.column);
  }

  /**
   * `while <condition> ... end`
   */
  parseWhile() {
    const kw = this.advance(); // WHILE
    const condition = this.parseExpression();
    const body = this.parseBlock(['END'], 'while');
    this.expect('END', "'end' to close 'while'");
    return AST.WhileStatement(condition, body, kw.line, kw.column);
  }

  /**
   * `stream <call-expr> ... end`
   * The call must be a capability call (e.g. ai.ask("prompt")).
   * The body receives an implicit `chunk` variable with each streamed piece.
   * Compiles to: await __rt.<namespace>.stream(<args>, async (chunk) => { body })
   */
  parseStream() {
    const kw = this.advance(); // STREAM
    const call = this.parseExpression();
    const body = this.parseBlock(['END'], 'stream');
    this.expect('END', "'end' to close 'stream'");
    return AST.StreamStatement(call, body, kw.line, kw.column);
  }

  /**
   * `on <source> <channel-expr> ... end`
   * e.g. `on mqtt "house/temp" ... end`
   * The body receives an implicit `message` variable containing the event payload.
   */
  parseOn() {
    const kw = this.advance(); // ON
    const source = this.expect('IDENTIFIER', 'event source name (e.g. mqtt)');
    const channel = this.parseExpression();
    const body = this.parseBlock(['END'], 'on');
    this.expect('END', "'end' to close 'on'");
    return AST.OnStatement(source.value, channel, body, kw.line, kw.column);
  }

  /**
   * `server.METHOD("path") ... end`
   * Registers an HTTP route. The body has an implicit `req` variable.
   * e.g. `server.get("/api/users") ... end`
   */
  parseServerRoute() {
    const kw = this.advance(); // IDENTIFIER 'server'
    this.advance();            // DOT '.'
    const method = this.advance().value; // get | post | put | delete | patch
    this.expect('LPAREN', "'('");
    const path = this.expect('STRING', 'route path string (e.g. "/api/users")');
    this.expect('RPAREN', "')'");
    const body = this.parseBlock(['END'], `server.${method}`);
    this.expect('END', `'end' to close 'server.${method}'`);
    return AST.ServerRoute(method, path.value, body, kw.line, kw.column);
  }

  /**
   * `every <interval-expr> ... end`
   * e.g. `every "30m" ... end`
   * Compiles to schedule.every(interval, async () => { ... }).
   */
  parseEvery() {
    const kw = this.advance(); // EVERY
    const interval = this.parseExpression();
    const body = this.parseBlock(['END'], 'every');
    this.expect('END', "'end' to close 'every'");
    return AST.EveryStatement(interval, body, kw.line, kw.column);
  }

  /**
   * Collect statements until one of `terminators` (or EOF) is next.
   * Throws if EOF is reached before a terminator (e.g. a missing `end`).
   */
  parseBlock(terminators, openedBy = null) {
    const statements = [];
    while (!this.check('EOF') && !terminators.includes(this.peek().type)) {
      statements.push(this.parseStatement());
    }
    if (this.check('EOF')) {
      const tok = this.peek();
      const expected = terminators.map((t) => `'${t.toLowerCase()}'`).join(' or ');
      const hint = openedBy ? ` to close '${openedBy}'` : '';
      throw new FutureError(
        `Unexpected end of file — expected ${expected}${hint}`,
        tok.line, tok.column, 'parse',
      );
    }
    return statements;
  }

  // --- expressions (precedence climbing, lowest to highest) -------------------

  parseExpression() {
    return this.parseOr();
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.check('OR')) {
      const op = this.advance();
      left = AST.BinaryExpression('or', left, this.parseAnd(), op.line, op.column);
    }
    return left;
  }

  parseAnd() {
    let left = this.parseEquality();
    while (this.check('AND')) {
      const op = this.advance();
      left = AST.BinaryExpression('and', left, this.parseEquality(), op.line, op.column);
    }
    return left;
  }

  parseEquality() {
    let left = this.parseComparison();
    while (this.check('EQ') || this.check('NEQ')) {
      const op = this.advance();
      left = AST.BinaryExpression(op.value, left, this.parseComparison(), op.line, op.column);
    }
    return left;
  }

  parseComparison() {
    let left = this.parseAdditive();
    while (['GT', 'GTE', 'LT', 'LTE'].includes(this.peek().type)) {
      const op = this.advance();
      left = AST.BinaryExpression(op.value, left, this.parseAdditive(), op.line, op.column);
    }
    return left;
  }

  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.check('PLUS') || this.check('MINUS')) {
      const op = this.advance();
      left = AST.BinaryExpression(op.value, left, this.parseMultiplicative(), op.line, op.column);
    }
    return left;
  }

  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.check('STAR') || this.check('SLASH')) {
      const op = this.advance();
      left = AST.BinaryExpression(op.value, left, this.parseUnary(), op.line, op.column);
    }
    return left;
  }

  parseUnary() {
    if (this.check('NOT') || this.check('MINUS')) {
      const op = this.advance();
      const operator = op.type === 'NOT' ? 'not' : '-';
      return AST.UnaryExpression(operator, this.parseUnary(), op.line, op.column);
    }
    return this.parsePrimary();
  }

  // primary = atom followed by any chain of `.member`, `(call)`, and `[index]` postfixes.
  // This powers capability calls like http.get("..."), property access like todo.title,
  // and array/object indexing like rows[0] or map["key"].
  parsePrimary() {
    let node = this.parseAtom();
    while (true) {
      if (this.match('DOT')) {
        const prop = this.expect('IDENTIFIER', 'property name after "."');
        node = AST.MemberExpression(node, prop.value, prop.line, prop.column);
      } else if (this.check('LPAREN')) {
        node = this.finishCall(node);
      } else if (this.check('LBRACKET')) {
        const bracket = this.advance(); // '['
        const index = this.parseExpression();
        this.expect('RBRACKET', "']'");
        node = AST.IndexExpression(node, index, bracket.line, bracket.column);
      } else {
        break;
      }
    }
    return node;
  }

  parseAtom() {
    const tok = this.peek();
    switch (tok.type) {
      case 'NUMBER':
        this.advance();
        return AST.NumberLiteral(tok.value, tok.line, tok.column);
      case 'STRING':
        this.advance();
        return AST.StringLiteral(tok.value, tok.line, tok.column);
      case 'TRUE':
        this.advance();
        return AST.BooleanLiteral(true, tok.line, tok.column);
      case 'FALSE':
        this.advance();
        return AST.BooleanLiteral(false, tok.line, tok.column);
      case 'IDENTIFIER':
        this.advance();
        return AST.Identifier(tok.value, tok.line, tok.column);
      case 'LPAREN': {
        this.advance();
        const expr = this.parseExpression();
        this.expect('RPAREN', "')'");
        return expr;
      }
      case 'NULL':
        this.advance();
        return AST.NullLiteral(tok.line, tok.column);
      case 'LBRACKET':
        return this.parseArrayLiteral();
      case 'LBRACE':
        return this.parseObjectLiteral();
      default: {
        const found = tok.type === 'EOF' ? 'end of file' : `'${tok.value}'`;
        throw new FutureError(`Unexpected token ${found}`, tok.line, tok.column, 'parse');
      }
    }
  }

  /** `[expr, expr, ...]` — commas between elements are required. */
  parseArrayLiteral() {
    const tok = this.peek();
    this.expect('LBRACKET', "'['");
    const elements = [];
    while (!this.check('RBRACKET') && !this.check('EOF')) {
      elements.push(this.parseExpression());
      if (!this.match('COMMA')) break; // trailing comma OK, comma required between elements
    }
    this.expect('RBRACKET', "']'");
    return AST.ArrayLiteral(elements, tok.line, tok.column);
  }

  /**
   * `{ key: expr  key: expr }` — no commas, whitespace/newline as separator.
   * The lexer skips all whitespace, so properties are separated implicitly.
   */
  parseObjectLiteral() {
    const tok = this.peek();
    this.expect('LBRACE', "'{'");
    const properties = [];
    while (!this.check('RBRACE') && !this.check('EOF')) {
      const key = this.expect('IDENTIFIER', 'property name');
      this.expect('COLON', "':'");
      const value = this.parseExpression();
      properties.push({ key: key.value, value });
      this.match('COMMA'); // optional comma — allows both styles
    }
    this.expect('RBRACE', "'}'");
    return AST.ObjectLiteral(properties, tok.line, tok.column);
  }

  // `callee` is the already-parsed expression preceding the '(' (an Identifier
  // such as greet, or a MemberExpression such as http.get).
  finishCall(callee) {
    this.expect('LPAREN', "'('");
    const args = [];
    if (!this.check('RPAREN')) {
      do {
        args.push(this.parseExpression());
      } while (this.match('COMMA'));
    }
    this.expect('RPAREN', "')'");
    return AST.CallExpression(callee, args, callee.line, callee.column);
  }
}

/**
 * Convenience wrapper.
 * @param {import('./lexer.js').Token[]} tokens
 * @returns {object} Program node.
 */
export function parse(tokens) {
  return new Parser(tokens).parse();
}
