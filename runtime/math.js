// runtime/math.js — Math module for the Future language.
// All functions mirror JavaScript's Math object so Future programs can do
// numeric work without importing anything explicitly.

export const round  = (x)       => Math.round(Number(x));
export const floor  = (x)       => Math.floor(Number(x));
export const ceil   = (x)       => Math.ceil(Number(x));
export const abs    = (x)       => Math.abs(Number(x));
export const sqrt   = (x)       => Math.sqrt(Number(x));
export const pow    = (x, y)    => Math.pow(Number(x), Number(y));
export const log    = (x)       => Math.log(Number(x));
export const random = ()        => Math.random();
export const min    = (...args) => Math.min(...args.map(Number));
export const max    = (...args) => Math.max(...args.map(Number));
export const pi     = Math.PI;
export const e      = Math.E;
