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
const manifest = require('../manifest');
const log = require('../log');
const { ROOT, STATUS_PATH } = require('../config');

/**
 * @param {object} args Parsed CLI flags.
 * @returns {object} The checkpoint that was read, or null.
 */
function run(args) {
  const checkpoint = state.load();
  const text = status.save(checkpoint);

  // Printed line by line through the logger rather than as one blob, so it goes
  // through the same synchronous write path as everything else.
  text.split('\n').forEach(function (l) {
    if (l !== '') log.raw(l);
  });

  // A checkpoint that no longer matches the sources would resume into a mix of
  // two versions of the site, so say so rather than letting --resume surprise
  // anyone. render() already refuses in this case; this just makes it visible.
  if (checkpoint && !checkpoint.complete) {
    const found = manifest.load();
    if (found && manifest.fingerprint(found) !== checkpoint.manifestId) {
      log.warn('status', 'inputs changed since that run — --resume will start over');
    }
  }

  log.raw('  also at ' + path.relative(ROOT, STATUS_PATH));
  return checkpoint;
}

module.exports = { run };
