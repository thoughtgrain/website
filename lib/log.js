'use strict';

/**
 * log.js — the progress reporter.
 *
 * The old build printed one line per file written and then a summary whose page
 * count was hand-computed arithmetic (it claimed "46 pages" while writing 64
 * files). Worse, when the process died partway there was nothing in the output
 * to say how far it got.
 *
 * This module fixes both: counts come from the writer that actually wrote the
 * files, and every group reports as it finishes, so a killed run still leaves a
 * readable trail of exactly where it stopped.
 *
 * Two verbosity levels:
 *   default    one line per group, plus a summary
 *   --verbose  every path, indented under its group
 *   --quiet    warnings and errors only
 */

// Module-level because verbosity is a property of the process, not of any one
// caller, and threading it through every function signature would be noise.
let verbose = false;
let quiet = false;

/** Called once at startup from the command modules. */
function configure(opts) {
  verbose = Boolean(opts && opts.verbose);
  quiet = Boolean(opts && opts.quiet);
}

function isVerbose() { return verbose; }

/**
 * Pad a group name to a fixed width so the counts line up in a column. Eleven
 * characters clears the longest group id ("flat-pages") with a space to spare.
 */
function pad(s, width) {
  s = String(s);
  return s.length >= width ? s : s + ' '.repeat(width - s.length);
}

/** `[scope] message` — the base line shape everything else builds on. */
function line(scope, message) {
  if (quiet) return;
  console.log('[' + scope + '] ' + message);
}

/** A blank separator line, used between the scan and render phases. */
function blank() {
  if (quiet) return;
  console.log('');
}

/**
 * One group's result: `[render] writing      18 files      84ms`
 *
 * @param {string} scope   Phase name, "scan" or "render".
 * @param {string} group   Group id.
 * @param {number} count   Files this group touched.
 * @param {number} ms      Wall-clock duration.
 * @param {string} [note]  Optional trailing note, e.g. "skipped (resumed)".
 */
function group(scope, group_, count, ms, note) {
  if (quiet) return;
  const unit = count === 1 ? 'file' : 'files';
  let out = '[' + scope + '] ' + pad(group_, 11) + pad(count + ' ' + unit, 12) + ms + 'ms';
  if (note) out += '  ' + note;
  console.log(out);
}

/**
 * An individual path, printed only under --verbose. Indented so it reads as
 * belonging to the group line above it.
 */
function item(scope, relPath) {
  if (!verbose || quiet) return;
  console.log('[' + scope + ']   ' + relPath);
}

/**
 * The closing summary. `written` and `unchanged` are broken out because the
 * write-then-prune writer skips files whose bytes already match — knowing that
 * 46 of 64 files were untouched is how you tell a no-op rebuild from a real one.
 */
function summary(scope, stats) {
  if (quiet) return;
  const total = stats.written + stats.unchanged;
  const unit = total === 1 ? 'file' : 'files';
  console.log(
    '[' + scope + '] ' + pad('done', 11) +
    pad(total + ' ' + unit, 12) +
    stats.ms + 'ms' +
    '  (' + stats.written + ' written, ' + stats.unchanged + ' unchanged' +
    (stats.pruned ? ', ' + stats.pruned + ' pruned' : '') + ')'
  );
}

// Warnings and errors ignore --quiet: if something went wrong, you need to see
// it regardless of how little output you asked for.
function warn(scope, message) {
  console.warn('[' + scope + '] ' + message);
}

function error(scope, message) {
  console.error('[' + scope + '] ' + message);
}

module.exports = { configure, isVerbose, line, blank, group, item, summary, warn, error };
