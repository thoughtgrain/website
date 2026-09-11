'use strict';

/**
 * log.js — the progress reporter.
 *
 * ## Why this doesn't use console.log
 *
 * Running the build in Code App on iOS, I get **no terminal output at all** —
 * not a truncated tail, nothing. Which reframes the failure this whole refactor
 * started from: the build didn't just look silent, I was never seeing its stdout
 * in the first place. The only way I could tell it had done anything was to look
 * at `dist/` in the file browser.
 *
 * Two things make that worse than it needs to be:
 *
 * 1. Node only guarantees SYNCHRONOUS writes to stdout for a TTY, and for pipes
 *    on Linux. Everywhere else — including a sandboxed on-device runtime — a
 *    pipe write is asynchronous and buffered, and a process that ends before the
 *    buffer drains loses whatever was still queued.
 * 2. `process.exit()` discards that buffer outright. So a FAILING build could
 *    emit literally nothing, which is exactly when you need the message most.
 *    (Both call sites now set `process.exitCode` instead.)
 *
 * So every line goes out through `fs.writeSync`, which is unbuffered and lands
 * before the next statement runs.
 *
 * ## And why it also writes to a file
 *
 * If the host simply doesn't wire stdout to its terminal pane, no amount of
 * flushing helps. So every line is ALSO appended to `.cache/build.log`, and
 * `lib/status.js` keeps `.cache/status.txt` current. Those I can open in an
 * editor pane. The terminal is the nice path, not the only one.
 *
 * ## Verbosity
 *
 *   default    one line per group, plus a summary
 *   --verbose  every path, indented under its group
 *   --quiet    warnings and errors only (still written to the log file)
 */

const fs = require('fs');
const path = require('path');
const { BUILD_LOG_PATH } = require('./config');
const args = require('./args');

// Module-level because verbosity is a property of the process, not of any one
// caller, and threading it through every function signature would be noise.
let verbose = false;
let quiet = false;

// Lines buffered for the run log before openRun() has been called, so nothing
// logged during startup is lost.
let pending = [];
let runOpen = false;

// A non-blocking pipe can reject a synchronous write with EAGAIN. Retrying a
// bounded number of times clears the transient case without risking a spin.
const EAGAIN_RETRIES = 50;

/** Called once at startup from the command modules. */
function configure(opts) {
  verbose = Boolean(opts && opts.verbose);
  quiet = Boolean(opts && opts.quiet);
}

function isVerbose() { return verbose; }

/**
 * Write one line to a file descriptor, synchronously.
 *
 * @param {number} fd 1 for stdout, 2 for stderr.
 * @param {string} text Without a trailing newline.
 */
function writeFd(fd, text) {
  const buf = Buffer.from(text + '\n', 'utf8');
  for (let attempt = 0; attempt <= EAGAIN_RETRIES; attempt++) {
    try {
      fs.writeSync(fd, buf);
      return;
    } catch (err) {
      // EAGAIN means the pipe is momentarily full — worth retrying.
      if (err.code === 'EAGAIN') continue;
      // Anything else (a closed or redirected fd) must not take the build down.
      // Fall back to console and give up on this line.
      try { (fd === 2 ? console.error : console.log)(text); } catch (e) { /* nothing left to try */ }
      return;
    }
  }
}

/**
 * Append one line to the run log.
 *
 * Failures here are swallowed on purpose: a read-only or full filesystem should
 * degrade the logging, never fail the build.
 */
function writeLog(text) {
  if (!runOpen) {
    pending.push(text);
    return;
  }
  try {
    fs.appendFileSync(BUILD_LOG_PATH, text + '\n');
  } catch (err) {
    /* logging is best-effort */
  }
}

/** The single path every message takes: to the terminal, and to the log file. */
function emit(fd, text) {
  writeFd(fd, text);
  writeLog(text);
}

/**
 * Start a run log. Truncates `.cache/build.log` and stamps a header, so the file
 * always describes the most recent run rather than growing without bound.
 *
 * @param {string} name What's running, e.g. "build" or "render --group notes".
 */
