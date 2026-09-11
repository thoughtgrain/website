'use strict';

/**
 * config.js — every path and every ordered list the build depends on.
 *
 * Everything else in lib/ imports its paths from here rather than doing its own
 * `path.join(__dirname, ...)`. That matters because the modules live at varying
 * depths (lib/, lib/parse/, lib/pages/) and hand-rolling `..` counts per file is
 * exactly the kind of thing that silently breaks when a file gets moved.
 */

const path = require('path');

// `__dirname` here is <repo>/lib, so one level up is the repository root.
const ROOT = path.join(__dirname, '..');

// Inputs live in src/, outputs go to dist/, and .cache/ holds the two files the
// scan/render split needs (the manifest and the checkpoint). .cache/ is
// gitignored — it is derived state, never something to commit.
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const CACHE = path.join(ROOT, '.cache');

const MANIFEST_PATH = path.join(CACHE, 'manifest.json');
const STATE_PATH = path.join(CACHE, 'state.json');

// The human-readable mirrors of what the build is doing. They exist because a
// terminal is not guaranteed: in Code App on iOS I get no stdout at all, so
// every progress line is also appended to BUILD_LOG_PATH, STATUS_PATH holds a
// short "what's done, what's left" snapshot rewritten after every group, and
// DOCTOR_PATH records what the runtime looks like.
//
// These live at the REPO ROOT, not in .cache/, and that placement is the whole
// point. A directory whose name starts with a dot is hidden by default in most
// file browsers — so the fallback channel I added for a broken terminal was
// itself invisible on the device that needed it. Machine state (the manifest,
// the checkpoint) stays in .cache/ because I never read it by hand; anything
// meant for a person goes where a person will see it.
const BUILD_LOG_PATH = path.join(ROOT, 'build.log');
const STATUS_PATH = path.join(ROOT, 'build-status.txt');
const DOCTOR_PATH = path.join(ROOT, 'build-doctor.txt');

/**
 * The nine content collections, in the order `scan` reports them.
 *
 * `key` is the name the collection gets on `ctx.content`; `dir` is the folder
 * under src/content/. They happen to match today, but keeping them separate
 * means a folder can be renamed without touching every page module.
 */
const CONTENT_DIRS = [
  { key: 'articles', dir: 'articles' },
  { key: 'projects', dir: 'projects' },
  { key: 'notes', dir: 'notes' },
  { key: 'reading', dir: 'reading' },
  { key: 'music', dir: 'music' },
  { key: 'movies', dir: 'movies' },
  { key: 'podcasts', dir: 'podcasts' },
  { key: 'bookshelf', dir: 'bookshelf' },
  { key: 'products', dir: 'products' },
];

/**
 * The JSON files under src/content/ that configure the site rather than
 * supplying entries. `name` becomes the key they are loaded under.
 */
const DATA_FILES = [
  { name: 'site', file: 'site.json' },
  { name: 'nav', file: 'nav.json' },
  { name: 'about', file: 'about.json' },
  { name: 'colophon', file: 'colophon.json' },
  { name: 'now', file: 'now.json' },
  { name: 'learning', file: 'learning.json' },
  { name: 'gear', file: 'gear.json' },
];

/**
 * CSS and JS are concatenated in a fixed order, not globbed — the cascade
 * depends on tokens coming before kit coming before site, and a glob would sort
 * them alphabetically and quietly break the cascade. Adding a file means adding
 * it here on purpose.
 */
const CSS_ORDER = ['tokens.css', 'kit.css', 'site.css'];
const JS_ORDER = [
  'theme.js',
  'accessibility.js',
  'nav.js',
  'texture.js',
  'floorboards.js',
  'tag-filter.js',
];

// How many items land on each page of the paginated /enjoying/ aggregate.
const ENJOYING_PER_PAGE = 12;

// Atom feeds keep only the newest N entries, per the spec's advice to keep feed
// documents small.
const FEED_MAX_ENTRIES = 30;

module.exports = {
  ROOT,
  SRC,
  DIST,
  CACHE,
  MANIFEST_PATH,
  STATE_PATH,
  BUILD_LOG_PATH,
  STATUS_PATH,
  DOCTOR_PATH,
  CONTENT_DIRS,
  DATA_FILES,
  CSS_ORDER,
  JS_ORDER,
  ENJOYING_PER_PAGE,
  FEED_MAX_ENTRIES,
};
