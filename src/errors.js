// errors.js
// A single custom error type used across every phase of the Future compiler.
// Carrying `line`/`column` lets the CLI render helpful, source-aware diagnostics
// instead of opaque stack traces.

export class FutureError extends Error {
  /**
   * @param {string} message          Human-readable description of the problem.
   * @param {number | null} [line]     1-based line number where the error occurred.
   * @param {number | null} [column]   1-based column number where the error occurred.
   * @param {string} [phase]           Which compiler phase produced the error
   *                                   ('lex' | 'parse' | 'codegen' | 'compile').
   */
  constructor(message, line = null, column = null, phase = 'compile') {
    super(message);
    this.name = 'FutureError';
    this.line = line;
    this.column = column;
    this.phase = phase;
  }
}
