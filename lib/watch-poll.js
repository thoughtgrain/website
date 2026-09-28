'use strict';

/**
 * watch-poll.js — the file watcher fallback.
 *
 * `fs.watch(dir, { recursive: true })` is the only platform-gated API this
 * project uses. It leans on FSEvents or ReadDirectoryChangesW, and where neither
 * exists it throws ERR_FEATURE_UNAVAILABLE_ON_PLATFORM or ENOSYS. In the old
 * serve.js that call was unguarded, so on any such platform the dev server died
 * at startup — after it had already kicked off a build.
 *
 * So: try the real watcher, and when it isn't available, fall back to this.
 * Polling mtimes is unglamorous and works everywhere, which for a site with a
 * few dozen source files is the right trade.
 *
 * It watches exactly the files the manifest lists, which is another quiet
 * benefit of having a manifest at all — no directory walking on every tick.
 */

const fs = require('fs');
const path = require('path');
const { ROOT } = require('./config');
const manifest = require('./manifest');

// A second is imperceptible when you're editing and cheap at this file count.
const DEFAULT_INTERVAL = 1000;

/** Every input path the manifest knows about, absolute. */
function manifestPaths(manifest) {
  const paths = [];
  Object.keys(manifest.content).forEach(function (key) {
    manifest.content[key].forEach(function (e) { paths.push(e.path); });
  });
  ['layouts', 'components', 'css', 'js', 'data', 'assets'].forEach(function (key) {
    (manifest[key] || []).forEach(function (e) { paths.push(e.path); });
  });
  return paths.map(function (rel) { return path.join(ROOT, rel); });
}

/**
 * Snapshot each file's size and content hash. A file that's gone is recorded as
 * a sentinel so deletions register too.
 *
 * This used to snapshot mtimes, which is the obvious thing and wrong on the
 * filesystem that matters: on iOS the repo sits under File Provider Storage,
 * where modification times aren't dependable, so a saved edit could leave mtime
 * untouched and the watcher would never fire. Size is the fast path; the hash is
 * the authority. Hashing every input costs ~5ms, and this runs once a second.
 */
function snapshot(paths) {
  const out = {};
  paths.forEach(function (p) {
    try {
      const st = fs.statSync(p);
      out[p] = st.size + ':' + manifest.hashFile(p);
    } catch (err) {
      out[p] = 'gone';
    }
  });
  return out;
}

/**
 * Poll the manifest's files and call `onChange(relPath)` when one moves.
 *
 * @param {object} manifest
 * @param {function(string): void} onChange
 * @param {number} [interval] Milliseconds between polls.
 * @returns {function(): void} Stop function.
 */
function watch(manifest, onChange, interval) {
  const paths = manifestPaths(manifest);
  let previous = snapshot(paths);

  const timer = setInterval(function () {
    const current = snapshot(paths);
    for (const p of paths) {
      if (current[p] !== previous[p]) {
        previous = current;
        onChange(path.relative(ROOT, p));
        return;
      }
    }
    previous = current;
  }, interval || DEFAULT_INTERVAL);

  // Don't hold the process open on this timer alone — the HTTP server is what
  // keeps the server alive, and this shouldn't outlive it.
  if (timer.unref) timer.unref();

  return function stop() { clearInterval(timer); };
}

module.exports = { watch, DEFAULT_INTERVAL };
