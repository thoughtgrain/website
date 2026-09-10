'use strict';

/**
 * render/layouts.js — loads every template in src/layouts/ once.
 *
 * The old build had 27 separate `fs.readFileSync` calls with 27 separate
 * variables, which meant adding a layout meant touching the loader, and page
 * modules could only see layouts that happened to be in scope. Here they're read
 * as a map keyed by basename, so `layouts.get('article')` works from anywhere.
 *
 * `get` throws on a missing layout rather than returning undefined. A typo'd
 * layout name would otherwise render the string "undefined" into a page and ship
 * it, which is far harder to notice than a build failure.
 */

const path = require('path');
const { SRC } = require('../config');
const { listDir, readText } = require('../fsx');

let cache = null;

/** Read every src/layouts/*.html into a name → source map. */
function loadAll(force) {
  if (cache && !force) return cache;
  const dir = path.join(SRC, 'layouts');
  const layouts = {};
  listDir(dir, '.html').forEach(function (file) {
    layouts[file.slice(0, -'.html'.length)] = readText(path.join(dir, file));
  });
  cache = layouts;
  return cache;
}

/**
 * Fetch one layout's source by name (no extension).
 * @throws when the layout doesn't exist.
 */
function get(name) {
  const layouts = loadAll();
  if (!(name in layouts)) {
    throw new Error(
      'layout "' + name + '" not found in src/layouts/. Available: ' +
      Object.keys(layouts).sort().join(', ')
    );
  }
  return layouts[name];
}

/** Drop the cache so the dev server picks up layout edits. */
function invalidate() {
  cache = null;
}

module.exports = { loadAll, get, invalidate };
