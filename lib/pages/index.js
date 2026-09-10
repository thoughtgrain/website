'use strict';

/**
 * pages/index.js — the group registry.
 *
 * This array IS the build pipeline. Each entry is a module exporting
 * `{ id, label, run(ctx) }`, and `render` walks them in order, checkpointing
 * after each one.
 *
 * Order here is presentation order, not dependency order. Every group receives a
 * fully-derived context (see context.js), so any of them can run alone, in any
 * order, in its own process — which is what makes `--group` and `--resume` work.
 * The one thing order buys is a readable log: assets first, then the homepage,
 * then sections, then feeds.
 *
 * Adding a page group means writing one module and adding one line here.
 */

const GROUPS = [
  require('./assets'),
  require('./home'),
  require('./notes'),
  require('./writing'),
  require('./series'),
  require('./projects'),
  require('./flat-pages'),
  require('./enjoying'),
  require('./products'),
  require('./feeds'),
];

/** Every group id, for --list and for building a fresh checkpoint. */
function ids() {
  return GROUPS.map(function (g) { return g.id; });
}

/**
 * Look up one group by id.
 * @throws with the valid ids listed, since this is usually a typo at the CLI.
 */
function byId(id) {
  const found = GROUPS.filter(function (g) { return g.id === id; })[0];
  if (!found) {
    throw new Error('unknown group "' + id + '". Known groups: ' + ids().join(', '));
  }
  return found;
}

module.exports = { GROUPS, ids, byId };
