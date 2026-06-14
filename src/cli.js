#!/usr/bin/env node
// cli.js — The `future` command.
//
//   future run <file.future>       Compile then execute
//   future compile <file.future>   Compile to <file>.js next to the source
//   future new <name>              Create a new project scaffold
//   future check <file.future>     Syntax-check without running
//   future fmt <file.future>       Format source code in-place
//   future playground              Launch the interactive playground
//   future doctor                  Check your environment
//   future help | --help
//   future version | --version

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import process from 'node:process';

import { compile, tokenize, parse } from './index.js';
import { format } from './formatter.js';
import { FutureError } from './errors.js';
import { buildSourceMap } from './sourcemap.js';

const VERSION = '0.4.3';
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_INDEX = join(PROJECT_ROOT, 'runtime', 'index.js');

const USAGE = `Future ${VERSION} — a tiny language that compiles to JavaScript.

Usage:
  future run <file.future>          Compile and run a program
  future compile <file.future>      Compile to JavaScript (<file>.js)
  future test [pattern]             Run *.test.future files
  future ast <file.future>          Print the AST as JSON
  future new <name>                 Create a new project
  future check <file.future>        Check for syntax errors
  future fmt <file.future>          Format source code in-place
  future playground                 Launch the interactive playground
  future doctor                     Check your environment
  future help                       Show this help
  future --version                  Show the version

Import system:
  use "./utils.future"              Import all functions from a file
  use "./math.future" as math       Import as a namespace (math.add, math.pi …)
  use "lodash" as _                 Import an npm package as a namespace

Flags:
  future run --debug <file>         Show timing for every namespace call
  future compile --sourcemap <file> Also emit a .js.map source map
  future ast --pretty <file>        Indented JSON output
`;

