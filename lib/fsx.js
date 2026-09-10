'use strict';

/**
 * fsx.js — filesystem helpers, and the single most important fix in this
 * refactor: the build no longer deletes dist/ before it writes anything.
 *
 * The old build's first act was
 *   fs.rmSync(DIST, { recursive: true, force: true })
 * so any interruption — an iOS process kill, a crash, two builds racing — left
 * an empty or half-populated site. That is precisely the "builds a few files and
 * then nothing" failure.
 *
 * The model here is write-then-prune:
 *   1. Every output goes through `writeOut`, which records the path it wrote.
 *   2. Files whose bytes already match are skipped, not rewritten.
 *   3. Stale files are removed only at the END of a run, and only when that run
 *      completed every group.
 *
 * An interrupted build now leaves the previous site standing, partially updated.
 * The worst case is stale pages, not a blank site.
 */

const fs = require('fs');
const path = require('path');
const { DIST } = require('./config');
const log = require('./log');

/** Recursive mkdir that is a no-op when the directory already exists. */
function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Read a UTF-8 text file. Thin wrapper, but it keeps `fs` out of most modules. */
function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

/**
 * List a directory's entries, filtered by extension, sorted by name.
 *
 * A missing directory returns [] rather than throwing, because several content
 * collections are legitimately optional. The sort is load-bearing: content files
 * are numbered (01-, 02-, …) and their filename order IS their display order.
 */
function listDir(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(function (f) { return !ext || f.endsWith(ext); })
    .sort();
}

/**
 * Walk a directory tree and return every file in it as a path relative to
 * `root`, using forward slashes. Used by `prune` to enumerate what's currently
 * in dist/, and by the poll watcher to enumerate what to watch.
 */
function walk(root, dir, out) {
  dir = dir || root;
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(root, full, out);
    } else {
      out.push(path.relative(root, full).split(path.sep).join('/'));
    }
  });
  return out;
}

/**
 * A writer bound to one build run.
 *
 * It owns the run's tallies and its written-set. Page modules get one of these
 * on `ctx.write` and never touch `fs` directly, which is what makes the counts
 * in the summary real rather than guessed.
 */
function createWriter(scope) {
  // Every relative path this run produced, whether rewritten or skipped. Prune
  // treats membership here as "this file is still part of the site".
  const written = new Set();
  let wroteCount = 0;
  let unchangedCount = 0;

  /**
   * Write one output file, relative to dist/.
   *
   * @param {string} relPath e.g. "notes/index.html"
   * @param {string|Buffer} contents
   */
  function writeOut(relPath, contents) {
    // Normalise to forward slashes so the written-set matches what `walk`
    // produces on any platform.
    relPath = relPath.split(path.sep).join('/');
    const full = path.join(DIST, relPath);

    mkdirp(path.dirname(full));

    const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8');

    // Skip the write when the file on disk is already byte-identical. This is
    // what makes `serve.js` rebuilds cheap — a one-line content edit rewrites
    // one or two pages, not all 64 — and it keeps dist/ mtimes stable so git
    // doesn't see churn on unchanged files.
    if (fs.existsSync(full)) {
      const existing = fs.readFileSync(full);
      if (existing.equals(buf)) {
        unchangedCount++;
        written.add(relPath);
        return false;
      }
    }

    fs.writeFileSync(full, buf);
    wroteCount++;
    written.add(relPath);
    log.item(scope, relPath);
    return true;
  }

  /** Copy a file into dist/, routed through writeOut so it counts and prunes. */
  function copyOut(srcFile, relPath) {
    return writeOut(relPath, fs.readFileSync(srcFile));
  }

  /**
   * Delete everything in dist/ that this run did not write.
   *
   * Only safe to call after a COMPLETE run — a partial run's written-set is
   * partial too, and pruning against it would delete most of the site. The
   * caller (commands/render.js) enforces that.
   *
   * @returns {number} How many stale files were removed.
   */
  function prune() {
    let removed = 0;
    walk(DIST).forEach(function (rel) {
      if (written.has(rel)) return;
      fs.unlinkSync(path.join(DIST, rel));
      removed++;
      log.item(scope, 'pruned ' + rel);
    });
    removeEmptyDirs(DIST);
    return removed;
  }

  /** Restore paths from a previous run's checkpoint when resuming. */
  function adopt(paths) {
    (paths || []).forEach(function (p) { written.add(p); });
  }

  return {
    writeOut,
    copyOut,
    prune,
    adopt,
    paths: function () { return Array.from(written).sort(); },
    stats: function () { return { written: wroteCount, unchanged: unchangedCount }; },
  };
}

/**
 * Remove directories left empty by pruning, depth-first so a directory whose
 * only contents were empty directories also goes. dist/ itself is kept.
 */
function removeEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  });
  if (dir !== DIST && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

module.exports = { mkdirp, readText, listDir, walk, createWriter };
