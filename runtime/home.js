// runtime/home.js — Home Automation (extension point).
// Demonstrates composition: it drives devices over MQTT. Re-target to Home
// Assistant, Hue, Matter, etc. by changing only this file.

import * as mqtt from './mqtt.js';

async function setState(device, value) {
  await mqtt.publish(`home/${device}/set`, String(value));
  return `${device} -> ${value}`;
}

/** Turn a device on. @returns {Promise<string>} */
export async function turnOn(device) { return setState(device, 'on'); }

/** Turn a device off. @returns {Promise<string>} */
export async function turnOff(device) { return setState(device, 'off'); }

/** Set a device to an arbitrary value. @returns {Promise<string>} */
export async function set(device, value) { return setState(device, value); }
