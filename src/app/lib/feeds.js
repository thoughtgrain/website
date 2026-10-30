/**
 * feeds.js — the eleven Atom feeds, as files.
 *
 * Ported from the old generator's lib/pages/feeds.js. It stays a build-time
 * concern because a feed has to be a real file at a real URL: a reader fetches
 * /notes/feed.xml and parses XML, so no amount of client rendering substitutes
 * for it. `vite.config.js` calls this from `generateBundle` and emits the result
 * into the build output.
 *
 * Pure: content in, `{ fileName, source }` out, no I/O.
 */

/** Per-section feeds: which collection, which route, and the copy. */
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

const MAX_ENTRIES = 30;

/** XML escaping — the same five as HTML plus the XML-correct &apos;. */
function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Parse the site's free-form date strings to ISO.
 *
 * An unparseable date falls back to a FIXED timestamp rather than `new Date()`.
 * The old build used "now" here, which meant five dateless entries got a fresh
 * timestamp on every run, their sort order flipped on millisecond ties, and four
 * feed files showed as modified in literally every commit. A stable fallback
 * makes the build reproducible; the real fix is putting dates in the content.
 */
const NO_DATE = '1970-01-01T00:00:00.000Z';

function toIsoDate(s) {
  if (!s) return NO_DATE;
  const t = Date.parse(String(s));
  return isNaN(t) ? NO_DATE : new Date(t).toISOString();
}

/** Strip tags and collapse whitespace, for plain-text summaries. */
function plainSummary(html, maxLen) {
  let s = String(html || '')
    .replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
  return s;
}

/**
 * One feed entry. The summary falls through several fields because the
 * collections don't share a shape — an essay has `summary`, a product has
 * `note`, a project has `dek` — and stripping the body is the last resort.
 */
function entryFromItem(siteUrl, item, sectionPath) {
  const url = `${siteUrl}/${sectionPath}/${item.slug}/`;
  const summary = item.summary || item.note || item.dek || item.lede || '';
  return {
    title: item.title || '(untitled)',
    link: url,
    id: url,
    updated: toIsoDate(item.date || item.year || item.month),
    summary: plainSummary(summary, 280),
  };
}

/**
 * Newest first, capped.
 *
 * Shared by both serialisers rather than done inside each. They describe the
 * same feed in two formats, so a reader comparing them must see the same items
 * in the same order — duplicating the sort is how that quietly stops being
 * true.
 */
function orderEntries(entries) {
  return entries.slice()
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, MAX_ENTRIES);
}

/** Serialise one Atom document. */
function renderAtom(site, siteUrl, meta, entries) {
  const ordered = orderEntries(entries);

  const feedUrl = `${siteUrl + meta.path}feed.xml`;
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${escapeXml(meta.title)}</title>`,
    `  <subtitle>${escapeXml(meta.subtitle || '')}</subtitle>`,
    `  <link href="${escapeXml(siteUrl + meta.path)}" />`,
    `  <link rel="self" type="application/atom+xml" href="${escapeXml(feedUrl)}" />`,
    `  <id>${escapeXml(feedUrl)}</id>`,
    `  <updated>${ordered[0] ? ordered[0].updated : NO_DATE}</updated>`,
    '  <author>',
    `    <name>${escapeXml(site.ownerName)}</name>`,
    `    <email>${escapeXml(site.email)}</email>`,
    '  </author>',
  ];

  ordered.forEach((e) => {
    lines.push('  <entry>');
    lines.push(`    <title>${escapeXml(e.title)}</title>`);
    lines.push(`    <link href="${escapeXml(e.link)}" />`);
    lines.push(`    <id>${escapeXml(e.id)}</id>`);
    lines.push(`    <updated>${e.updated}</updated>`);
    if (e.summary) lines.push(`    <summary>${escapeXml(e.summary)}</summary>`);
    lines.push('  </entry>');
  });

  lines.push('</feed>');
  return lines.join('\n') + '\n';
}

/**
 * Serialise one JSON Feed 1.1 document.
 *
 * https://jsonfeed.org/version/1.1
 *
 * This exists because the Atom feeds used to ship with an XSL stylesheet that
 * rendered them as a readable page, and CodePen won't host `.xsl` at all. JSON
 * isn't a stylesheet and doesn't replace what that did — it's a second feed
 * format, served as a plain file, which is the part that matters.
 *
 * `summary` is dropped rather than emitted empty: the spec treats absent and
 * empty differently, and a reader showing a blank line under every title is
 * worse than showing none.
 */
function renderJsonFeed(site, siteUrl, meta, entries) {
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: meta.title,
    description: meta.subtitle || '',
    home_page_url: siteUrl + meta.path,
    feed_url: `${siteUrl + meta.path}feed.json`,
    authors: [{ name: site.ownerName }],
    items: orderEntries(entries).map((e) => ({
      id: e.id,
      url: e.link,
      title: e.title,
      ...(e.summary ? { summary: e.summary } : {}),
      date_published: e.updated,
    })),
  };

  return `${JSON.stringify(feed, null, 2)}\n`;
}

/**
 * Every feed the site publishes.
 *
 * @param {object} content From buildContent().
 * @returns {Array<{fileName: string, source: string}>}
 */
export function renderFeeds(content) {
  const site = content.data.site || {};
  const siteUrl = String(site.siteUrl || '').replace(/\/$/, '');
  const out = [];

  // Built once and reused, so the global feed doesn't re-derive them.
  const bundles = SECTIONS.map((s) => ({
    section: s,
    entries: (content[s.key] || []).map((item) => entryFromItem(siteUrl, item, s.dir)),
  }));

  bundles.forEach(({ section, entries }) => {
    const meta = {
      path: `/${section.dir}/`,
      title: `${site.title}, ${section.title}`,
      subtitle: section.subtitle,
    };
    out.push({ fileName: `${section.dir}/feed.xml`, source: renderAtom(site, siteUrl, meta, entries) });
    out.push({ fileName: `${section.dir}/feed.json`, source: renderJsonFeed(site, siteUrl, meta, entries) });
  });

  const allMeta = { path: '/', title: site.title, subtitle: site.description };
  const all = bundles.flatMap((b) => b.entries);
  out.push({ fileName: 'feed.xml', source: renderAtom(site, siteUrl, allMeta, all) });
  out.push({ fileName: 'feed.json', source: renderJsonFeed(site, siteUrl, allMeta, all) });

  return out;
}
