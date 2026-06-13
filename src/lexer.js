// lexer.js
// Phase 1 — Tokenizer.
// Converts raw Future source text into a flat list of tokens that the parser
// consumes. Every token records its 1-based line and column for diagnostics.

import { FutureError } from './errors.js';

/** Reserved words mapped to their token type. */
const KEYWORDS = new Map([
  ['print', 'PRINT'],
  ['if', 'IF'],
  ['else', 'ELSE'],
  ['end', 'END'],
  ['function', 'FUNCTION'],
  ['return', 'RETURN'],
  ['true', 'TRUE'],
  ['false', 'FALSE'],
  ['and', 'AND'],
  ['or', 'OR'],
  ['not', 'NOT'],
  // Event-oriented keywords.
  ['on', 'ON'],
  ['every', 'EVERY'],
  // Iteration.
  ['for', 'FOR'],
  ['in', 'IN'],
  // Error handling.
  ['try', 'TRY'],
  ['catch', 'CATCH'],
  // Loop.
  ['while', 'WHILE'],
  // Null literal (two spellings).
  ['null', 'NULL'],
  ['none', 'NULL'],
  // Streaming.
  ['stream', 'STREAM'],
  // Agent.
  ['agent', 'AGENT'],
  ['use', 'USE'],
  ['as', 'AS'],
]);

/** Two-character operators, checked before single-character ones. */
const TWO_CHAR_OPS = new Map([
  ['==', 'EQ'],
  ['!=', 'NEQ'],
  ['>=', 'GTE'],
  ['<=', 'LTE'],
]);

/** Single-character operators and punctuation. */
const ONE_CHAR_OPS = new Map([
  ['=', 'ASSIGN'],
  ['>', 'GT'],
  ['<', 'LT'],
  ['+', 'PLUS'],
  ['-', 'MINUS'],
  ['*', 'STAR'],
  ['/', 'SLASH'],
  ['.', 'DOT'],
  ['(', 'LPAREN'],
  [')', 'RPAREN'],
  [',', 'COMMA'],
  ['[', 'LBRACKET'],
  [']', 'RBRACKET'],
  ['{', 'LBRACE'],
  ['}', 'RBRACE'],
  [':', 'COLON'],
]);

export class Token {
  /**
   * @param {string} type    e.g. 'IDENTIFIER', 'NUMBER', 'PRINT'.
   * @param {*} value        Literal value or raw lexeme.
   * @param {number} line    1-based line.
   * @param {number} column  1-based column.
   */
  constructor(type, value, line, column) {
    this.type = type;
    this.value = value;
    this.line = line;
    this.column = column;
  }
}

export class Lexer {
  /** @param {string} source */
  constructor(source) {
    this.source = source;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
  }

  isAtEnd() {
    return this.pos >= this.source.length;
  }

  /** Look at a character without consuming it. */
  peek(offset = 0) {
    return this.source[this.pos + offset];
  }

  /** Consume and return the current character, advancing line/column counters. */
  advance() {
    const ch = this.source[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  /**
   * Produce the full token list, terminated by an EOF token.
   * @returns {Token[]}
   */
  tokenize() {
    const tokens = [];
    while (true) {
      this.skipTrivia();
      if (this.isAtEnd()) break;

      const line = this.line;
      const column = this.column;
      const ch = this.peek();

      let token;
      if (isDigit(ch)) {
        token = this.readNumber(line, column);
      } else if (ch === '"' || ch === "'") {
        token = this.readString(line, column);
      } else if (isIdentStart(ch)) {
        token = this.readIdentifier(line, column);
      } else {
        token = this.readOperator(line, column);
      }
      tokens.push(token);
    }
    tokens.push(new Token('EOF', null, this.line, this.column));
    return tokens;
  }

  /** Skip whitespace and `#` line comments. */
  skipTrivia() {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
        this.advance();
      } else if (ch === '#') {
        while (!this.isAtEnd() && this.peek() !== '\n') this.advance();
      } else {
        break;
      }
    }
  }

  readNumber(line, column) {
    let text = '';
    while (!this.isAtEnd() && isDigit(this.peek())) text += this.advance();
    // Optional fractional part — only if followed by a digit.
    if (this.peek() === '.' && isDigit(this.peek(1))) {
      text += this.advance(); // the '.'
      while (!this.isAtEnd() && isDigit(this.peek())) text += this.advance();
    }
    return new Token('NUMBER', Number(text), line, column);
  }

  readString(line, column) {
    const quote = this.advance(); // opening quote
    let value = '';
    while (!this.isAtEnd() && this.peek() !== quote) {
      let ch = this.advance();
      if (ch === '\n') {
        throw new FutureError('Unterminated string literal', line, column, 'lex');
      }
      if (ch === '\\') {
        ch = unescape(this.advance());
      }
      value += ch;
    }
    if (this.isAtEnd()) {
      throw new FutureError('Unterminated string literal', line, column, 'lex');
    }
    this.advance(); // closing quote
    return new Token('STRING', value, line, column);
  }

  readIdentifier(line, column) {
    let text = '';
    while (!this.isAtEnd() && isIdentPart(this.peek())) text += this.advance();
    const type = KEYWORDS.get(text) ?? 'IDENTIFIER';
    return new Token(type, text, line, column);
  }

  readOperator(line, column) {
    const ch = this.advance();
    const two = ch + (this.peek() ?? '');
    if (TWO_CHAR_OPS.has(two)) {
      this.advance();
      return new Token(TWO_CHAR_OPS.get(two), two, line, column);
    }
    if (ONE_CHAR_OPS.has(ch)) {
      return new Token(ONE_CHAR_OPS.get(ch), ch, line, column);
    }
    throw new FutureError(`Unexpected character '${ch}'`, line, column, 'lex');
  }
}

// --- character helpers --------------------------------------------------------

function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

function isIdentStart(ch) {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentPart(ch) {
  return isIdentStart(ch) || isDigit(ch);
}

/** Translate a backslash escape into its character. Unknown escapes pass through. */
function unescape(ch) {
  switch (ch) {
    case 'n':  return '\n';
    case 't':  return '\t';
    case 'r':  return '\r';
    case '0':  return '\0';
    case '\\': return '\\';
    case '"':  return '"';
    case "'":  return "'";
    case '{':  return '\x01'; // placeholder — generator converts back to literal {
    default:   return ch ?? '';
  }
}

/**
 * Convenience wrapper used by the rest of the pipeline and the tests.
 * @param {string} source
 * @returns {Token[]}
 */
export function tokenize(source) {
  return new Lexer(source).tokenize();
}
