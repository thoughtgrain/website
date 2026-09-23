'use strict';

/**
 * commands/status.js — `node build.js status`.
 *
 * Prints how far the build has got, and refreshes `.cache/status.txt` so the
 * same answer is available as a file.
 *
 * It reads the checkpoint and nothing else: no scan, no render, no writes to
 * `dist/`. So it's safe to run at any point, including while wondering whether
 * a previous run finished — which on a phone, where the terminal may show
 * nothing, is the question I actually have.
 */

const path = require('path');
const state = require('../state');
const status = require('../status');
const log = require('../log');
const { ROOT, STATUS_PATH } = require('../config');

/**
 * @param {object} args Parsed CLI flags.
 * @returns {object} The checkpoint that was read, or null.
 */
function run(args) {
  const checkpoint = state.load();

  // Scan the sources to see whether dist/ has drifted since the last build.
  // This is the question `status` is really for — "which groups finished" and
  // "is what I'm looking at current" are not the same thing.
  const freshness = status.freshness(checkpoint);
  const text = status.save(checkpoint, freshness);

  // Printed line by line through the logger rather than as one blob, so it goes
  // through the same synchronous write path as everything else.
  text.split('\n').forEach(function (l) {
    if (l !== '') log.raw(l);
  });

  // An INCOMPLETE run whose inputs moved can't be resumed — it would mix output
  // from two versions of the site — so `resume` will start over. Worth saying,
  // since "resume" implies otherwise.
  if (checkpoint && !checkpoint.complete && freshness && freshness.stale) {
    log.warn('status', 'that run was unfinished and the sources have moved — resume will start over');
  }

  log.raw('  also at ' + path.relative(ROOT, STATUS_PATH));
  return checkpoint;
}

module.exports = { run };
