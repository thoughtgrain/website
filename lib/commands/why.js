'use strict';

/**
 * commands/why.js — `node build.js why <file>`.
 *
 * Answers, for one source file: what does Node actually read, what does the
 * build remember, do they agree, and what did that produce in dist/.
 *
 * It exists because three rounds of debugging were lost to inference. The
 * symptom was "I edited a note and the page didn't update", and answering it
 * meant guessing between a build that couldn't see the change, an editor that
 * hadn't written it, and a viewer showing something stale. Each guess cost a
 * round trip. This prints all three layers at once, from disk, with no caching
 * anywhere in the path — including the first line of the body exactly as Node
 * reads it, because "the editor shows my edit but the file doesn't have it" is
 * a real failure on a syncing filesystem and no hash comparison makes it
 * obvious the way seeing the text does.
 *
 * Read-only. It never writes to dist/ or touches the checkpoint.
 */

const fs = require('fs');
const path = require('path');
const manifest = require('../manifest');
const registry = require('../pages');
const log = require('../log');
const { ROOT, ENJOYING_PER_PAGE } = require('../config');
const { parseContentFile } = require('../parse/content');

// Where each content collection's per-entry pages land, so `why` can point at
// the file a given source produced. Collections absent here have no per-entry
// page (or a computed route); those rows just say so.
const OUTPUT_ROUTE = {
  notes: 'notes',
  projects: 'projects',
  reading: 'reading',
  music: 'music',
  movies: 'movies',
  podcasts: 'podcasts',
  bookshelf: 'bookshelf',
  products: 'products',
};

/** Bytes → a short human string, since these are all small files. */
function bytes(n) {
  return String(n) + ' bytes';
}

/** Local timestamp, or a note when the file isn't there. */
function when(absPath) {
  try {
    return new Date(fs.statSync(absPath).mtimeMs).toISOString().replace('T', ' ').slice(0, 19);
  } catch (err) {
    return '(missing)';
  }
}

/** Index every stored manifest entry by its repo-relative path. */
function storedEntries() {
  const stored = manifest.load();
  const byPath = {};
  if (!stored) return byPath;
  manifest.eachSection(stored, function (section, entries) {
    entries.forEach(function (e) { byPath[e.path] = e; });
  });
  return byPath;
}

/**
 * Work out which collection a path belongs to, from the path itself rather than
 * the manifest — so a brand-new file that has never been scanned still reports.
 */
function collectionOf(relPath) {
  const m = relPath.match(/^src\/content\/([^/]+)\//);
  return m ? m[1] : null;
}

/** Report on one source file. */
function explain(relPath, stored) {
  const abs = path.join(ROOT, relPath);
  const lines = [];

  lines.push(relPath);

  if (!fs.existsSync(abs)) {
    lines.push('  on disk      MISSING — nothing at that path');
    return lines;
  }

  const st = fs.statSync(abs);
  const hash = manifest.hashFile(abs);
  lines.push('  on disk      ' + bytes(st.size) + '   ' + hash.slice(0, 12) +
    '   mtime ' + when(abs));

  const was = stored[relPath];
  if (!was) {
    lines.push('  in manifest  (absent) — never scanned, so the next build will pick it up');
  } else if (was.hash === hash) {
    lines.push('  in manifest  ' + bytes(was.size) + '   ' + was.hash.slice(0, 12) +
      '   → identical, the build sees no change here');
  } else {
    lines.push('  in manifest  ' + bytes(was.size) + '   ' + was.hash.slice(0, 12) +
      '   → DIFFERS, the build should re-render this');
  }

  // --- what it produces ---------------------------------------------------
  const collection = collectionOf(relPath);
  if (collection) {
    const groups = registry.GROUPS
      .filter(function (g) { return (g.inputs || []).indexOf(collection) !== -1; })
      .map(function (g) { return g.id; });
    if (groups.length) {
      lines.push('  affects      ' + groups.join(', '));
    }
  }

  // Parse it to find the slug, which is what the output path is built from.
  let parsed = null;
  try {
    parsed = parseContentFile(abs);
  } catch (err) {
    lines.push('  parse        FAILED — ' + err.message);
  }

  if (parsed && collection && OUTPUT_ROUTE[collection] && parsed.slug) {
    const outRel = path.join('dist', OUTPUT_ROUTE[collection], parsed.slug, 'index.html');
    const outAbs = path.join(ROOT, outRel);
    if (fs.existsSync(outAbs)) {
      lines.push('  renders to   ' + outRel);
      lines.push('  output       ' + bytes(fs.statSync(outAbs).size) +
        '   written ' + when(outAbs));
    } else {
      lines.push('  renders to   ' + outRel + '  — NOT BUILT YET');
    }
  }

  // --- the content itself -------------------------------------------------
  // The part that settles an editor-versus-disk disagreement without inference.
  if (parsed) {
    const firstPara = (parsed.bodyHtml || '').match(/<p>([\s\S]*?)<\/p>/);
    const text = firstPara
      ? firstPara[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      : '(no body text)';
    lines.push('  body as Node reads it:');
    lines.push('    "' + text.slice(0, 120) + (text.length > 120 ? '…' : '') + '"');
  }

  return lines;
}

/**
 * @param {object} args Parsed CLI flags; `_[1]` is the file to explain.
 */
function run(args) {
  const stored = storedEntries();
  const target = (args._ || [])[1];

  if (target) {
    // Accept either a repo-relative path or one relative to the cwd.
    const rel = path.isAbsolute(target)
      ? path.relative(ROOT, target)
      : path.relative(ROOT, path.resolve(process.cwd(), target));
    explain(rel.split(path.sep).join('/'), stored).forEach(log.raw);
    return;
  }

  // No argument: one line per content file, so a whole collection can be
  // eyeballed at once.
  log.raw('every content file, disk vs manifest');
  log.raw('');
  const onDisk = manifest.scan();
  Object.keys(onDisk.content).forEach(function (key) {
    onDisk.content[key].forEach(function (entry) {
      const was = stored[entry.path];
      const state = !was ? 'new'
        : was.hash === entry.hash ? 'same'
          : 'CHANGED';
      log.raw('  ' + state.padEnd(8) + entry.path);
    });
  });
  log.raw('');
  log.raw('name a file for the full chain: node build.js why <path>');
}

module.exports = { run, explain };
