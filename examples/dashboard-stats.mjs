// System stats helper — called by dashboard.future via system.exec
// Output: single-line JSON to stdout
import os from 'node:os';

const total = os.totalmem();
const free  = os.freemem();
const used  = total - free;
const cpus  = os.cpus();

process.stdout.write(JSON.stringify({
  mem_total_mb: Math.round(total / 1024 / 1024),
  mem_used_mb:  Math.round(used  / 1024 / 1024),
  mem_free_mb:  Math.round(free  / 1024 / 1024),
  mem_pct:      Math.round(used / total * 100),
  cpu_count:    cpus.length,
  cpu_model:    (cpus[0]?.model ?? 'Unknown').trim(),
  platform:     os.platform(),
  arch:         os.arch(),
  hostname:     os.hostname(),
  uptime_min:   Math.round(os.uptime() / 60),
  node_version: process.version,
}));