async function main(argv) {
  const debug     = argv.includes('--debug');
  const sourcemap = argv.includes('--sourcemap');
  const pretty    = argv.includes('--pretty');
  if (debug) process.env.FUTURE_DEBUG = '1';
  const rest = argv.filter((a) => a !== '--debug' && a !== '--sourcemap' && a !== '--pretty');
  const [command, arg] = rest;
  switch (command) {
    case 'run':        return cmdRun(arg);
    case 'compile':    return cmdCompile(arg, { sourcemap });
    case 'test':       return cmdTest(arg);
    case 'ast':        return cmdAst(arg, { pretty });
    case 'new':        return cmdNew(arg);
    case 'check':      return cmdCheck(arg);
    case 'fmt':        return cmdFmt(arg);
    case 'playground': return cmdPlayground();
    case 'doctor':     return cmdDoctor();
    case 'version': case '--version': case '-v':
      console.log(`future ${VERSION}`); return 0;
    case undefined: case 'help': case '--help': case '-h':
      console.log(USAGE); return 0;
    default:
      process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`); return 1;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readSource(file) {
  if (!file) throw new FutureError('No input file provided');
  if (extname(file) !== '.future') {
    process.stderr.write(`warning: '${file}' does not have a .future extension\n`);
  }
  const path = resolve(file);
  return { path, source: readFileSync(path, 'utf8') };
}

/** Relative `./...` specifier from outDir to the runtime (for compile). */
function relativeRuntimeSpecifier(outDir) {
  let rel = relative(outDir, RUNTIME_INDEX).split('\\').join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel;
}

function compileOrReport(source, file, options) {
  try {
    return compile(source, options);
  } catch (err) {
    if (err instanceof FutureError) { reportFutureError(err, source, file); return null; }
    throw err;
  }
}

function fail(err, file) {
  if (err instanceof FutureError) {
    process.stderr.write(`error[${err.phase}]: ${err.message}\n`); return 1;
  }
  if (err?.code === 'ENOENT') {
    process.stderr.write(`error: cannot open file '${file}'\n`); return 1;
  }
  throw err;
}

function reportFutureError(err, source, file) {
  const where = err.line != null ? `${file}:${err.line}:${err.column}` : file;
  process.stderr.write(`error[${err.phase}]: ${err.message}\n`);
  process.stderr.write(`  --> ${where}\n`);
  if (err.line != null) {
    const srcLine = source.split('\n')[err.line - 1] ?? '';
    const gutter  = String(err.line);
    process.stderr.write(`   ${gutter} | ${srcLine}\n`);
    const pad = ' '.repeat(gutter.length) + '   ' + ' '.repeat((err.column ?? 1) - 1);
    process.stderr.write(`   ${pad}^\n`);
  }
}

/**
 * Find all `use "./..."` paths in a source string by parsing the AST.
 * Returns an array of { path, alias } objects.
 */
function findUseStatements(source) {
  try {
    const tokens = tokenize(source);
    const ast    = parse(tokens);
    return ast.body
      .filter((s) => s.type === 'UseStatement')
      .map((s) => ({ path: s.path, alias: s.alias }));
  } catch {
    return [];
  }
}

/**
 * Recursively compile all .future dependencies to temp .mjs files.
 * Returns a pathMap: Map<originalRelPath, fileURL string>.
 */
function compileDepsToTemp(sourcePath, sourceText, tempDir, pathMap = new Map()) {
  const uses = findUseStatements(sourceText);
  for (const { path: relPath } of uses) {
    if (pathMap.has(relPath)) continue; // already compiled
    if (!relPath.startsWith('./') && !relPath.startsWith('../')) continue; // npm module
    const depAbsPath = resolve(dirname(sourcePath), relPath);
    if (!existsSync(depAbsPath)) continue;
    const depSource = readFileSync(depAbsPath, 'utf8');

    // Compile dep as a module.
    const depJs = compileDepModule(depSource, depAbsPath, tempDir, pathMap);
    if (depJs === null) return null; // propagate error

    const depName = basename(relPath, extname(relPath));
    const tmpPath  = join(tempDir, `future-dep-${process.pid}-${depName}-${Date.now()}.mjs`);
    writeFileSync(tmpPath, depJs, 'utf8');
    pathMap.set(relPath, pathToFileURL(tmpPath).href);

    // Recurse into the dep's own imports.
    const sub = compileDepsToTemp(depAbsPath, depSource, tempDir, pathMap);
    if (sub === null) return null;
  }
  return pathMap;
}

function compileDepModule(source, sourcePath, tempDir, pathMap) {
  const uses = findUseStatements(source);
  // Ensure transitive deps are compiled first so pathMap is populated.
  for (const { path: relPath } of uses) {
    if (pathMap.has(relPath)) continue;
    if (!relPath.startsWith('./') && !relPath.startsWith('../')) continue; // npm module
    const depAbsPath = resolve(dirname(sourcePath), relPath);
    if (!existsSync(depAbsPath)) continue;
    const depSrc = readFileSync(depAbsPath, 'utf8');
    const sub = compileDepModule(depSrc, depAbsPath, tempDir, pathMap);
    if (sub === null) return null;
    const depName = basename(relPath, extname(relPath));
    const tmpPath = join(tempDir, `future-dep-${process.pid}-${depName}-${Date.now()}.mjs`);
    writeFileSync(tmpPath, sub, 'utf8');
    pathMap.set(relPath, pathToFileURL(tmpPath).href);
  }

  return compile(source, {
    runtimeSpecifier: pathToFileURL(RUNTIME_INDEX).href,
    isModule: true,
    pathMap,
    resolveSource: (relPath) => {
      const abs = resolve(dirname(sourcePath), relPath);
      return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    },
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdCompile(file, { sourcemap = false } = {}) {
  let path, source;
  try { ({ path, source } = readSource(file)); }
  catch (err) { return fail(err, file); }

  const outDir = dirname(path);

  // Compile each imported .future dep as a module next to its source.
  const uses = findUseStatements(source);
  for (const { path: relPath } of uses) {
    if (!relPath.startsWith('./') && !relPath.startsWith('../')) continue; // npm module
    const depAbsPath = resolve(outDir, relPath);
    if (!existsSync(depAbsPath)) {
      process.stderr.write(`warning: imported file not found: ${relPath}\n`);
      continue;
    }
    const depSource = readFileSync(depAbsPath, 'utf8');
    const depOutDir = dirname(depAbsPath);
    const depJs = compileOrReport(depSource, relPath, {
      runtimeSpecifier: relativeRuntimeSpecifier(depOutDir),
      isModule: true,
      resolveSource: (p) => {
        const abs = resolve(depOutDir, p);
        return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
      },
    });
    if (depJs === null) return 1;
    const depOut = join(depOutDir, `${basename(depAbsPath, extname(depAbsPath))}.js`);
    writeFileSync(depOut, depJs, 'utf8');
    console.log(`Compiled ${relPath} -> ${depOut}`);
  }

  const rawJs = compileOrReport(source, file, {
    runtimeSpecifier: relativeRuntimeSpecifier(outDir),
    sourceMaps: sourcemap,
    resolveSource: (relPath) => {
      const abs = resolve(outDir, relPath);
      return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    },
  });
  if (rawJs === null) return 1;

  const outBase = join(outDir, basename(path, extname(path)));
  const outPath = `${outBase}.js`;

  if (sourcemap) {
    const mapFile = `${outBase}.js.map`;
    const { code, map } = buildSourceMap(rawJs, basename(file), source);
    writeFileSync(outPath, `${code}//# sourceMappingURL=${basename(mapFile)}\n`, 'utf8');
    writeFileSync(mapFile, JSON.stringify(map), 'utf8');
    console.log(`Compiled ${file} -> ${outPath}`);
    console.log(`Source map   -> ${mapFile}`);
  } else {
    writeFileSync(outPath, rawJs, 'utf8');
    console.log(`Compiled ${file} -> ${outPath}`);
  }
  return 0;
}

