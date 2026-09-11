'use strict';

/**
 * state.js — the render checkpoint.
 *
 * This is what lets a killed build resume instead of restarting. After each
 * group finishes, render rewrites .cache/state.json with:
 *   - which groups are done
 *   - every dist/ path written so far
 *   - whether the run reached the end
 *
 * Two invariants matter:
 *
 * 1. A checkpoint is only trusted when its `manifestId` matches the CURRENT
 *    manifest. If the inputs changed, resuming would mix output from two
 *    different versions of the site, so we start clean instead.
 *
 * 2. Pruning is gated on `complete`. A partial run's written-set is partial, and
 *    pruning against it would delete most of the site — the exact failure this
 *    refactor exists to prevent.
 */

const fs = require('fs');
const { CACHE, STATE_PATH } = require('./config');
const { mkdirp } = require('./fsx');

const VERSION = 1;

/** A checkpoint for a fresh run: nothing done, nothing written. */
function create(manifestId, groupIds) {
  const groups = {};
  groupIds.forEach(function (id) { groups[id] = 'pending'; });
  return {
    version: VERSION,
    manifestId: manifestId,
    startedAt: new Date().toISOString(),
    complete: false,
    groups: groups,
    written: [],
  };
}

/** Read the checkpoint, or null if absent, unreadable, or from an older shape. */
function load() {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (state.version !== VERSION) return null;
    return state;
  } catch (err) {
    return null;
  }
}

/**
 * Load a checkpoint only if it's safe to resume from.
 *
 * Returns null when there is no checkpoint, when it was built against different
 * inputs, or when the previous run already finished — in all three cases the
 * right move is a fresh run, not a resume.
 */
function loadResumable(manifestId) {
  const state = load();
  if (!state) return null;
  if (state.manifestId !== manifestId) return null;
  if (state.complete) return null;
  return state;
}

/**
 * Load a checkpoint that was built against these inputs, complete or not.
 *
 * `loadResumable` deliberately refuses a COMPLETE checkpoint, because a new run
 * should start fresh rather than resume a finished one. But some callers need to
 * tell "finished" apart from "never started" — `next` has nothing to do in the
 * first case and everything to do in the second — so this returns it either way
 * and lets the caller read `.complete`.
 */
function loadMatching(manifestId) {
  const state = load();
  if (!state) return null;
  if (state.manifestId !== manifestId) return null;
  return state;
}

/** Persist the checkpoint. Called after every group, so it must stay cheap. */
function save(state) {
  mkdirp(CACHE);
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

/** Forget any checkpoint, so the next run starts from scratch. */
function clear() {
  if (fs.existsSync(STATE_PATH)) fs.unlinkSync(STATE_PATH);
}

module.exports = { VERSION, create, load, loadResumable, loadMatching, save, clear };
