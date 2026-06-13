// test/lexer.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/lexer.js';

test('tokenizes a print statement', () => {
  const tokens = tokenize('print "Hello"');
  assert.equal(tokens[0].type, 'PRINT');
  assert.equal(tokens[1].type, 'STRING');
  assert.equal(tokens[1].value, 'Hello');
  assert.equal(tokens[2].type, 'EOF');
});

test('tracks line numbers across newlines', () => {
  const tokens = tokenize('a = 1\nb = 2');
  const b = tokens.find((t) => t.type === 'IDENTIFIER' && t.value === 'b');
  assert.equal(b.line, 2);
});

test('lexes numbers including decimals', () => {
  const [n] = tokenize('3.14');
  assert.equal(n.type, 'NUMBER');
  assert.equal(n.value, 3.14);
});

test('recognises two-character operators', () => {
  const types = tokenize('>= <= == !=').map((t) => t.type);
  assert.deepEqual(types.slice(0, 4), ['GTE', 'LTE', 'EQ', 'NEQ']);
});

test('handles escape sequences in strings', () => {
  const [s] = tokenize('"line1\\nline2"');
  assert.equal(s.value, 'line1\nline2');
});

test('ignores comments and whitespace', () => {
  const tokens = tokenize('# a comment\nprint 1');
  assert.equal(tokens[0].type, 'PRINT');
  assert.equal(tokens[1].value, 1);
});

test('throws FutureError with line info on unterminated string', () => {
  assert.throws(() => tokenize('print "oops'), (err) => {
    assert.equal(err.name, 'FutureError');
    assert.equal(err.line, 1);
    return true;
  });
});