function openRun(name, argv) {
  if (runOpen) return;
  try {
    // The log lives at the repo root, which always exists — no mkdir needed.
    const header = [
      '# ' + name + '  ' + new Date().toISOString(),
      '# node ' + process.version + ' on ' + process.platform,
    ];

    // Record argv VERBATIM, and name any non-ASCII character by codepoint.
    //
    // This is the line that would have saved an evening: typing `--group` on an
    // iOS keyboard produces an EM DASH, the flag was silently dropped, and
    // nothing anywhere said so. Now the log shows exactly what the shell handed
    // over — `—group (— U+2014 dash)` — whatever mangled it.
    if (argv && argv.length) {
      header.push('# argv: ' + argv.map(function (a) { return JSON.stringify(a); }).join(' '));
      argv.forEach(function (a) {
        const odd = args.describeNonAscii(a);
        if (odd) header.push('#   non-ascii in ' + JSON.stringify(a) + ': ' + odd);
      });
    }

    fs.writeFileSync(BUILD_LOG_PATH, header.join('\n') + '\n');
    runOpen = true;
  } catch (err) {
    // No writable .cache/ — carry on with terminal output only.
    return;
  }
  // Flush anything logged before the run opened.
  const queued = pending;
  pending = [];
  queued.forEach(writeLog);
}

/** Note where the log lives. Called at the end of a run that produced output. */
function closeRun(rootDir) {
  if (!runOpen) return;
  writeLog('# finished ' + new Date().toISOString());
  if (verbose) {
    writeFd(1, '[log] full output in ' + path.relative(rootDir || process.cwd(), BUILD_LOG_PATH));
  }
}

/**
 * Pad a name to a fixed width so the counts line up in a column. Eleven
 * characters clears the longest group id with a space to spare.
 */
function pad(s, width) {
  s = String(s);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** `[scope] message` — the base line shape everything else builds on. */
function line(scope, message) {
  if (quiet) { writeLog('[' + scope + '] ' + message); return; }
  emit(1, '[' + scope + '] ' + message);
}

/**
 * A line with no `[scope]` prefix. For block text — usage, the status report —
 * where a prefix on every line is noise rather than structure.
 */
function raw(text) {
  if (quiet) { writeLog(text); return; }
  emit(1, text);
}

/** A blank separator line, used between the scan and render phases. */
function blank() {
  if (quiet) return;
  emit(1, '');
}

/**
 * One group's result: `[render] writing     18 files    84ms`
 *
 * @param {string} scope   Phase name, "scan" or "render".
 * @param {string} group_  Group id.
 * @param {number} count   Files this group touched.
 * @param {number} ms      Wall-clock duration.
 * @param {string} [note]  Optional trailing note, e.g. "skipped (already done)".
 */
function group(scope, group_, count, ms, note) {
  const unit = count === 1 ? 'file' : 'files';
  let out = '[' + scope + '] ' + pad(group_, 11) + pad(count + ' ' + unit, 12) + ms + 'ms';
  if (note) out += '  ' + note;
  if (quiet) { writeLog(out); return; }
  emit(1, out);
}

/**
 * An individual path, printed only under --verbose. Indented so it reads as
 * belonging to the group line above it.
 */
function item(scope, relPath) {
  const out = '[' + scope + ']   ' + relPath;
  if (!verbose || quiet) { writeLog(out); return; }
  emit(1, out);
}

/**
 * The closing summary — and the LAST line of a run, which is why what's still
 * pending is appended here rather than printed above.
 *
 * A terminal that shows only the tail (or a phone screen you have to scroll)
 * makes the final line the only one you can count on seeing, so it carries
 * everything you need to decide what to run next.
 *
 * `written` and `unchanged` are broken out because the write-then-prune writer
 * skips files whose bytes already match — knowing that 60 of 64 files were
 * untouched is how you tell a no-op rebuild from a real one.
 *
 * @param {string} scope
 * @param {object} stats written, unchanged, pruned, ms.
 * @param {string[]} [left] Group ids not yet rendered.
 */
function summary(scope, stats, left) {
  const total = stats.written + stats.unchanged;
  const unit = total === 1 ? 'file' : 'files';
  let out =
    '[' + scope + '] ' + pad('done', 11) +
    pad(total + ' ' + unit, 12) +
    stats.ms + 'ms' +
    '  (' + stats.written + ' written, ' + stats.unchanged + ' unchanged' +
    (stats.pruned ? ', ' + stats.pruned + ' pruned' : '') + ')';

  if (left && left.length) {
    out += '  — ' + left.length + ' left: ' + left.join(', ');
  }

  if (quiet) { writeLog(out); return; }
  emit(1, out);
}

// Warnings and errors ignore --quiet: if something went wrong, you need to see
// it regardless of how little output you asked for. Both go to stderr, so they
// survive a caller that redirects stdout somewhere else.
function warn(scope, message) {
  emit(2, '[' + scope + '] ' + message);
}

function error(scope, message) {
  emit(2, '[' + scope + '] ' + message);
}

module.exports = {
  configure, isVerbose, openRun, closeRun,
  line, raw, blank, group, item, summary, warn, error,
};
