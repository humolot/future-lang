// runtime/assert.js — Test assertions for `future test`.
// Wraps node:assert/strict with Future-friendly error messages.

import nodeAssert from 'node:assert/strict';

function wrap(fn, name) {
  return (...args) => {
    try {
      fn(...args);
    } catch (err) {
      // Re-throw with the assert namespace tag so the test runner can identify it.
      const e = new Error(err.message);
      e.name = 'AssertionError';
      e.namespace = 'assert';
      e.operator = err.operator ?? name;
      e.actual = err.actual;
      e.expected = err.expected;
      throw e;
    }
  };
}

export const ok        = wrap((val, msg)        => nodeAssert.ok(val, msg),                       'ok');
export const equal     = wrap((a, b, msg)        => nodeAssert.equal(a, b, msg),                   'equal');
export const notEqual  = wrap((a, b, msg)        => nodeAssert.notEqual(a, b, msg),                'notEqual');
export const deepEqual = wrap((a, b, msg)        => nodeAssert.deepEqual(a, b, msg),               'deepEqual');
export const fail      = (msg = 'assertion failed') => { throw Object.assign(new Error(msg), { name: 'AssertionError', namespace: 'assert' }); };
