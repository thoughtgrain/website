'use strict';

/**
 * status.js — a human-readable snapshot of how far the build has got.
 *
 * The checkpoint in `.cache/state.json` already knows exactly this, but it's
 * JSON with a 64-entry `written` array in the middle of it — not something to
 * read on a phone. This renders the same information as four lines of text and
 * keeps it at `.cache/status.txt`.
 *
 * It exists because the terminal isn't reliable. In Code App I get no stdout at
 * all, so "what's left" has to be answerable by opening a file rather than by
 * reading output I may never see. `lib/commands/render.js` rewrites it after
 * every group, which means it stays accurate even for a run that got killed
 * partway — that's the case it's really for.
 */

const fs = require('fs');
const { CACHE, STATUS_PATH } = require('./config');
const registry = require('./pages');

/** `2026-09-10 20:41` — local time, no timezone noise, sortable enough to scan. */
function stamp(date) {
  const pad2 = function (n) { return String(n).padStart(2, '0'); };
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate()) +
    ' ' + pad2(date.getHours()) + ':' + pad2(date.getMinutes());
}

/**
 * Split the registry's groups into done and pending, in registry order.
 *
 * Order comes from the registry rather than from the checkpoint's key order so
 * the lists always read in pipeline order, whatever sequence they were run in.
 *
 * @param {object|null} state A checkpoint from lib/state.js.
 * @returns {{done: string[], pending: string[]}}
 */
function partition(state) {
  const groups = (state && state.groups) || {};
  const done = [];
  const pending = [];
  registry.ids().forEach(function (id) {
    if (groups[id] === 'done') done.push(id);
    else pending.push(id);
  });
  return { done: done, pending: pending };
}

/**
 * Render the status block.
 *
 * @param {object|null} state
 * @returns {string} Text, newline-terminated.
 */
function render(state) {
  const now = stamp(new Date());

  if (!state) {
    return [
      'build status — ' + now,
      '  no build on record. Run: node build.js',
      '',
    ].join('\n');
  }

  const split = partition(state);
  const total = registry.ids().length;
  const fileCount = (state.written || []).length;

  const lines = ['build status — ' + now];

  lines.push('  done     ' + (split.done.length ? split.done.join(', ') : '(none)'));
  lines.push('  pending  ' + (split.pending.length ? split.pending.join(', ') : '(none)'));
  lines.push('  ' + split.done.length + ' of ' + total + ' groups, ' +
    fileCount + ' file' + (fileCount === 1 ? '' : 's') + ' written');

  if (state.complete) {
    lines.push('  complete — dist/ matches the sources');
  } else if (split.done.length) {
    // The actionable bit: what to type next. On a phone that matters more than
    // it sounds, because retyping a long command is the real friction.
    lines.push('  resume with: node build.js render --resume');
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Write the snapshot to `.cache/status.txt`.
 *
 * Best-effort, like the run log: a read-only filesystem should cost you the
 * status file, never the build.
 *
 * @param {object|null} state
 * @returns {string} The rendered text, so callers can print it too.
 */
function save(state) {
  const text = render(state);
  try {
    if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(STATUS_PATH, text);
  } catch (err) {
    /* status is best-effort */
  }
  return text;
}

module.exports = { render, save, partition };