async function cmdRun(file) {
  let path, source;
  try { ({ path, source } = readSource(file)); }
  catch (err) { return fail(err, file); }

  // Compile dependencies to temp .mjs files.
  const tempDir = tmpdir();
  const pathMap = compileDepsToTemp(path, source, tempDir);
  if (pathMap === null) return 1; // error already reported

  const js = compileOrReport(source, file, {
    runtimeSpecifier: pathToFileURL(RUNTIME_INDEX).href,
    pathMap,
    resolveSource: (relPath) => {
      const abs = resolve(dirname(path), relPath);
      return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    },
  });
  if (js === null) return 1;

  const tmp = join(tempDir, `future-${process.pid}-${Date.now()}.mjs`);
  writeFileSync(tmp, js, 'utf8');
  const depTmps = [...pathMap.values()].map((u) => fileURLToPath(u));
  try {
    await import(pathToFileURL(tmp).href);
    return 0;
  } catch (err) {
    process.stderr.write(`runtime error: ${err.message}\n`);
    return 1;
  } finally {
    try { unlinkSync(tmp); } catch { /* ignore */ }
    for (const p of depTmps) { try { unlinkSync(p); } catch { /* ignore */ } }
  }
}

/** Syntax-check only — no output generated. */
function cmdCheck(file) {
  let path, source;
  try { ({ path, source } = readSource(file)); }
  catch (err) { return fail(err, file); }

  try {
    const tokens = tokenize(source);
    parse(tokens);
    console.log(`✓ ${file} — no errors`);
    return 0;
  } catch (err) {
    if (err instanceof FutureError) {
      reportFutureError(err, source, file);
      return 1;
    }
    throw err;
  }
}

/** Format a .future file in-place. */
function cmdFmt(file) {
  let path, source;
  try { ({ path, source } = readSource(file)); }
  catch (err) { return fail(err, file); }

  // Validate first.
  try {
    parse(tokenize(source));
  } catch (err) {
    if (err instanceof FutureError) {
      reportFutureError(err, source, file);
      process.stderr.write(`fmt: file has errors — not formatted\n`);
      return 1;
    }
    throw err;
  }

  const formatted = format(source);
  if (formatted === source) {
    console.log(`${file} — already formatted`);
  } else {
    writeFileSync(path, formatted, 'utf8');
    console.log(`${file} — formatted`);
  }
  return 0;
}

/** Output the AST of a .future file as JSON. */
function cmdAst(file, { pretty = false } = {}) {
  let path, source;
  try { ({ path, source } = readSource(file)); }
  catch (err) { return fail(err, file); }

  try {
    const tokens = tokenize(source);
    const ast    = parse(tokens);
    process.stdout.write((pretty ? JSON.stringify(ast, null, 2) : JSON.stringify(ast)) + '\n');
    return 0;
  } catch (err) {
    if (err instanceof FutureError) { reportFutureError(err, source, file); return 1; }
    throw err;
  }
}

/** Recursively collect .future files matching a pattern or default test globs. */
function findTestFiles(pattern) {
  const cwd = process.cwd();
  const files = [];

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const entry of entries) {
      if (entry === 'node_modules') continue;
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) { walk(full); continue; }
      if (!entry.endsWith('.future')) continue;
      const rel = relative(cwd, full).split('\\').join('/');
      if (pattern) {
        if (rel.includes(pattern) || entry.includes(pattern)) files.push(full);
      } else {
        if (entry.endsWith('.test.future') || rel.startsWith('test/')) files.push(full);
      }
    }
  }

  walk(cwd);
  return files;
}

