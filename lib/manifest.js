'use strict';

/**
 * manifest.js — the "gather" half of the scan/render split.
 *
 * Rationale: the old build did its directory listing inline, in the middle of a
 * 1,354-line function, interleaved with rendering. If enumeration returned
 * nothing (a sandboxed filesystem that permits readFile but not readdir will do
 * exactly that) the build cheerfully produced an empty site with no error —
 * `parseMdxDir` swallowed a missing directory with `return []`.
 *
 * Splitting enumeration into its own command and its own artifact fixes that
 * three ways:
 *   1. It's short, so a hostile runtime is unlikely to kill it partway.
 *   2. It reports counts, so "found 0 articles" is visible instead of silent.
 *   3. Its output is a file, so `render` can run later, separately, as many
 *      times as it takes.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SRC, CACHE, MANIFEST_PATH, CONTENT_DIRS, DATA_FILES, CSS_ORDER, JS_ORDER } = require('./config');
const { mkdirp, listDir } = require('./fsx');

// Bumped whenever the manifest shape changes, so a stale .cache/ from an older
// checkout is rejected rather than misread.
const VERSION = 1;

/**
 * Describe one input file: where it is, how big, when it changed.
 *
 * Size and mtime are the staleness signal. They're cheap (one stat) and good
 * enough — this is a personal site, not a content-addressed build system, and
 * hashing every input on every render would cost more than it saves.
 */
function describe(absPath) {
  const st = fs.statSync(absPath);
  return {
    path: path.relative(path.join(SRC, '..'), absPath).split(path.sep).join('/'),
    size: st.size,
    mtimeMs: Math.round(st.mtimeMs),
  };
}

/** Describe every file with `ext` in `dir`, keyed by basename-without-extension. */
function describeDir(dir, ext) {
  return listDir(dir, ext).map(function (file) {
    const entry = describe(path.join(dir, file));
    entry.name = file.slice(0, file.length - ext.length);
    return entry;
  });
}

/**
 * Walk every input the build reads and produce the manifest object.
 *
 * Deliberately does no parsing — it only answers "which files exist and what
 * state are they in". Parsing happens in render, against this list.
 */
function scan() {
  const manifest = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    content: {},
    layouts: describeDir(path.join(SRC, 'layouts'), '.html'),
    components: describeDir(path.join(SRC, 'components'), '.html'),
    css: [],
    js: [],
    data: [],
    assets: [],
    counts: {},
  };

  // The nine content collections. Missing directories yield [], which is a
  // legitimate state (no podcasts yet) — but now it's a visible zero in the
  // scan output rather than silence.
  let contentTotal = 0;
  CONTENT_DIRS.forEach(function (spec) {
    const entries = describeDir(path.join(SRC, 'content', spec.dir), '.mdx');
    manifest.content[spec.key] = entries;
    contentTotal += entries.length;
  });

  // CSS and JS follow the fixed order from config, not directory order, because
  // the cascade and the script load order both depend on it. A file listed in
  // config but absent from disk is skipped rather than fatal, matching the old
  // behaviour for JS.
  CSS_ORDER.forEach(function (file) {
    const p = path.join(SRC, 'css', file);
    if (fs.existsSync(p)) manifest.css.push(describe(p));
  });
  JS_ORDER.forEach(function (file) {
    const p = path.join(SRC, 'js', file);
    if (fs.existsSync(p)) manifest.js.push(describe(p));
  });

  // The structured JSON that configures the site rather than filling it.
  DATA_FILES.forEach(function (spec) {
    const p = path.join(SRC, 'content', spec.file);
    if (fs.existsSync(p)) {
      const entry = describe(p);
      entry.name = spec.name;
      manifest.data.push(entry);
    }
  });

  // Standalone assets copied or inlined verbatim.
  ['assets/icons.svg', 'feed.xsl'].forEach(function (rel) {
    const p = path.join(SRC, rel);
    if (fs.existsSync(p)) manifest.assets.push(describe(p));
  });

  manifest.counts = {
    content: contentTotal,
    collections: CONTENT_DIRS.length,
    layouts: manifest.layouts.length,
    components: manifest.components.length,
    css: manifest.css.length,
    js: manifest.js.length,
    data: manifest.data.length,
    assets: manifest.assets.length,
  };

  return manifest;
}

/** Serialise the manifest to .cache/manifest.json. */
function save(manifest) {
  mkdirp(CACHE);
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

/** Read the manifest back, or null when there isn't one (or it's unreadable). */
function load() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    if (manifest.version !== VERSION) return null;
    return manifest;
  } catch (err) {
    return null;
  }
}

/**
 * A stable fingerprint of the manifest's file list.
 *
 * The checkpoint stores this so `--resume` can tell "continue the run I started"
 * from "the inputs changed underneath me, start over". `generatedAt` is excluded
 * deliberately — re-scanning unchanged sources should produce the same id.
 */
function fingerprint(manifest) {
  const copy = Object.assign({}, manifest);
  delete copy.generatedAt;
  return crypto.createHash('sha1').update(JSON.stringify(copy)).digest('hex');
}

/**
 * Compare the manifest against what's on disk right now.
 *
 * @returns {string[]} Human-readable descriptions of every discrepancy. Empty
 *   means the manifest is still accurate.
 */
function staleness(manifest) {
  const problems = [];
  const root = path.join(SRC, '..');

  function check(entry) {
    const abs = path.join(root, entry.path);
    if (!fs.existsSync(abs)) {
      problems.push(entry.path + ' is gone');
      return;
    }
    const st = fs.statSync(abs);
    if (st.size !== entry.size || Math.round(st.mtimeMs) !== entry.mtimeMs) {
      problems.push(entry.path + ' changed');
    }
  }

  Object.keys(manifest.content).forEach(function (key) {
    manifest.content[key].forEach(check);
  });
  ['layouts', 'components', 'css', 'js', 'data', 'assets'].forEach(function (key) {
    (manifest[key] || []).forEach(check);
  });

  return problems;
}

module.exports = { VERSION, scan, save, load, fingerprint, staleness };
