/**
 * Build this site the way CodePen builds it, locally.
 *
 * Four rounds of this project's bugs were invisible here and fatal there, and
 * each one cost an upload, a build, and a report read back by hand. They were
 * invisible because a plain `npm run build` is not what the host runs. The
 * host differs in two ways that matter, and both are reproducible:
 *
 *   1. It compiles the JSX out before Vite starts, with the CLASSIC runtime,
 *      so what Vite receives is `.js` full of `React.createElement(...)` and
 *      no React import anywhere.
 *
 *   2. It drives Vite through the legacy build path, so `builder.buildApp` is
 *      never called and the prerender pass has to reach itself another way.
 *
 * This does both, against a copy, and prints the build report. If it says the
 * pages were prerendered, the host should agree. If it doesn't, the failure is
 * here, where you can put a breakpoint in it.
 *
 *   node scripts/simulate-host.mjs
 *
 * Babel is installed into the throwaway copy rather than declared as a
 * devDependency, deliberately: package.json is a file the host reads and
 * installs from, and this is a local test tool it should never see.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/** Exactly what gets uploaded: no dist, no node_modules, no generated HTML. */
const UPLOADED = ['vite.config.js', 'package.json', 'node-loader.js', '.codepen', 'src'];

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });

const work = mkdtempSync(path.join(tmpdir(), 'simulate-host-'));
console.log(`[sim] staging in ${work}`);

for (const entry of UPLOADED) {
  cpSync(path.join(ROOT, entry), path.join(work, entry), { recursive: true });
}

console.log('[sim] installing the toolchain');
run('npm', ['install', '--no-audit', '--no-fund', '--silent'], work);

// One install, not two. `setup` installs the toolchain with --no-save, and a
// second `npm install` afterwards prunes anything not in package.json, which
// quietly removes Vite again. So take the package list out of the setup
// script and add Babel to it.
const setup = JSON.parse(readFileSync(path.join(work, 'package.json'), 'utf8')).scripts.setup;
const toolchain = setup.split(/\s+/).filter((w) => /@\d/.test(w));
run('npm', ['install', '--no-audit', '--no-fund', '--silent',
  '--no-save', '--no-package-lock',
  ...toolchain, '@babel/core@7', '@babel/preset-react@7'], work);

console.log('[sim] compiling the JSX out, classic runtime');
const { transformFileSync } = await import(path.join(work, 'node_modules', '@babel', 'core', 'lib', 'index.js'));

let compiled = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!entry.name.endsWith('.jsx')) continue;
    const { code } = transformFileSync(file, {
      presets: [[path.join(work, 'node_modules', '@babel', 'preset-react'), { runtime: 'classic' }]],
      configFile: false,
      babelrc: false,
    });
    writeFileSync(file.replace(/\.jsx$/, '.js'), code);
    unlinkSync(file);
    compiled += 1;
  }
};
walk(path.join(work, 'src'));
console.log(`[sim] ${compiled} files compiled; React.createElement with no import, as on the host`);

console.log('[sim] building through the legacy path, with no buildApp');
const { build } = await import(path.join(work, 'node_modules', 'vite', 'dist', 'node', 'index.js'));
const factory = (await import(`${path.join(work, 'vite.config.js')}`)).default;
const config = await factory({ command: 'build', mode: 'production' });

// Removing these is the whole point: without them Vite cannot take the
// Environment API path, which is the situation the fallback exists for.
delete config.builder;
delete config.environments;

// The host's packages block scans for npm imports and writes an esm.sh
// importmap into the top of every page. It finds `yaml` in node-loader.js,
// which is build-time Node code the browser never runs. Reproduced here so
// the pruning that removes it again is actually exercised.
config.plugins = [...(config.plugins || []), {
  name: 'simulate-host-importmap',
  transformIndexHtml(html) {
    return html.replace('<head>', `<head>\n<script type="importmap">
{
  "imports": {
    "yaml": "https://esm.sh/yaml@^2.9.1",
    "yaml/": "https://esm.sh/yaml@^2.9.1/"
  }
}
</script>\n`);
  },
}];

await build({ ...config, configFile: false, logLevel: 'warn' });

const report = path.join(work, 'dist', 'build-report.txt');
console.log(`\n${readFileSync(report, 'utf8')}`);

const prerendered = readFileSync(report, 'utf8').includes('#root is FILLED');

// The injected importmap is for a package only the build uses, so no page
// should still be carrying it.
const page = readFileSync(path.join(work, 'dist', 'index.html'), 'utf8');
const stillMapped = page.includes('importmap');
console.log(`[sim] importmap left in the output: ${stillMapped ? 'YES' : 'no'}`);

rmSync(work, { recursive: true, force: true });

if (!prerendered) {
  console.error('[sim] FAILED: the host would not prerender this build');
  process.exit(1);
}
if (stillMapped) {
  console.error('[sim] FAILED: an unused importmap survived into the output');
  process.exit(1);
}
console.log('[sim] passed');
