'use strict';

/**
 * commands/scan.js — `node build.js scan`.
 *
 * The "gather" half. Walks every input directory, writes .cache/manifest.json,
 * reports what it found, and stops.
 *
 * Why this is worth its own command: enumeration is the part most likely to fail
 * or come back empty in a restricted runtime, and it's now short enough that a
 * process killer won't catch it mid-flight. It also prints counts, so an empty
 * collection is something you can SEE rather than something you infer later from
 * a site with missing pages.
 */

const manifest = require('../manifest');
const state = require('../state');
const log = require('../log');
const { MANIFEST_PATH, ROOT, CONTENT_DIRS } = require('../config');
const path = require('path');

/**
 * @param {object} args Parsed CLI flags.
 * @returns {object} The manifest that was written.
 */
function run(args) {
  const started = Date.now();
  const found = manifest.scan();

  // Per-collection counts, so a collection that came back empty is visible
  // immediately rather than three commands later.
  CONTENT_DIRS.forEach(function (spec) {
    const n = (found.content[spec.key] || []).length;
    log.group('scan', spec.key, n, 0);
  });

  const c = found.counts;
  log.line('scan', 'layouts ' + c.layouts + ', components ' + c.components +
    ', css ' + c.css + ', js ' + c.js + ', data ' + c.data + ', assets ' + c.assets);

  manifest.save(found);

  // A new manifest invalidates any checkpoint built against the old one. Clear
  // it here rather than leaving render to discover the mismatch — a stale
  // checkpoint on disk is a trap for anyone reading .cache/ by hand.
  const previous = state.load();
  if (previous && previous.manifestId !== manifest.fingerprint(found)) {
    state.clear();
  }

  log.line('scan', 'wrote ' + path.relative(ROOT, MANIFEST_PATH) +
    '  (' + c.content + ' content files, ' + (Date.now() - started) + 'ms)');

  return found;
}

module.exports = { run };
