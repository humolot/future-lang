// test/capabilities.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../src/index.js';

test('simple programs stay synchronous (no runtime import, no async)', () => {
  const js = compile('print "Hello World"');
  assert.equal(js.trim(), 'console.log("Hello World");');
  assert.doesNotMatch(js, /import/);
  assert.doesNotMatch(js, /await/);
});

test('a capability call switches the module into async mode', () => {
  const js = compile('data = http.get("https://x")', { runtimeSpecifier: 'future-lang/runtime' });
  assert.match(js, /^import \{ runtime as __rt \} from "future-lang\/runtime";/m);
  assert.match(js, /data = await __rt\.http\.get\("https:\/\/x"\);/);
});

test('all functions become async and calls are awaited in async mode', () => {
  const js = compile('function g(x) print x end\ng(ai.ask("hi"))');
  assert.match(js, /async function g\(x\)/);
  assert.match(js, /await g\(await __rt\.ai\.ask\("hi"\)\)/);
});

test('property access on returned data compiles to plain member access', () => {
  const js = compile('t = http.get("u")\nprint t.title');
  assert.match(js, /console\.log\(t\.title\);/);
});

test('namespace routing works for every declared capability', () => {
  for (const ns of ['ai', 'http', 'mqtt', 'tts', 'rag', 'vision', 'home']) {
    const js = compile(`${ns}.run("x")`);
    assert.match(js, new RegExp(`await __rt\\.${ns}\\.run\\("x"\\)`));
  }
});
