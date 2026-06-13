// test/e2e.test.js
// Compile a Future program, execute the generated JavaScript in a sandbox and
// assert on what it prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { compile } from '../src/index.js';

/** Run a Future program and return the lines it printed. */
function run(src) {
  const out = [];
  const context = createContext({
    console: { log: (...args) => out.push(args.map(String).join(' ')) },
  });
  runInContext(compile(src), context);
  return out;
}

test('runs a full program with functions, if/else and calls', () => {
  const program = `
    function greet(label)
      print label
    end

    age = 20
    if age >= 18
      greet("Adult")
    else
      greet("Minor")
    end
  `;
  assert.deepEqual(run(program), ['Adult']);
});

test('returns values from functions', () => {
  const program = `
    function add(a, b)
      return a + b
    end
    print add(2, 3)
  `;
  assert.deepEqual(run(program), ['5']);
});

test('concatenates strings with +', () => {
  assert.deepEqual(run('print "Hello, " + "World"'), ['Hello, World']);
});
