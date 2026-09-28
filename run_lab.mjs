// Local Node runner for the lab (`RUNNER.md` documents the browser-harness path).
//
// Every lab experiment is plain ESM that reads its inputs through `globalThis.__fs`
// and imports only relative paths (verified: the `e73` graph is 36 files, zero
// `node:`/`https:` specifiers), so a normal Node process can run one directly —
// no esbuild-wasm, no Blob-URL bundling, no network. This script wires `__fs` to
// `node:fs` and calls the experiment's `run()`.
//
//   node src/NeuLegion-lab/run_lab.mjs e73_port_verify.js
//   node src/NeuLegion-lab/run_lab.mjs run_all.js          # regenerates results/*; ~10-25 min
//
// Paths inside the lab are workspace-relative (`src/NeuLegion-lab/...`,
// `src/NeuLegion-master/NeuLegion-master/...`), so `__fs` resolves them against the
// directory that contains `src/` — computed from THIS file's location, so the runner
// works from any CWD and any checkout layout. `run_all.js` rewrites `results/*.json`;
// `e73_port_verify.js` is read-only (it writes nothing).
//
// Exit status is non-zero when a verdict fails (`validationPass === false`), a check
// count reports failures (`failed > 0`), or a `run_all` step is red (`pass === false`)
// — so it is usable as a gate command. `--json` prints the full result; `--out <file>`
// writes it as pretty JSON.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));      // <root>/src/NeuLegion-lab
const ROOT = path.resolve(HERE, '..', '..');                    // the directory that contains `src/`
const resolvePath = (p) => (path.isAbsolute(String(p)) ? String(p) : path.resolve(ROOT, String(p)));

globalThis.__fs = {
    readTextFile: (p) => readFile(resolvePath(p), 'utf8'),
    readFile: (p) => readFile(resolvePath(p)),
    writeTextFile: async (p, c) => {
        const target = resolvePath(p);
        await mkdir(path.dirname(target), { recursive: true });
        return writeFile(target, c);
    },
};

const argv = process.argv.slice(2);
const opts = { out: null, json: false };
const positional = [];
for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') { opts.out = argv[++i] || null; continue; }
    if (a === '--json') { opts.json = true; continue; }
    if (!a.startsWith('--')) positional.push(a);
}
if (argv.includes('--out') && !opts.out) {
    console.error('run_lab: --out needs a file path');
    process.exit(2);
}
const name = path.basename(positional[0] || 'e73_port_verify.js');

const mod = await import(pathToFileURL(path.join(HERE, 'experiments', name)).href);
if (typeof mod.run !== 'function') {
    console.error(`run_lab: ${name} does not export run()`);
    process.exit(2);
}

const result = await mod.run({});
if (opts.out) {
    const target = resolvePath(opts.out);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(result, null, 2));
}

const reds = Object.entries(result || {})
    .filter(([, v]) => v && typeof v === 'object' && v.pass === false)
    .map(([k]) => k);
const verdictFailed = !!(result && result.verdict && result.verdict.validationPass === false);
const checksFailed = !!(result && typeof result.failed === 'number' && result.failed > 0);

if (result && result.verdict) {
    const checks = result.verdict.checks || {};
    const passed = Object.values(checks).filter(Boolean).length;
    console.log(`${name}: ${passed}/${Object.keys(checks).length} checks, validationPass=${result.verdict.validationPass}`);
} else if (result && typeof result.total === 'number') {
    console.log(`${name}: ${result.total - (result.failed || 0)}/${result.total} checks, failed=${result.failed || 0}`);
} else {
    console.log(`${name}: ${Object.keys(result || {}).length} result keys`);
}
if (reds.length) console.error(`red steps: ${reds.join(', ')}`);
if (opts.out) console.log(`wrote ${opts.out}`);
if (opts.json) console.log(JSON.stringify(result, null, 2));
process.exitCode = verdictFailed || checksFailed || reds.length ? 1 : 0;
