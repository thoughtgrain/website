'use strict';

/**
 * commands/doctor.js — `node build.js doctor`.
 *
 * A diagnostic that writes itself down.
 *
 * The problem it exists for: on my phone the build produces no terminal output
 * at all, so every question about what's going wrong is unanswerable — I can't
 * see the answer even when the program prints it. This writes everything worth
 * knowing to `build-doctor.txt` at the repo root, where a file browser will show
 * it, and prints the same thing in case the terminal does work.
 *
 * What it checks, and why each one earns its place:
 *
 *   argv verbatim      iOS autocorrect turns `--` into an em dash, which silently
 *                      dropped every flag I typed. Seeing the raw bytes settles
 *                      that class of problem instantly.
 *   isTTY              distinguishes "no terminal attached" from "terminal
 *                      attached but not displaying".
 *   write tests        a sandbox that blocks writes explains a build that
 *                      appears to do nothing.
 *   git HEAD           confirms the device is on the branch I think it is, and
 *                      not running an older build.js.
 *
 * It touches nothing but its own output file.
 */

const fs = require('fs');
const path = require('path');
const argsLib = require('../args');
const log = require('../log');
const { ROOT, SRC, DIST, CACHE, DOCTOR_PATH } = require('../config');

/** `yes` / `no`, so the report scans without parsing booleans. */
function yesNo(value) {
  return value ? 'yes' : 'no';
}

/**
 * Can we create, read back and delete a file in `dir`?
 *
 * Writability is the difference between "the build did nothing" and "the build
 * did everything and couldn't save it", which look identical from outside.
 */
function writeTest(dir) {
  const probe = path.join(dir, '.write-probe-' + process.pid);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, 'probe');
    const readBack = fs.readFileSync(probe, 'utf8');
    fs.unlinkSync(probe);
    return readBack === 'probe' ? 'writable' : 'wrote, but read back wrong';
  } catch (err) {
    return 'FAILED — ' + err.code + ' ' + err.message;
  }
}

/** The current branch and commit, read straight from .git without shelling out. */
function gitHead() {
  try {
    const head = fs.readFileSync(path.join(ROOT, '.git', 'HEAD'), 'utf8').trim();
    const ref = head.match(/^ref: (.+)$/);
    if (!ref) return head; // detached HEAD, already a sha

    const branch = ref[1].replace(/^refs\/heads\//, '');
    try {
      const sha = fs.readFileSync(path.join(ROOT, '.git', ref[1]), 'utf8').trim();
      return branch + ' @ ' + sha.slice(0, 8);
    } catch (err) {
      // Packed refs: the loose file doesn't exist. The branch name is still the
      // useful half of the answer.
      return branch + ' (commit unread — packed refs)';
    }
  } catch (err) {
    return 'unknown (' + err.code + ')';
  }
}

/** Build the report as an array of lines. */
function report(argv) {
  const lines = [];

  lines.push('build doctor — ' + new Date().toISOString());
  lines.push('');

  lines.push('runtime');
  lines.push('  node        ' + process.version);
  lines.push('  platform    ' + process.platform + ' ' + process.arch);
  lines.push('  pid         ' + process.pid);
  lines.push('');

  lines.push('output');
  // If stdout is not a TTY, writes may be buffered on some runtimes — which is
  // why lib/log.js uses fs.writeSync rather than console.log.
  lines.push('  stdout tty  ' + yesNo(process.stdout.isTTY));
  lines.push('  stderr tty  ' + yesNo(process.stderr.isTTY));
  lines.push('  log file    ' + path.relative(ROOT, require('../config').BUILD_LOG_PATH));
  lines.push('  status file ' + path.relative(ROOT, require('../config').STATUS_PATH));
  lines.push('');

  lines.push('arguments as received');
  const raw = process.argv.slice(2);
  lines.push('  raw         ' + (raw.length
    ? raw.map(function (a) { return JSON.stringify(a); }).join(' ')
    : '(none)'));
  lines.push('  parsed      ' + JSON.stringify(argv));
  let sawOdd = false;
  raw.forEach(function (a) {
    const odd = argsLib.describeNonAscii(a);
    if (odd) {
      sawOdd = true;
      lines.push('  non-ascii   ' + JSON.stringify(a) + ' → ' + odd);
      lines.push('              normalises to ' + JSON.stringify(argsLib.normaliseToken(a)));
    }
  });
  if (!sawOdd && raw.length) lines.push('  non-ascii   none — all plain ASCII');
  lines.push('');

  lines.push('paths');
  lines.push('  cwd         ' + process.cwd());
  lines.push('  repo root   ' + ROOT);
  lines.push('  src/        ' + (fs.existsSync(SRC) ? 'found' : 'MISSING'));
  lines.push('  dist/       ' + (fs.existsSync(DIST)
    ? 'found, ' + countFiles(DIST) + ' files'
    : 'not built yet'));
  lines.push('');

  lines.push('write access');
  lines.push('  repo root   ' + writeTest(ROOT));
  lines.push('  .cache/     ' + writeTest(CACHE));
  lines.push('');

  lines.push('git');
  lines.push('  head        ' + gitHead());
  lines.push('');

  lines.push('if the terminal showed nothing, this file is the record.');
  lines.push('');

  return lines;
}

/** Count files under a directory, for the dist/ line. */
function countFiles(dir) {
  let total = 0;
  const walk = function (d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (entry) {
      if (entry.isDirectory()) walk(path.join(d, entry.name));
      else total++;
    });
  };
  try { walk(dir); } catch (err) { return '?'; }
  return total;
}

/**
 * @param {object} args Parsed CLI flags.
 * @returns {object} { path } where the report was written.
 */
function run(args) {
  const lines = report(args);

  lines.forEach(function (l) { log.raw(l); });

  try {
    fs.writeFileSync(DOCTOR_PATH, lines.join('\n'));
    log.raw('written to ' + path.relative(ROOT, DOCTOR_PATH));
  } catch (err) {
    // If even this can't be written, say so loudly — it's the strongest signal
    // available about what's wrong.
    log.error('doctor', 'could not write ' + DOCTOR_PATH + ': ' + err.message);
  }

  return { path: DOCTOR_PATH };
}

module.exports = { run, report };
