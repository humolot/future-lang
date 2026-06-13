// test/generator.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/index.js';

test('compiles hello world to a single console.log', () => {
  assert.equal(compile('print "Hello World"').trim(), 'console.log("Hello World");');
});

test('hoists variable declarations into one let', () => {
  const js = compile('name = "John"\nage = 30');
  assert.match(js, /let name, age;/);
  assert.match(js, /name = "John";/);
  assert.match(js, /age = 30;/);
});

test('maps == to === inside an if', () => {
  const js = compile('if age == 18 print "x" end');
  assert.match(js, /if \(\(age === 18\)\) \{/);
});

test('compiles functions, returns and calls', () => {
  const js = compile('function add(a, b) return a + b end\nprint add(2, 3)');
  assert.match(js, /function add\(a, b\) \{/);
  assert.match(js, /return \(a \+ b\);/);
  assert.match(js, /console\.log\(add\(2, 3\)\);/);
});

test('maps and / or / not to JS operators', () => {
  const js = compile('if a and not b print "x" end');
  assert.match(js, /&&/);
  assert.match(js, /!b/);
});
