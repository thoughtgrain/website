'use strict';

/**
 * parse/content.js — turns the manifest's file list into parsed entries.
 *
 * This is the "iterate" half of the scan/render split at its most literal: the
 * scan already decided WHICH files exist, so this module never lists a
 * directory. It takes paths and reads them.
 *
 * That separation matters on a restricted filesystem. `fs.readdirSync` is the
 * call most likely to be denied or to return an empty list in a sandbox, and
 * when it does, the old code's `if (!fs.existsSync(dir)) return []` turned a
 * permissions failure into a silently empty site. Now enumeration happens once,
 * in a command that reports its counts, and a missing file during render is a
 * loud error naming the path.
 */

const fs = require('fs');
const path = require('path');
const { ROOT } = require('../config');
const { parseFrontmatter } = require('./frontmatter');
const { parseMarkdown } = require('./markdown');
const { resolveComponents } = require('./components');

/**
 * Pull footnote definitions out of the RAW source, before markdown runs.
 *
 * Footnotes are authored inline as `<Footnote id="1" text="…" />` next to the
 * sentence they annotate, but they're rendered as a list at the foot of the
 * page. So they have to be collected separately from the body pass — by the
 * time the component resolver has run, the attributes are gone.
 *
 * @param {string} raw Unprocessed file contents.
 * @returns {Array<{id: string, text: string}>}
 */
function extractFootnotes(raw) {
  const footnotes = [];
  const fnRegex = /<Footnote\s+([\s\S]*?)\/>/g;
  let fnMatch;
  while ((fnMatch = fnRegex.exec(raw)) !== null) {
    const attrs = {};
    const attrRegex = /(\w+)=(?:"([^"]*?)"|'([^']*?)')/g;
    let am;
    while ((am = attrRegex.exec(fnMatch[1])) !== null) {
      attrs[am[1]] = am[2] !== undefined ? am[2] : am[3];
    }
    // Both are required — an id without text has nothing to show, and text
    // without an id has nothing to link back to.
    if (attrs.id && attrs.text) {
      footnotes.push({ id: attrs.id, text: attrs.text });
    }
  }
  return footnotes;
}

/**
 * Read and parse one content file.
 *
 * @param {string} absPath
 * @returns {object} Frontmatter fields plus `bodyHtml` and `footnotes`.
 */
function parseContentFile(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const parsed = parseFrontmatter(raw);

  // markdown first, then components — the component resolver needs to see the
  // tags intact, and the markdown pass leaves unknown inline HTML alone.
  let bodyHtml = parseMarkdown(parsed.content);
  bodyHtml = resolveComponents(bodyHtml);

  const footnotes = extractFootnotes(raw);

  return Object.assign({}, parsed.data, {
    bodyHtml: bodyHtml,
    // Inline <Footnote/> tags win; frontmatter `footnotes:` is the fallback for
    // entries that declare them as structured data instead.
    footnotes: footnotes.length > 0 ? footnotes : parsed.data.footnotes || [],
  });
}

/**
 * Parse every collection named in the manifest.
 *
 * File order is manifest order, which is sorted filename order — and that
 * ordering is load-bearing. Content files are numbered (01-, 02-, …) precisely
 * so their filenames dictate their display order.
 *
 * @param {object} manifest
 * @returns {object} collection key → array of parsed entries.
 */
function loadCollections(manifest) {
  const collections = {};
  Object.keys(manifest.content).forEach(function (key) {
    collections[key] = manifest.content[key].map(function (entry) {
      const abs = path.join(ROOT, entry.path);
      if (!fs.existsSync(abs)) {
        throw new Error(
          entry.path + ' is in the manifest but missing on disk. ' +
          'Re-run `node build.js scan`.'
        );
      }
      return parseContentFile(abs);
    });
  });
  return collections;
}

/**
 * Load the structured JSON config (site, nav, about, …) named in the manifest.
 * @returns {object} name → parsed JSON.
 */
function loadData(manifest) {
  const data = {};
  (manifest.data || []).forEach(function (entry) {
    const abs = path.join(ROOT, entry.path);
    try {
      data[entry.name] = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (err) {
      // Name the file. A bare "Unexpected token }" from JSON.parse in a build
      // that reads seven JSON files is not a useful error message.
      throw new Error('could not parse ' + entry.path + ': ' + err.message);
    }
  });
  return data;
}

module.exports = { parseContentFile, extractFootnotes, loadCollections, loadData };
