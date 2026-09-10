'use strict';

/**
 * pages/products.js — /products/ and each product's page.
 *
 * Products are things I recommend, with a link out to where you'd buy one. The
 * only unusual part is the hero image, which can be fetched from the product
 * page's og:image at build time.
 *
 * That fetch is OPT-IN now (`--fetch-images`, or FETCH_PRODUCT_IMAGES=1). See
 * net/product-images.js for why: it used to run on every build, cache or not,
 * putting a live network round trip with an 8-second timeout in the middle of an
 * otherwise entirely local build. Without an image, the templates fall back to a
 * typographic placeholder — which is a perfectly good page.
 */

const path = require('path');
const fs = require('fs');
const { renderFeedLinkHtml } = require('../render/helpers');
const { ensureProductImage, fetchAllowed } = require('../net/product-images');

/**
 * The hero image markup, or a typographic placeholder when there's no image.
 *
 * `prefix` differs by depth: the index sits one level down, a product reader
 * two, and `imageRel` is relative to src/ (and so to dist/ after the copy).
 */
function renderCover(escapeHtml, p, prefix) {
  if (p.imageRel) {
    return '<img class="product-card__img" src="' + prefix + p.imageRel +
           '" alt="' + escapeHtml(p.imageAlt || p.title) + '">';
  }
  return '<div class="cover-placeholder cover-placeholder--paper cover-placeholder--book">' +
         escapeHtml(p.title) + '</div>';
}

module.exports = {
  id: 'products',
  label: '/products/ and product readers',

  // The only async group — everything else is pure local work. Marked async so
  // the runner awaits it; the runner treats every group's return value the same
  // way, so nothing else has to care.
  run: async function (ctx) {
    const products = ctx.content.products;
    if (!products.length) return;

    const allowFetch = fetchAllowed(ctx.args);

    // Resolve every product's image first, in parallel. When fetching is off
    // this is just five existsSync calls and resolves immediately.
    await Promise.all(products.map(function (p) {
      return ensureProductImage(p, allowFetch);
    }));

    // Copy whatever images we ended up with into dist/, through the writer so
    // they count toward the run and survive pruning.
    products.forEach(function (p) {
      if (!p.imageRel) return;
      const srcPath = path.join(ctx.SRC, p.imageRel);
      if (fs.existsSync(srcPath)) ctx.write.copyOut(srcPath, p.imageRel);
    });

    // --- /products/ --------------------------------------------------------
    ctx.emit('products/index.html', 'products-index', {
      items: products.map(function (p) {
        return Object.assign({}, p, { coverHtml: renderCover(ctx.escapeHtml, p, '../') });
      }),
      feedLinkHtml: renderFeedLinkHtml('feed.xml', 'products'),
      basePath: '../',
      pageTitle: 'Products, ' + ctx.site.title,
      pageDescription: 'A short list of products worth recommending.',
    });

    // --- /products/<slug>/ -------------------------------------------------
    products.forEach(function (p) {
      ctx.emit('products/' + p.slug + '/index.html', 'product', Object.assign({}, p, {
        // One level deeper than the index, so the image href needs another '../'.
        coverHtml: renderCover(ctx.escapeHtml, p, '../../'),
        basePath: '../../',
        pageTitle: p.title + ', ' + ctx.site.title,
        pageDescription: p.note || p.title,
      }));
    });
  },
};
