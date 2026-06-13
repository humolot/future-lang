// test/parser.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/lexer.js';
import { parse } from '../src/parser.js';

const ast = (src) => parse(tokenize(src));

test('parses an assignment', () => {
  const program = ast('name = "John"');
  assert.equal(program.body[0].type, 'Assignment');
  assert.equal(program.body[0].name, 'name');
  assert.equal(program.body[0].value.type, 'StringLiteral');
});

test('parses multiple statements on one line', () => {
  const program = ast('a = 1 b = 2');
  assert.equal(program.body.length, 2);
  assert.equal(program.body[1].name, 'b');
});

test('parses an if statement with a comparison condition', () => {
  const node = ast('if age >= 18 print "Adult" end').body[0];
  assert.equal(node.type, 'IfStatement');
  assert.equal(node.condition.operator, '>=');
  assert.equal(node.consequent[0].type, 'PrintStatement');
  assert.equal(node.alternate, null);
});

test('parses a function declaration with parameters', () => {
  const fn = ast('function greet(name) print name end').body[0];
  assert.equal(fn.type, 'FunctionDeclaration');
  assert.deepEqual(fn.params, ['name']);
});

test('parses a user function call (callee is an Identifier node)', () => {
  const call = ast('greet("John")').body[0].expression;
  assert.equal(call.type, 'CallExpression');
  assert.equal(call.callee.type, 'Identifier');
  assert.equal(call.callee.name, 'greet');
  assert.equal(call.arguments[0].value, 'John');
});

test('parses a capability call (callee is a MemberExpression)', () => {
  const call = ast('data = http.get("https://x")').body[0].value;
  assert.equal(call.type, 'CallExpression');
  assert.equal(call.callee.type, 'MemberExpression');
  assert.equal(call.callee.object.name, 'http');
  assert.equal(call.callee.property, 'get');
});

test('parses chained property access (todo.title)', () => {
  const expr = ast('print todo.title').body[0].expression;
  assert.equal(expr.type, 'MemberExpression');
  assert.equal(expr.object.name, 'todo');
  assert.equal(expr.property, 'title');
});

test('respects arithmetic precedence (* binds tighter than +)', () => {
  const expr = ast('x = 1 + 2 * 3').body[0].value;
  assert.equal(expr.operator, '+');
  assert.equal(expr.right.operator, '*');
});

test('reports a missing end with a FutureError', () => {
  assert.throws(() => ast('if x print "y"'), (err) => {
    assert.equal(err.name, 'FutureError');
    assert.equal(err.phase, 'parse');
    return true;
  });
});
