// test/runtime.test.js — exercises the offline behaviour of the runtime modules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runtime } from '../runtime/index.js';

test('ai.ask returns an offline stub when no API key is set', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const out = await runtime.ai.ask('ping');
  assert.match(out, /\[ai offline\]/);
});

test('mqtt loopback delivers a published message to a local subscriber', async () => {
  delete process.env.MQTT_URL;
  let received = null;
  await runtime.mqtt.subscribe('t/test', (msg) => { received = msg; });
  await runtime.mqtt.publish('t/test', 'hello');
  assert.equal(received, 'hello');
});

test('rag.index then rag.query finds the indexed text', async () => {
  await runtime.rag.index('MQTT is a lightweight pub/sub protocol');
  const out = await runtime.rag.query('MQTT');
  assert.match(out, /MQTT is a lightweight/);
});

test('extension points expose a stable interface', () => {
  assert.equal(typeof runtime.vision.describe, 'function');
  assert.equal(typeof runtime.home.turnOn, 'function');
});
