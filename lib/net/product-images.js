'use strict';

/**
 * net/product-images.js — the build-time hero-image grabber for /products/.
 *
 * ## Why this is now opt-in
 *
 * The old build awaited an HTTP round trip per product on EVERY run, cache or
 * no cache — and the cache directory it checked (src/assets/products/) didn't
 * even exist in the repo, so the cache never hit. That put a live network
 * dependency, with an 8-second socket timeout per product, in the middle of a
 * build that otherwise touches nothing but local files.
 *
 * On a laptop that's an annoyance. On a phone, on cellular, in a sandboxed
 * runtime that may not have working DNS at all, it's a stall — and a stalled
 * process is exactly what iOS kills.
 *
 * So fetching now happens only when explicitly asked for:
 *
 *   node build.js --fetch-images        (or FETCH_PRODUCT_IMAGES=1)
 *
 * The default path reads whatever is already cached on disk and moves on. Images
 * are committed alongside the rest of src/assets, so a normal build — including
 * CI — never needs the network.
 */

const fs = require('fs');
const path = require('path');
const { SRC } = require('../config');
const { mkdirp } = require('../fsx');
const log = require('../log');
const { fetchUrl, extractImageUrlFromHtml, extFromContentType } = require('./fetch');

// Extensions checked when looking for an already-saved image, in preference
// order. First hit wins.
const CACHED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'];

/** Where cached product images live: src/assets/products/<slug>.<ext>. */
function cacheDir() {
  return path.join(SRC, 'assets', 'products');
}

/**
 * Look for an image already on disk for this product.
 * @returns {string|null} A path relative to src/, or null.
 */
function findCached(slug) {
  const dir = cacheDir();
  for (let i = 0; i < CACHED_EXTS.length; i++) {
    if (fs.existsSync(path.join(dir, slug + CACHED_EXTS[i]))) {
      return 'assets/products/' + slug + CACHED_EXTS[i];
    }
  }
  return null;
}

/**
 * Resolve one product's `imageRel`, fetching only if allowed.
 *
 * Always resolves — a failure sets `imageRel` to '' and the templates fall back
 * to a typographic placeholder. A missing image is never worth failing a build
 * over.
 *
 * @param {object} product Mutated in place with `imageRel`.
 * @param {boolean} allowFetch Whether the network may be used.
 */
async function ensureProductImage(product, allowFetch) {
  // 1. Already on disk? Use it, and never touch the network.
  const cached = findCached(product.slug);
  if (cached) {
    product.imageRel = cached;
    return;
  }

  // 2. No cache, and fetching wasn't requested: placeholder, with a hint.
  if (!allowFetch) {
    product.imageRel = '';
    log.warn('products',
      'no cached image for "' + product.slug + '". ' +
      'Save one at src/assets/products/' + product.slug + '.{jpg,png,webp}, ' +
      'or run with --fetch-images to try downloading it.');
    return;
  }

  // 3. Fetch: an explicit imageUrl wins, otherwise scrape og:image from the
  //    product page. Anything that goes wrong lands in the placeholder path.
  try {
    mkdirp(cacheDir());
    let imageUrl = product.imageUrl;
    if (!imageUrl) {
      if (!product.url) throw new Error('no product url');
      const html = await fetchUrl(product.url);
      imageUrl = extractImageUrlFromHtml(html, product.url);
      if (!imageUrl) throw new Error('no og:image in page');
    }
    const fetched = await fetchUrl(imageUrl, { binary: true });
    const ext = extFromContentType(fetched.contentType);
    fs.writeFileSync(path.join(cacheDir(), product.slug + ext), fetched.buf);
    product.imageRel = 'assets/products/' + product.slug + ext;
    log.line('products', 'fetched image for "' + product.slug + '" → ' + product.imageRel);
  } catch (err) {
    product.imageRel = '';
    log.warn('products',
      'could not fetch image for "' + product.slug + '": ' + err.message + '\n' +
      '           Add one manually at src/assets/products/' + product.slug +
      '.{jpg,png,webp} and the next build will pick it up.');
  }
}

/**
 * Whether the network may be used this run: an explicit flag, or the env var
 * (handy in Code App, where typing flags on a phone keyboard is a chore).
 */
function fetchAllowed(args) {
  return Boolean((args && args.fetchImages) || process.env.FETCH_PRODUCT_IMAGES === '1');
}

module.exports = { ensureProductImage, fetchAllowed, findCached };
