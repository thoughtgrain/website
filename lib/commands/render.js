'use strict';

/**
 * commands/render.js — `node build.js render`.
 *
 * The "iterate" half. Reads the manifest, derives the context once, then walks
 * the group registry writing pages — checkpointing after every group.
 *
 * ## The three things that make this survivable on a phone
 *
 * 1. **Nothing is deleted up front.** The old build's first act was to `rmSync`
 *    dist/. Here, pages are written over the existing site and stale files are
 *    pruned only after a COMPLETE run. An interrupted render leaves a working,
 *    partially-updated site.
 *
 * 2. **Every group checkpoints.** `.cache/state.json` records which groups are
 *    done and every path written. `--resume` picks up from there.
 *
 * 3. **A group can run alone.** `--group <id>` renders one group and exits, so
 *    the work can be driven in chunks small enough that iOS won't kill any of
 *    them. Pruning is skipped in that mode for the obvious reason: one group's
 *    written-set is not the whole site.
 */

const manifest = require('../manifest');
const state = require('../state');
const status = require('../status');
const registry = require('../pages');
const log = require('../log');
const { createContext } = require('../context');
const { createWriter } = require('../fsx');
const scanCommand = require('./scan');

/**
 * Get a manifest that matches what's on disk right now.
 *
 * A missing manifest triggers a scan. A stale one triggers a re-scan with a
 * warning naming the first few changes, because rendering a stale manifest
 * silently produces a site that doesn't match the sources — the exact class of
 * quiet wrongness this refactor is trying to eliminate.
 */
function currentManifest(args) {
  const existing = manifest.load();
  if (!existing) {
    log.line('render', 'no manifest found, scanning first');
    return scanCommand.run(args);
  }

  const problems = manifest.staleness(existing);
  if (problems.length) {
    log.warn('render', 'manifest is stale (' + problems.length + ' change' +
      (problems.length === 1 ? '' : 's') + ': ' + problems.slice(0, 3).join('; ') +
      (problems.length > 3 ? '; …' : '') + '), re-scanning');
    return scanCommand.run(args);
  }

  return existing;
}

/**
 * @param {object} args Parsed CLI flags.
 * @returns {Promise<object>} Run stats.
 */
async function run(args) {
  args = args || {};
  const started = Date.now();

  const found = currentManifest(args);
  const manifestId = manifest.fingerprint(found);

  // --list prints the plan and exits. Useful on a phone for deciding which
  // groups to run in which order without committing to any work.
  if (args.list) {
    registry.GROUPS.forEach(function (g) {
      log.line('render', g.id + ' — ' + g.label);
    });
    return { listed: true };
  }

  // Which groups this invocation covers.
  const selected = args.group ? [registry.byId(args.group)] : registry.GROUPS;
  const singleGroup = Boolean(args.group);

  // --- checkpoint ---------------------------------------------------------
  // An existing checkpoint is carried forward in two cases:
  //
  //   --resume   you're explicitly continuing an interrupted run
  //   --group    a single-group run is BY DEFINITION part of a larger build, so
  //              starting a fresh checkpoint each time would throw away the
  //              groups already rendered — and that's the phone workflow:
  //              `scan` once, then one group per invocation.
  //
  // Either way it's only trusted when it was built against these same inputs.
  let checkpoint = null;
  if (args.resume || args.group) {
    checkpoint = state.loadResumable(manifestId);
    if (!checkpoint && args.resume) {
      log.line('render', 'nothing resumable (no checkpoint, or inputs changed), starting fresh');
    }
  }
  if (!checkpoint) {
    checkpoint = state.create(manifestId, registry.ids());
  }

  const writer = createWriter('render');
  // Adopt the paths a previous partial run already wrote, so a resumed run's
  // written-set describes the whole site and pruning stays safe.
  writer.adopt(checkpoint.written);

  const ctx = createContext(found, writer, args);

  // --- the loop -----------------------------------------------------------
  for (const group of selected) {
    // Only --resume skips completed groups. Naming a group explicitly means
    // "render this now", even if a previous run already did.
    if (args.resume && checkpoint.groups[group.id] === 'done') {
      log.group('render', group.id, 0, 0, 'skipped (already done)');
      continue;
    }

    const groupStarted = Date.now();
    const before = writer.stats();

    // `await` covers both sync and async groups — only products is async, and
    // the loop doesn't need to know which is which.
    await group.run(ctx);

    const after = writer.stats();
    const touched = (after.written - before.written) + (after.unchanged - before.unchanged);
    log.group('render', group.id, touched, Date.now() - groupStarted);

    // Checkpoint AFTER the group, never before: a group marked done that didn't
    // finish is worse than repeating one that did.
    checkpoint.groups[group.id] = 'done';
    checkpoint.written = writer.paths();
    state.save(checkpoint);

    // And mirror it as readable text. Written here, inside the loop, so that a
    // run killed at any point leaves an accurate .cache/status.txt behind —
    // which is the only channel I can count on when the terminal shows nothing.
    status.save(checkpoint);
  }

  // --- completion and pruning ---------------------------------------------
  const allDone = registry.ids().every(function (id) {
    return checkpoint.groups[id] === 'done';
  });

  let pruned = 0;
  if (allDone) {
    checkpoint.complete = true;
    state.save(checkpoint);
    // Safe to prune: `written` covers every group, including ones rendered by
    // earlier invocations, because the writer adopted the checkpoint's paths.
    if (args.prune !== false) {
      pruned = writer.prune();
      checkpoint.written = writer.paths();
      state.save(checkpoint);
    }
  }
  status.save(checkpoint);

  // What's still outstanding, for ANY incomplete run — not just a --group one.
  // A killed full render and a --resume that didn't finish both need this too,
  // and neither used to say anything.
  const left = registry.ids().filter(function (id) {
    return checkpoint.groups[id] !== 'done';
  });

  const stats = writer.stats();

  // Passed to summary rather than printed on its own line, so it rides on the
  // LAST line of the run. When the terminal is truncated to a tail — or is a
  // phone screen — that's the line you're most likely to actually see.
  log.summary('render', {
    written: stats.written,
    unchanged: stats.unchanged,
    pruned: pruned,
    ms: Date.now() - started,
  }, left);

  return { written: stats.written, unchanged: stats.unchanged, pruned: pruned, complete: allDone };
}

module.exports = { run };
