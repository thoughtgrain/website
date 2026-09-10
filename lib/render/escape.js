'use strict';

/**
 * render/escape.js — output escaping, and the rules for opting out of it.
 *
 * Every `{{var}}` substitution in a template is HTML-escaped by default: the
 * characters that could close an attribute (") or open a tag (<, >) become
 * entities, so content can't break out into the surrounding markup.
 *
 * There are exactly two ways to pass raw HTML through, and both are deliberate:
 *
 *   1. A naming convention — any variable whose name ends in "Html" is trusted.
 *      Those are blocks this build pre-rendered itself (bodyHtml, starsHtml,
 *      filterRowHtml, …), so they're already valid markup.
 *   2. A short whitelist (RAW_KEYS) for structural slots that are always raw
 *      regardless of what they're called: the page-content slot and the icon
 *      sprite.
 *
 * Keeping this in one small file makes the trust boundary easy to audit — which
 * is the whole reason it's a separate module.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var RAW_KEYS = new Set(['content', 'iconSprite']);

// XML escaping for feed payloads. Same set as HTML escape plus apostrophe →
// &apos;, which is the XML-correct entity. Escaping all five keeps Atom
// validators happy.
function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isRawKey(name) {
  // Last segment of a dot-path drives the rule for nested lookups.
  var leaf = name.indexOf('.') === -1 ? name : name.split('.').pop();
  return /Html$/.test(leaf) || RAW_KEYS.has(leaf);
}

function renderValue(name, value) {
  if (value === undefined || value === null) return '';
  return isRawKey(name) ? String(value) : escapeHtml(value);
}


module.exports = { escapeHtml, escapeXml, isRawKey, renderValue, RAW_KEYS };
