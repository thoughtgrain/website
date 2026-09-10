'use strict';

/**
 * parse/components.js — expands MDX-style component tags into HTML.
 *
 * Content files can write `<Footnote id="1" text="…" />` and get the markup from
 * src/components/Footnote.html, with `{{prop}}` slots filled from the tag's
 * attributes. It is not real MDX — there is no JSX, no evaluation, no nesting —
 * just a regex substitution over a handful of hand-written templates.
 *
 * One behavioural fix over the original: the component templates are now loaded
 * ONCE and cached. The old version re-read the entire src/components/ directory
 * from disk on every call, and it's called once per content file — so a 23-file
 * build did 23 directory listings and 115 file reads to produce five strings.
 * Cheap on an SSD, not cheap on a phone.
 */

const path = require('path');
const { SRC } = require('../config');
const { listDir, readText } = require('../fsx');

// Populated on first use and reused for the rest of the process. `null` rather
// than `{}` so "not loaded yet" is distinguishable from "loaded, found none".
let cache = null;

/**
 * Read src/components/*.html into a name → template map.
 *
 * Exposed so the dev server can drop the cache when a component file changes,
 * and so tests can prime it without touching disk.
 */
function loadComponents(force) {
  if (cache && !force) return cache;
  const dir = path.join(SRC, 'components');
  const components = {};
  listDir(dir, '.html').forEach(function (file) {
    components[file.slice(0, -'.html'.length)] = readText(path.join(dir, file));
  });
  cache = components;
  return cache;
}

/** Drop the cache. The watcher calls this so edits to components take effect. */
function invalidate() {
  cache = null;
}

/**
 * Replace every known component tag in `html` with its rendered template.
 *
 * @param {string} html Output of the markdown pass.
 * @returns {string}
 */
function resolveComponents(html) {
  const components = loadComponents();

  // Match self-closing JSX-ish components: <ComponentName prop="val" />
  //
  // The `[A-Z]` is load-bearing. Restricting the match to capitalised names
  // stops it running across a neighbouring lowercase HTML tag (`<div
  // id="opening"></div>`), while still allowing attribute VALUES to contain
  // inline HTML like `<code>` or `<em>`, because those tag names are lowercase
  // and so can't start a new match.
  return html.replace(/<([A-Z]\w*)\s+([\s\S]*?)\/>/g, function (match, name, attrsStr) {
    const template = components[name];

    // Unknown component: leave the source text untouched rather than silently
    // deleting it, so a typo in a content file is visible in the output.
    if (!template) return match;

    // Pull `prop="value"` / `prop='value'` pairs out of the tag.
    const attrs = {};
    const attrRegex = /(\w+)=(?:"([^"]*?)"|'([^']*?)')/g;
    let m;
    while ((m = attrRegex.exec(attrsStr)) !== null) {
      attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
    }

    // Fill the template's {{prop}} slots. Values pass through raw: component
    // attributes are authored by me in my own content files, not by visitors,
    // and several of them intentionally carry inline markup.
    let result = template;
    Object.keys(attrs).forEach(function (key) {
      result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), attrs[key]);
    });
    return result;
  });
}

module.exports = { resolveComponents, loadComponents, invalidate };
