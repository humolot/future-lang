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

/**
 * Assert that a function (sync or async) throws an error.
 * Optionally verify the error message contains expectedMessage.
 *
 * @param {Function} fn  The function to call
 * @param {string} [expectedMessage]  Substring the error message must contain
 *
 * @example
 *   assert.throws(function() end)           # any error
 *   assert.throws(function() end, "divide") # error message must include "divide"
 */
export async function throws(fn, expectedMessage) {
  let threw = false;
  let caughtErr;
  try {
    const result = fn();
    if (result && typeof result.then === 'function') await result;
  } catch (err) {
    threw = true;
    caughtErr = err;
  }

  if (!threw) {
    const msg = expectedMessage
      ? `Expected to throw "${expectedMessage}" but did not throw`
      : 'Expected function to throw but it did not throw';
    throw Object.assign(new Error(msg), { name: 'AssertionError', namespace: 'assert' });
  }

  if (expectedMessage && !String(caughtErr?.message ?? '').includes(String(expectedMessage))) {
    throw Object.assign(
      new Error(`Expected error "${caughtErr.message}" to include "${expectedMessage}"`),
      { name: 'AssertionError', namespace: 'assert' },
    );
  }
}
