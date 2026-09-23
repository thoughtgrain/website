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
const { STATUS_PATH } = require('./config');
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
 * @param {object} [freshness] From `freshness()` — whether dist/ still matches
 *   the sources, and which sections moved if not.
 * @returns {string} Text, newline-terminated.
 */
function render(state, freshness) {
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

  // The line this whole command exists for: is what I'm looking at current?
  //
  // "Which groups finished" and "is dist up to date" are different questions,
  // and only the second one matters when you've just edited a file and can't
  // see your change. A complete build goes stale the moment you touch a source.
  if (freshness) {
    if (freshness.stale) {
      lines.push('  dist     STALE — sources changed since that build' +
        (freshness.changed.length ? ': ' + freshness.changed.join(', ') : ''));
      lines.push('  next     node build.js step' +
        (freshness.nextGroup ? '   (renders ' + freshness.nextGroup + ' first)' : ''));
    } else if (state.complete) {
      lines.push('  dist     current');
    }
  }

  if (!freshness && state.complete) {
    lines.push('  complete — dist/ matches the sources');
  }

  if (!state.complete && split.done.length) {
    // The actionable bit: what to type next. On a phone that matters more than
    // it sounds, because retyping a long command is the real friction.
    lines.push('  resume   node build.js resume');
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Is dist/ still current, and if not, what moved?
 *
 * Compares the checkpoint's stored manifest fingerprint against a fresh scan of
 * the sources. Costs one directory walk and no parsing, so it's cheap enough to
 * run on every `status`.
 *
 * @param {object|null} state
 * @returns {object|null} { stale, changed, nextGroup } or null when there's no
 *   build to compare against.
 */
function freshness(state) {
  if (!state) return null;

  const manifest = require('./manifest');
  const stored = manifest.load();
  const fresh = manifest.scan();

  if (manifest.fingerprint(fresh) === state.manifestId) {
    return { stale: false, changed: [], nextGroup: null };
  }

  // `stored` can be missing if .cache/ was cleared by hand — then we know it's
  // stale but not what moved, which is still the more important half.
  const changed = stored ? manifest.changedKinds(stored, fresh) : [];
  const affected = registry.affectedBy(changed);

  // Same specificity rule render uses, so status predicts what `next` will do.
  const ranked = affected.slice().sort(function (a, b) {
    return (registry.byId(a).inputs || []).length - (registry.byId(b).inputs || []).length;
  });

  return {
    stale: true,
    changed: changed,
    nextGroup: affected.length === registry.ids().length ? affected[0] : ranked[0],
  };
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
function save(state, freshnessInfo) {
  const text = render(state, freshnessInfo);
  try {
    // Repo root, so no directory to create — and so a file browser that hides
    // dot-folders still shows it. See the note in lib/config.js.
    fs.writeFileSync(STATUS_PATH, text);
  } catch (err) {
    /* status is best-effort */
  }
  return text;
}

module.exports = { render, save, partition, freshness };
