'use strict';

/**
 * render/helpers.js — small formatting utilities shared by more than one page
 * module.
 *
 * The rule for what lives here: if two page groups need it, it's a helper; if
 * only one does, it stays local to that page module. Everything here is a pure
 * function of its arguments.
 */

const { escapeHtml } = require('./escape');

// Parse the site's free-form date strings to ISO. Falls back to "now" so
// feeds always have a valid <updated> even when frontmatter dates are
// missing or formatted oddly ("Apr 14", "2026 →", etc.).
function toIsoDate(s) {
  if (!s) return new Date().toISOString();
  var t = Date.parse(String(s));
  if (!isNaN(t)) return new Date(t).toISOString();
  return new Date().toISOString();
}

// Strip HTML tags + collapse whitespace for plain-text summaries.
function plainSummary(html, maxLen) {
  var s = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
  return s;
}

// Pill-style "Subscribe to <label>" feed link rendered into each section
// index's page-header. Lives on its own line so it reads as a quiet
// invitation, visually distinct from the small footer RSS social link.
function renderFeedLinkHtml(href, label) {
  return '<p class="page-header__feed">' +
           '<a class="page-feed-link" href="' + href + '">' +
             '<svg class="page-feed-link__icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
               '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/>' +
             '</svg>' +
             '<span>Subscribe to ' + escapeHtml(label) + '</span>' +
           '</a>' +
         '</p>';
}


/**
 * Turn a tag into a URL-safe slug: lowercase, non-alphanumerics collapsed to
 * single hyphens, no leading or trailing hyphen. Used for /essays/tag/<slug>/
 * and /projects/cat/<slug>/, which must agree on the shape or the links break.
 */
function slugifyTag(t) {
  return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Split each entry's rendered body into a lede (the first paragraph, unwrapped)
 * and everything after it.
 *
 * Section indexes show only the lede; the reader page shows both. Doing the
 * split once here means the templates stay dumb — they just place `ledeHtml` and
 * `afterthoughtHtml` where they belong.
 *
 * Mutates the entries in place, which is how the rest of the derive step works.
 */
function splitLede(entries) {
  entries.forEach(function (e) {
    var paras = (e.bodyHtml || '').match(/<p>[\s\S]*?<\/p>/g) || [];
    e.ledeHtml = paras.length ? paras[0].replace(/^<p>|<\/p>$/g, '') : '';
    e.afterthoughtHtml = paras.slice(1).join('\n');
  });
}

module.exports = { toIsoDate, plainSummary, renderFeedLinkHtml, slugifyTag, splitLede };
