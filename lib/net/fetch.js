'use strict';

/**
 * net/fetch.js — the build-time HTTP client, used only by the /products/ image
 * grabber.
 *
 * Pure Node, no dependencies. A browser-like User-Agent gets past the laziest
 * scrapers; anything stricter (Cloudflare and friends) falls through to the
 * placeholder path with a warning rather than failing the build.
 *
 * Everything in here is now OPT-IN. The old build awaited these requests on
 * every single run, which made an offline or sandboxed environment wait out an
 * 8-second socket timeout per product before it could finish. See
 * net/product-images.js for the gate.
 */

const http = require('http');
const https = require('https');

function fetchUrl(url, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    var lib = url.startsWith('https:') ? https : http;
    var req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
        'Accept': opts.binary ? 'image/*,*/*;q=0.8' : 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, function (res) {
      // Follow redirects (max 5)
      if ([301, 302, 303, 307, 308].indexOf(res.statusCode) !== -1 && res.headers.location) {
        var depth = (opts._depth || 0) + 1;
        if (depth > 5) return reject(new Error('too many redirects'));
        var next = new URL(res.headers.location, url).toString();
        return fetchUrl(next, Object.assign({}, opts, { _depth: depth })).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      var chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        var buf = Buffer.concat(chunks);
        if (opts.binary) {
          resolve({ buf: buf, contentType: res.headers['content-type'] || '' });
        } else {
          resolve(buf.toString('utf8'));
        }
      });
    });
    req.setTimeout(8000, function () { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

function extractImageUrlFromHtml(html, baseUrl) {
  // og:image (either attribute order), then twitter:image, then first <img>.
  var m = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i)
       || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i);
  if (m) return new URL(m[1], baseUrl).toString();
  m = html.match(/<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (m) return new URL(m[1], baseUrl).toString();
  m = html.match(/<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp|avif))["']/i);
  if (m) return new URL(m[1], baseUrl).toString();
  return null;
}

function extFromContentType(ct) {
  ct = (ct || '').toLowerCase();
  if (ct.indexOf('png') !== -1)  return '.png';
  if (ct.indexOf('webp') !== -1) return '.webp';
  if (ct.indexOf('avif') !== -1) return '.avif';
  if (ct.indexOf('gif') !== -1)  return '.gif';
  return '.jpg';
}


module.exports = { fetchUrl, extractImageUrlFromHtml, extFromContentType };
