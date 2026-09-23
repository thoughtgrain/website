'use strict';

/**
 * pages/assets.js — the CSS and JS bundles, plus the feed stylesheet.
 *
 * Concatenation, not bundling: there's no minifier, no module graph, no source
 * maps. Three CSS files become dist/css/style.css and six JS files become
 * dist/js/main.js, in the order config.js declares.
 *
 * That order is deliberate and NOT alphabetical:
 *   CSS  tokens → kit → site, because the cascade depends on it.
 *   JS   theme first, so the stored colour scheme applies before paint.
 *
 * Which is why these are explicit lists in config.js rather than a directory
 * glob. A glob would sort them alphabetically and quietly break both. The
 * trade-off is that a new file has to be added to the list on purpose —
 * ARCHITECTURE.md used to claim this globbed, and it never has.
 */

const path = require('path');
const fs = require('fs');
const { SRC } = require('../config');
const { readText } = require('../fsx');

module.exports = {
  id: 'assets',
  label: 'CSS, JS and the feed stylesheet',

  // Which manifest sections this group reads, so `next` can rebuild what you
  // actually changed instead of walking the list from the top.
  // The bundles and the feed stylesheet. No content at all — this is the one
  // group a content edit can never affect.
  inputs: ['css', 'js', 'assets'],

  run: function (ctx) {
    // The manifest already resolved which of the configured files exist, in
    // order, so this never needs to touch the directory itself.
    const cssBundle = ctx.manifest.css.map(function (entry) {
      return readText(path.join(ctx.ROOT, entry.path));
    }).join('\n\n');
    ctx.write.writeOut('css/style.css', cssBundle);

    const jsBundle = ctx.manifest.js.map(function (entry) {
      return readText(path.join(ctx.ROOT, entry.path));
    }).join('\n\n');
    ctx.write.writeOut('js/main.js', jsBundle);

    // feed.xsl gives the Atom feeds a friendly rendered view when someone opens
    // one in a browser instead of a reader. Copied verbatim, no templating.
    const xsl = path.join(SRC, 'feed.xsl');
    if (fs.existsSync(xsl)) {
      ctx.write.copyOut(xsl, 'feed.xsl');
    }
  },
};
