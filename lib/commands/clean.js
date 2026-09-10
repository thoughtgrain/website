'use strict';

/**
 * commands/clean.js — `node build.js clean`.
 *
 * Removes files in dist/ that the last COMPLETE build didn't write. It is not
 * `rm -rf dist` — that's the behaviour this refactor removed, and reintroducing
 * it as the default would put the empty-site failure right back.
 *
 * With no complete checkpoint there's nothing to compare against, so it refuses
 * rather than guessing. Run a full build first.
 */

const state = require('../state');
const { createWriter } = require('../fsx');
const log = require('../log');

function run() {
  const checkpoint = state.load();

  if (!checkpoint || !checkpoint.complete) {
    log.warn('clean',
      'no complete build on record, so there is nothing safe to prune against. ' +
      'Run `node build.js` first.');
    return { pruned: 0 };
  }

  const writer = createWriter('clean');
  writer.adopt(checkpoint.written);
  const pruned = writer.prune();

  log.line('clean', pruned === 0
    ? 'nothing stale, dist/ matches the last build'
    : 'removed ' + pruned + ' stale file' + (pruned === 1 ? '' : 's'));

  return { pruned: pruned };
}

module.exports = { run };
