// runtime/mqtt.js — MQTT publish/subscribe.
// Uses the `mqtt` npm package + MQTT_URL when available. With no broker it falls
// back to an in-process loopback so publish/subscribe still work for demos/tests.

import process from 'node:process';

let client = null;                 // real client, or false for offline mode
const localSubs = new Map();       // topic -> handler[]  (offline fallback)

async function getClient() {
  if (client !== null) return client;
  const url = process.env.MQTT_URL;
  if (!url) { client = false; return client; }
  try {
    const mod = await import('mqtt');
    const c = mod.default.connect(url);
    await new Promise((res, rej) => { c.once('connect', res); c.once('error', rej); });
    client = c;
  } catch (e) {
    console.warn(`[mqtt] broker/package unavailable (${e.message}); using local loopback.`);
    client = false;
  }
  return client;
}

/** Publish a message to a topic. @returns {Promise<string>} the payload sent. */
export async function publish(topic, message) {
  const c = await getClient();
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  if (c) {
    await new Promise((res) => c.publish(topic, payload, res));
  } else {
    for (const h of localSubs.get(topic) || []) h(payload, topic);
  }
  return payload;
}

/** Subscribe to a topic. `handler(message, topic)` runs on each message. */
export async function subscribe(topic, handler) {
  const c = await getClient();
  if (c) {
    c.subscribe(topic);
    c.on('message', (t, buf) => { if (t === topic) handler(buf.toString(), t); });
  } else {
    if (!localSubs.has(topic)) localSubs.set(topic, []);
    localSubs.get(topic).push(handler);
  }
  return topic;
}