/** Run *.test.future files and report results. */
async function cmdTest(pattern) {
  const testFiles = findTestFiles(pattern);
  if (testFiles.length === 0) {
    process.stderr.write('No test files found.\n');
    process.stderr.write('  Naming: *.test.future or test/**/*.future\n');
    return 1;
  }

  const tempDir = tmpdir();
  let passed = 0;
  let failed = 0;

  for (const testFile of testFiles) {
    const rel = relative(process.cwd(), testFile).split('\\').join('/');
    let source;
    try { source = readFileSync(testFile, 'utf8'); } catch (err) { process.stderr.write(`error reading ${rel}: ${err.message}\n`); failed++; continue; }

    // Compile dependencies.
    const pathMap = compileDepsToTemp(testFile, source, tempDir);
    if (pathMap === null) { failed++; continue; }

    const js = compileOrReport(source, rel, {
      runtimeSpecifier: pathToFileURL(RUNTIME_INDEX).href,
      pathMap,
      resolveSource: (p) => {
        const abs = resolve(dirname(testFile), p);
        return existsSync(abs) ? readFileSync(abs, 'utf8') : null;
      },
    });
    if (js === null) { failed++; continue; }

    const tmp = join(tempDir, `future-test-${process.pid}-${Date.now()}.mjs`);
    writeFileSync(tmp, js, 'utf8');
    const depTmps = [...pathMap.values()].map((u) => fileURLToPath(u));
    try {
      await import(pathToFileURL(tmp).href);
      console.log(`  ✓ ${rel}`);
      passed++;
    } catch (err) {
      const isAssert = err.name === 'AssertionError' || err.namespace === 'assert';
      process.stderr.write(`  ✗ ${rel}\n`);
      process.stderr.write(`    ${isAssert ? 'AssertionError' : err.name ?? 'Error'}: ${err.message}\n`);
      failed++;
    } finally {
      try { unlinkSync(tmp); } catch { /* ignore */ }
      for (const p of depTmps) { try { unlinkSync(p); } catch { /* ignore */ } }
    }
  }

  const total = passed + failed;
  console.log(`\n${passed}/${total} tests passed${failed > 0 ? `, ${failed} failed` : ''}`);
  return failed > 0 ? 1 : 0;
}

/** Create a new project scaffold. */
function cmdNew(name) {
  if (!name) {
    process.stderr.write('Usage: future new <project-name>\n');
    return 1;
  }
  const dir = resolve(name);
  if (existsSync(dir)) {
    process.stderr.write(`error: directory '${name}' already exists\n`);
    return 1;
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.future'), `# ${name}\n\nprint "Hello from ${name}!"\n`, 'utf8');
  console.log(`Created project '${name}'/`);
  console.log(`  ${name}/main.future`);
  console.log(`\nRun it with: future run ${name}/main.future`);
  return 0;
}

/** Launch the interactive playground. */
async function cmdPlayground() {
  const serverPath = join(PROJECT_ROOT, 'server.js');
  if (!existsSync(serverPath)) {
    process.stderr.write('error: playground server not found (server.js missing)\n');
    return 1;
  }
  console.log('Starting Future Playground…');
  await import(pathToFileURL(serverPath).href);
  return 0;
}

/** Environment health check. */
async function cmdDoctor() {
  const check = (ok, label) =>
    console.log(`${ok ? '✓' : '✗'} ${label}`);

  console.log(`\nDoctor:`);
  console.log(`Future ${VERSION}\n`);

  // Node.js version.
  const [major] = process.versions.node.split('.').map(Number);
  check(major >= 22, `Node.js ${process.versions.node}`);

  // Runtime loadable.
  let runtimeOk = false;
  try { await import(pathToFileURL(RUNTIME_INDEX).href); runtimeOk = true; } catch { /* */ }
  check(runtimeOk, 'Runtime OK');

  // AI provider configured.
  const aiOk = !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY ||
                  process.env.OPENAI_BASE_URL);
  check(aiOk, 'AI Provider Configured');

  // MQTT optional dep.
  let mqttOk = false;
  try { await import('mqtt'); mqttOk = true; } catch { /* */ }
  check(mqttOk, 'MQTT Available');

  // Browser build.
  const browserBuild = join(PROJECT_ROOT, 'future-browser.js');
  check(existsSync(browserBuild), 'Browser Build Available');

  // Examples installed.
  const examplesDir = join(PROJECT_ROOT, 'examples');
  check(existsSync(examplesDir), 'Examples Installed');

  console.log('');
  return 0;
}

process.exit(await main(process.argv.slice(2)));
