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
    // Nothing to diff against on a cold build: `changed` stays null, which
    // means "no opinion about what moved" rather than "nothing moved".
    return { manifest: scanCommand.run(args), changed: null };
  }

  const problems = manifest.staleness(existing);
  if (problems.length) {
    log.warn('render', 'manifest is stale (' + problems.length + ' change' +
      (problems.length === 1 ? '' : 's') + ': ' + problems.slice(0, 3).join('; ') +
      (problems.length > 3 ? '; …' : '') + '), re-scanning');
    const rescanned = scanCommand.run(args);
    // The old manifest is still in hand here, so the diff costs nothing extra —
    // no second scan, no extra file on disk. This is what tells `next` which
    // groups your edit actually touched.
    return { manifest: rescanned, changed: manifest.changedKinds(existing, rescanned) };
  }

  return { manifest: existing, changed: [] };
}

/**
 * @param {object} args Parsed CLI flags.
 * @returns {Promise<object>} Run stats.
 */
async function run(args) {
  args = args || {};
  const started = Date.now();

  // `--step` was `--next` first. Keeping the old spelling working costs one
  // line and means nothing already typed or scripted breaks on the rename.
  if (args.next && !args.step) args.step = args.next;

  const current = currentManifest(args);
  const found = current.manifest;
  const manifestId = manifest.fingerprint(found);

  // --list prints the plan and exits. Useful on a phone for deciding which
  // groups to run in which order without committing to any work.
  if (args.list) {
    registry.GROUPS.forEach(function (g) {
      log.line('render', g.id + ' — ' + g.label);
    });
    return { listed: true };
  }

  // --- checkpoint ---------------------------------------------------------
  // An existing checkpoint is carried forward in three cases:
  //
  //   --resume   you're explicitly continuing an interrupted run
  //   --group    a single-group run is BY DEFINITION part of a larger build, so
  //              starting a fresh checkpoint each time would throw away the
  //              groups already rendered — and that's the phone workflow:
  //              `scan` once, then one group per invocation.
  //   --step     same thing, except the checkpoint also decides WHICH group.
  //
  // In every case it's only trusted when it was built against these same inputs.
  let checkpoint = null;
  if (args.resume || args.group || args.step) {
    checkpoint = state.loadResumable(manifestId);
    if (!checkpoint && args.resume) {
      // Say WHICH of the three reasons it is — "starting fresh" alone leaves you
      // guessing whether your last run finished or your edits invalidated it.
      const existing = state.loadMatching(manifestId);
      log.line('render', existing && existing.complete
        ? 'last run finished — rebuilding everything'
        : 'nothing to resume (no checkpoint, or the sources changed), starting fresh');
    }
  }
  if (!checkpoint) {
    checkpoint = state.create(manifestId, registry.ids());
  }

  // --- what this invocation covers ----------------------------------------
  // `node build.js step` renders the first group the checkpoint hasn't
  // finished, then stops. Run it repeatedly and it walks the whole build one
  // short command at a time — no flags to type, no group ids to remember, which
  // is the point on a phone keyboard.
  let groupId = args.group;
  if (args.step && !groupId) {
    // A COMPLETE checkpoint doesn't come back from loadResumable — by design,
    // since a new run should start fresh rather than resume a finished one. But
    // "finished" and "never started" are opposite answers for `next`, so ask
    // for the matching checkpoint directly and read `.complete` off it.
    const finished = state.loadMatching(manifestId);
    if (finished && finished.complete) {
      log.line('render', 'nothing pending — every group is done');
      log.summary('render', { written: 0, unchanged: 0, pruned: 0, ms: Date.now() - started }, []);
      return { written: 0, unchanged: 0, pruned: 0, complete: true };
    }

    const pending = registry.ids().filter(function (id) {
      return checkpoint.groups[id] !== 'done';
    });

    // Prefer a group your edit actually touched.
    //
    // Without this, editing a note and running `next` rebuilt `assets` — the
    // first group in presentation order — and left the note alone. You'd have
    // to run `next` three more times before seeing your own change, with
    // nothing in the output explaining why. Presentation order is right for a
    // cold build and wrong for the case you're in most of the time.
    const affected = registry.affectedBy(current.changed);
    const everything = affected.length === registry.ids().length;
    let queue = pending.filter(function (id) { return affected.indexOf(id) !== -1; });

    // Most specific first. Editing a note affects `notes`, but also `home`
    // (which digests the latest four) and `feeds` — and "show me my note" means
    // the page, not the digest. Ranking by how many sections a group reads puts
    // the dedicated page ahead of anything that merely mentions it: notes reads
    // 1 section, home reads 3, feeds reads 9. Ties keep registry order, since
    // sort() is stable.
    //
    // Skipped when a layout or site-wide config moved and EVERY group is
    // affected: there's no "the page you edited" to surface, and you want all
    // ten anyway, so presentation order reads better in the log.
    if (!everything) {
      queue = queue.sort(function (a, b) {
        return (registry.byId(a).inputs || []).length -
               (registry.byId(b).inputs || []).length;
      });
    }

    // Fall back to plain pending order when nothing is known to have changed —
    // a cold build has no diff, and should behave exactly as it always did.
    groupId = queue[0] || pending[0];

    if (current.changed && current.changed.length) {
      log.line('render', 'sources changed: ' + current.changed.join(', '));
    }
    log.line('render', 'next up: ' + groupId +
      (queue.length
        ? ' — ' + affected.length + ' of ' + registry.ids().length + ' groups affected'
        : ' (' + pending.length + ' pending)'));
  }

  const selected = groupId ? [registry.byId(groupId)] : registry.GROUPS;
  const singleGroup = Boolean(groupId);

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
