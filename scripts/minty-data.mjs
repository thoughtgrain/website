/**
 * Measure Minty and build its pages' data and audio.
 *
 *   node scripts/minty-data.mjs <endless-repo> <out-dir>
 *
 * Minty is a compressor patch for the Polyend Endless, in the endless repo.
 * Its pages draw curves, filter responses, envelopes and play audio, and every
 * one of those comes from Minty's own code, run here:
 *
 *   1. Minty's test bench (`make host-test`, and again for the guitar
 *      profile). Its printed tables are kept, and its audio renders of the
 *      synth test phrase become the listening examples.
 *   2. scripts/minty/measure.cpp, compiled against Minty's headers for both
 *      profiles. It measures the static curves across both knobs, the EQ
 *      response, the characters and the swell, with the bench's own method.
 *   3. A check that the measured curves agree with the bench's table. If they
 *      drift by more than a tenth of a dB, this stops, because then the pages
 *      would be drawing something other than Minty.
 *
 * Writes src/minty/data.json (what the pages draw) and, into <out-dir>, the
 * renders as AAC for the asset host named in src/content/minty.json.
 *
 * Needs g++ (C++20), make and ffmpeg. The ARM toolchain is not needed.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const [REPO, OUT] = process.argv.slice(2).map((p) => p && path.resolve(p));
if (!REPO || !OUT) {
  console.error('usage: node scripts/minty-data.mjs <endless-repo> <out-dir>');
  process.exit(2);
}
const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'src', 'minty', 'data.json');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...opts });

const work = mkdtempSync(path.join(tmpdir(), 'minty-'));
const patch = path.join(work, 'minty');
cpSync(path.join(REPO, 'minty'), patch, { recursive: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(path.dirname(DATA), { recursive: true });

// ------------------------------------------------------------ the test bench
console.log('[minty] running the test bench, guitar profile');
const benchGuitar = run('make', ['host-test-guitar'], { cwd: patch });
console.log('[minty] running the test bench, synth profile (and its renders)');
run('rm', ['-rf', path.join(patch, 'build', 'host')]);
const benchSynth = run('make', ['host-test'], { cwd: patch });
for (const [name, out] of [['synth', benchSynth], ['guitar', benchGuitar]]) {
  if (!/PASSED \(0 failures\)/.test(out)) throw new Error(`the ${name} test bench did not pass`);
}

/** The bench's static-curve table: dyn -> output RMS at -54..-6 dBFS in 6 dB steps. */
function benchCurves(out) {
  return [...out.matchAll(/^\s+(\d\.\d\d) \|((?:\s+-?\d+\.\d+)+)/gm)]
    .map((m) => ({ dyn: Number(m[1]), vals: m[2].trim().split(/\s+/).map(Number).slice(0, 9) }));
}

/** The bench's bass THD table: rows of hz -> percent at DYNAMICS 0.25, 0.50, 0.70. */
function benchThd(out) {
  const head = out.match(/Bass THD[^\n]*\n\s+dyn:((?:\s+\d\.\d\d)+)/);
  const dyns = head ? head[1].trim().split(/\s+/).map(Number) : [];
  const rows = [...out.matchAll(/^\s+(\d+) Hz((?:\s+\d+\.\d+)+)/gm)]
    .map((m) => ({ hz: Number(m[1]), pct: m[2].trim().split(/\s+/).map(Number) }));
  return { dyns, rows };
}

/** The bench's step-response ripple lines. */
function benchSteps(out) {
  return [...out.matchAll(/^\s+([\w.]+ \/ \w+)\s+GR ([\d.]+) \.\. ([\d.]+) dB \(ripple ([\d.]+) dB\)/gm)]
    .map((m) => ({ case: m[1], min: Number(m[2]), max: Number(m[3]), ripple: Number(m[4]) }));
}

// ------------------------------------------------------------ measurements
const measured = {};
for (const profile of ['synth', 'guitar']) {
  const bin = path.join(work, `measure-${profile}`);
  console.log(`[minty] measuring, ${profile} profile`);
  run('g++', ['-std=c++20', '-O2', '-Wall', '-Wextra', '-Werror', '-Wdouble-promotion',
    ...(profile === 'guitar' ? ['-DMINTY_PROFILE_GUITAR'] : []),
    '-I', path.join(patch, 'source'), path.join(ROOT, 'scripts', 'minty', 'measure.cpp'), '-o', bin]);
  measured[profile] = JSON.parse(run(bin, []));
}

// The pages are only worth drawing if they agree with the bench.
for (const [profile, out] of [['synth', benchSynth], ['guitar', benchGuitar]]) {
  const c = measured[profile].curves;
  const si = c.sens.indexOf(0.5);
  let worst = 0;
  let n = 0;
  for (const row of benchCurves(out)) {
    const di = c.dyn.findIndex((x) => Math.abs(x - row.dyn) < 1e-6);
    if (di < 0) continue;
    row.vals.forEach((v, j) => {
      const li = c.levels.indexOf(-54 + 6 * j);
      worst = Math.max(worst, Math.abs(c.out[si][di][li] - v));
      n += 1;
    });
  }
  console.log(`[minty] ${profile}: ${n} curve points agree with the bench to ${worst.toFixed(2)} dB`);
  if (!n || worst > 0.1) throw new Error(`${profile} curves disagree with the bench by ${worst.toFixed(2)} dB`);
}

