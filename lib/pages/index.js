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

/**
 * Sections that every page depends on, so a change to one affects all groups.
 *
 * `base.html` wraps every page and the nav is injected into all of them, so a
 * layout, a component, or site.json/nav.json moving means the whole site moves.
 * Keeping the rule here rather than repeating these three names in ten `inputs`
 * arrays means there's one place to be wrong.
 *
 * `data` is the blunt edge of this: it covers now/about/gear/learning/colophon
 * too, which only `flat` reads. Treating any data change as global rebuilds a
 * little more than strictly necessary — the right trade when the alternative is
 * shipping a site with a stale nav.
 */
const GLOBAL_SECTIONS = ['layouts', 'components', 'data'];

/** Every group id, for --list and for building a fresh checkpoint. */
function ids() {
  return GROUPS.map(function (g) { return g.id; });
}

/**
 * Which groups need re-rendering, given the sections that changed.
 *
 * @param {string[]|null} changedKinds Section names from manifest.changedKinds.
 * @returns {string[]} Group ids, in registry order. Empty when nothing is known
 *   about what changed — callers treat that as "no opinion", not "nothing".
 */
function affectedBy(changedKinds) {
  if (!changedKinds || !changedKinds.length) return [];

  // A global section moved: everything is affected, so don't bother filtering.
  const global = changedKinds.some(function (kind) {
    return GLOBAL_SECTIONS.indexOf(kind) !== -1;
  });
  if (global) return ids();

  return GROUPS.filter(function (group) {
    return (group.inputs || []).some(function (input) {
      return changedKinds.indexOf(input) !== -1;
    });
  }).map(function (g) { return g.id; });
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

module.exports = { GROUPS, ids, byId, affectedBy, GLOBAL_SECTIONS };
