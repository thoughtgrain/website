'use strict';

/**
 * pages/feeds.js — eleven Atom feeds: one per section, plus a combined one at
 * the site root.
 *
 * Each feed carries an <?xml-stylesheet?> pointing at /feed.xsl, so opening a
 * feed URL in a browser shows a readable page instead of a wall of XML. That
 * href is ROOT-RELATIVE on purpose: browsers only apply an XSL stylesheet when
 * it's same-origin with the XML, so building an absolute URL off `siteUrl` would
 * break the moment the site is served from anywhere else — a local dev server,
 * a preview deploy, a fork.
 *
 * This group reads only derived collections and site.json, so it runs standalone
 * like every other group. In the old build it sat at the very end and depended
 * on everything before it having populated the arrays.
 */

const { FEED_MAX_ENTRIES } = require('../config');
const { toIsoDate, plainSummary } = require('../render/helpers');

/**
 * The per-section feeds: which collection, which route, and the copy.
 * `key` indexes ctx.content; `dir` is both the route and the output directory.
 */
const SECTIONS = [
  { key: 'essays', dir: 'essays', title: 'Essays', subtitle: 'Long-form writing.' },
  { key: 'studies', dir: 'studies', title: 'Studies', subtitle: 'Short, investigated pieces.' },
  { key: 'notes', dir: 'notes', title: 'Notes', subtitle: 'Short fragments and unfinished thoughts.' },
  { key: 'projects', dir: 'projects', title: 'Projects', subtitle: 'Things I’ve made or am still making.' },
  { key: 'products', dir: 'products', title: 'Products', subtitle: 'Things I recommend.' },
  { key: 'reading', dir: 'reading', title: 'Reading', subtitle: 'Books currently / queued / finished.' },
  { key: 'music', dir: 'music', title: 'Music', subtitle: 'Albums that mattered.' },
  { key: 'movies', dir: 'movies', title: 'Movies', subtitle: 'A viewing diary.' },
  { key: 'podcasts', dir: 'podcasts', title: 'Podcasts', subtitle: 'In rotation.' },
  { key: 'bookshelf', dir: 'bookshelf', title: 'Bookshelf', subtitle: 'Books that earned a permanent spot.' },
];

/**
 * Turn a content item into a feed entry.
 *
 * The summary falls through several fields because the collections don't share a
 * shape — an essay has `summary`, a product has `note`, a project has `dek` —
 * and stripping the body is the last resort.
 */
function entryFromItem(siteUrl, item, sectionPath) {
  const url = siteUrl + '/' + sectionPath + '/' + item.slug + '/';
  const summary = item.summary || item.note || item.dek || plainSummary(item.bodyHtml, 280) || '';
  return {
    title: item.title || '(untitled)',
    link: url,
    id: url,
    updated: toIsoDate(item.date || item.year || item.month),
    summary: plainSummary(summary, 280),
  };
}

/**
 * Serialise one Atom document.
 *
 * Built by string concatenation rather than through the template engine: the
 * escaping rules are different (XML, not HTML) and a feed has no {{basePath}}
 * problem to solve, so the engine would only get in the way.
 */
function renderAtomFeed(ctx, siteUrl, meta, entries) {
  // Newest first, capped. A feed reader only needs the recent tail.
  const ordered = entries.slice().sort(function (a, b) {
    return b.updated.localeCompare(a.updated);
  }).slice(0, FEED_MAX_ENTRIES);

  const escapeXml = ctx.escapeXml;
  const feedUrl = siteUrl + meta.path + 'feed.xml';
  const sectionUrl = siteUrl + meta.path;

  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>');
  lines.push('<feed xmlns="http://www.w3.org/2005/Atom">');
  lines.push('  <title>' + escapeXml(meta.title) + '</title>');
  lines.push('  <subtitle>' + escapeXml(meta.subtitle || '') + '</subtitle>');
  lines.push('  <link href="' + escapeXml(sectionUrl) + '" />');
  lines.push('  <link rel="self" type="application/atom+xml" href="' + escapeXml(feedUrl) + '" />');
  lines.push('  <id>' + escapeXml(feedUrl) + '</id>');
  // A feed needs a valid <updated> even when it's empty, hence the fallback.
  lines.push('  <updated>' + (ordered[0] ? ordered[0].updated : new Date().toISOString()) + '</updated>');
  lines.push('  <author>');
  lines.push('    <name>' + escapeXml(ctx.site.ownerName) + '</name>');
  lines.push('    <email>' + escapeXml(ctx.site.email) + '</email>');
  lines.push('  </author>');
  ordered.forEach(function (e) {
    lines.push('  <entry>');
    lines.push('    <title>' + escapeXml(e.title) + '</title>');
    lines.push('    <link href="' + escapeXml(e.link) + '" />');
    lines.push('    <id>' + escapeXml(e.id) + '</id>');
    lines.push('    <updated>' + e.updated + '</updated>');
    if (e.summary) lines.push('    <summary>' + escapeXml(e.summary) + '</summary>');
    lines.push('  </entry>');
  });
  lines.push('</feed>');
  return lines.join('\n') + '\n';
}

module.exports = {
  id: 'feeds',
  label: 'Atom feeds',

  // Which manifest sections this group reads, so `next` can rebuild what you
  // actually changed instead of walking the list from the top.
  // Every collection that appears in a feed — which is all of them.
  inputs: [
    'articles',
    'notes',
    'projects',
    'products',
    'reading',
    'music',
    'movies',
    'podcasts',
    'bookshelf',
  ],

  run: function (ctx) {
    // Trailing slash stripped once, so every URL built below concatenates
    // cleanly without doubling up.
    const siteUrl = String(ctx.site.siteUrl || '').replace(/\/$/, '');

    // Build each section's entries once — the global feed reuses them rather
    // than re-deriving from the collections.
    const bySection = SECTIONS.map(function (section) {
      const items = ctx.content[section.key] || [];
      return {
        section: section,
        entries: items.map(function (item) {
          return entryFromItem(siteUrl, item, section.dir);
        }),
      };
    });

    bySection.forEach(function (bundle) {
      const s = bundle.section;
      const xml = renderAtomFeed(ctx, siteUrl, {
        path: '/' + s.dir + '/',
        title: ctx.site.title + ', ' + s.title,
        subtitle: s.subtitle,
      }, bundle.entries);
      ctx.write.writeOut(s.dir + '/feed.xml', xml);
    });

    // The global feed: everything, newest 30, at /feed.xml.
    const globalEntries = bySection.reduce(function (acc, bundle) {
      return acc.concat(bundle.entries);
    }, []);
    const globalXml = renderAtomFeed(ctx, siteUrl, {
      path: '/',
      title: ctx.site.title,
      subtitle: ctx.site.description,
    }, globalEntries);
    ctx.write.writeOut('feed.xml', globalXml);
  },
};