// ------------------------------------------------------------ renders
/** The settings each render was made with, read from the bench source rather than restated. */
const benchSource = readFileSync(path.join(patch, 'test', 'host_render.cpp'), 'utf8');
const CHARACTERS = { kStable: 'Stable', kWobble: 'Wobble', kTwitchy: 'Twitchy', kDusty: 'Dusty' };
const settings = [...benchSource.matchAll(/\{ "build\/host\/(\d\d_[a-z_]+)\.wav", ([\d.]+)f, ([\d.]+)f, ([\d.]+)f, Character::(\w+), (true|false) \}/g)]
  .map((m) => ({
    id: m[1], sens: Number(m[2]), dyn: Number(m[3]), eq: Number(m[4]), character: CHARACTERS[m[5]] || m[5], swell: m[6] === 'true',
  }));
if (settings.length !== 8) throw new Error(`expected 8 render settings in host_render.cpp, found ${settings.length}`);

const LABELS = {
  '01_gentle': 'Gentle', '02_squash_noon': 'Squash, at noon', '03_sag': 'Sag', '04_wobble': 'Wobble',
  '05_twitchy': 'Twitchy', '06_dusty': 'Dusty', '07_swell': 'Swell', '08_dark_shifty_eq': 'Dark, shifting EQ',
};

/** 16-bit stereo PCM WAV as written by the bench: left channel, as floats. */
function readWav(file) {
  const b = readFileSync(file);
  const dataAt = b.indexOf('data') + 8;
  const frames = (b.length - dataAt) / 4;
  const l = new Float32Array(frames);
  for (let i = 0; i < frames; i++) l[i] = b.readInt16LE(dataAt + i * 4) / 32768;
  return l;
}

/** Peak per 20 ms, for drawing the waveform's outline. */
function envelope(x, hop = 960) {
  const out = [];
  for (let i = 0; i < x.length; i += hop) {
    let p = 0;
    for (let k = i; k < i + hop && k < x.length; k++) p = Math.max(p, Math.abs(x[k]));
    out.push(Math.round(p * 1000) / 1000);
  }
  return out;
}

const rmsDb = (x) => {
  let acc = 0;
  for (const v of x) acc += v * v;
  return Math.round(10 * Math.log10(acc / x.length + 1e-20) * 10) / 10;
};

const renders = [];
for (const s of [{ id: '00_dry' }, ...settings]) {
  const wav = path.join(patch, 'build', 'host', `${s.id}.wav`);
  const file = `minty-${s.id.replace(/^\d\d_/, '').replace(/_/g, '-')}.m4a`;
  run('ffmpeg', ['-loglevel', 'error', '-y', '-i', wav, '-c:a', 'aac', '-b:a', '128k', '-movflags', 'faststart', path.join(OUT, file)]);
  const x = readWav(wav);
  renders.push({
    ...s,
    label: s.id === '00_dry' ? 'Dry' : LABELS[s.id] || s.id,
    file,
    seconds: Math.round((x.length / 48000) * 100) / 100,
    rmsDb: rmsDb(x),
    envelope: envelope(x),
  });
  console.log(`[minty] ${file} ${Math.round(statSync(path.join(OUT, file)).size / 1024)} KB`);
}

const speed = Number((benchSynth.match(/Host speed[^:]*: (\d+)x/) || [])[1]) || null;

const data = {
  version: 1,
  measuredWith: 'scripts/minty/measure.cpp and Minty’s own test bench',
  profiles: {
    synth: { ...measured.synth, eq: undefined },
    guitar: { ...measured.guitar, eq: undefined },
  },
  // The EQ does not depend on the profile; the synth build's measurement is the one kept.
  eq: measured.synth.eq,
  thd: { synth: benchThd(benchSynth), guitar: benchThd(benchGuitar) },
  steps: { synth: benchSteps(benchSynth), guitar: benchSteps(benchGuitar) },
  renders,
  benchSpeed: speed,
};

// Rounding the bulk keeps the file small without losing anything a chart can
// show: three decimals below 1 (envelopes, the 5 ms hop), two above (dB).
const round = (k, v) => {
  if (typeof v !== 'number' || Number.isInteger(v)) return v;
  return Math.abs(v) < 1 ? Math.round(v * 1000) / 1000 : Math.round(v * 100) / 100;
};
writeFileSync(DATA, `${JSON.stringify(data, round)}\n`);
rmSync(work, { recursive: true, force: true });
console.log(`[minty] wrote ${path.relative(ROOT, DATA)} (${Math.round(statSync(DATA).size / 1024)} KB) and ${renders.length} renders into ${OUT}`);
