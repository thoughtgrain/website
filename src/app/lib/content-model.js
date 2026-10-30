/**
 * content-model.js — content in, routes and collections out. No I/O.
 *
 * This is the one piece of logic both halves of the build need, so it takes a
 * plain `{ path: rawText }` map and nothing else. `vite.config.js` fills that
 * map with `readdirSync` at build time; the browser fills it with
 * `import.meta.glob`. Neither variant leaks in here, which is what keeps the
 * route list the config generates identical to the one the app renders.
 *
 * Ported from the old generator's derive step, minus the HTML it used to build —
 * React components do that part now.
 */

import { parseFrontmatter } from './frontmatter.js';
import { parseMarkdown } from './markdown.js';

/** Reading entries carry a machine `status`; this is its display form. */
const READING_STATUS_LABEL = { now: 'Now reading', next: 'Queued', done: 'Finished' };

/**
 * Categories at /projects/cat/<slug>/. A fixed list rather than one derived from
 * the content, so a link in the menu never 404s while a category is still empty.
 */
export const MAKING_CATEGORIES = [
  { slug: 'code', label: 'Code', dek: 'Software, libraries, scripts, and other things made by typing.' },
  { slug: 'accessibility', label: 'Accessibility', dek: 'A11y work, audits, contrast tools, and pieces of the practice.' },
  { slug: 'hardware', label: 'Hardware', dek: 'Physical objects, instruments, and circuits.' },
  { slug: 'design', label: 'Design', dek: 'Visual work, type, identity, posters, and illustration.' },
  { slug: 'experiments', label: 'Experiments', dek: 'Smaller scratch builds, prototypes, and weekend things.' },
];

/** The five standing pages with no collection behind them, plus the specimen. */
export const FLAT_ROUTES = ['now', 'about', 'learning', 'gear', 'colophon', 'styles'];

/** How many items per page of the paginated /enjoying/ stream. */
export const ENJOYING_PER_PAGE = 12;

/** Lowercase, non-alphanumerics to single hyphens, no leading or trailing one. */
export function slugifyTag(t) {
  return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Pull `<Footnote id="1" text="…" />` out of the raw source, before markdown runs. */
function extractFootnotes(raw) {
  const footnotes = [];
  const fnRegex = /<Footnote\s+([\s\S]*?)\/>/g;
  let m;
  while ((m = fnRegex.exec(raw)) !== null) {
    const attrs = {};
    const attrRegex = /(\w+)=(?:"([^"]*?)"|'([^']*?)')/g;
    let a;
    while ((a = attrRegex.exec(m[1])) !== null) {
      attrs[a[1]] = a[2] !== undefined ? a[2] : a[3];
    }
    if (attrs.id && attrs.text) footnotes.push({ id: attrs.id, text: attrs.text });
  }
  return footnotes;
}

/**
 * Expand MDX-style component tags using the templates from src/components/.
 *
 * Content can write `<Pullquote text="…" cite="…" />` and get the markup from
 * Pullquote.html, with `{{prop}}` slots filled from the tag's attributes. Not
 * real MDX: no JSX, no evaluation, no nesting — a regex over a handful of
 * hand-written templates.
 *
 * The `[A-Z]` is load-bearing. Restricting the match to capitalised names stops
 * it running across a neighbouring lowercase HTML tag, while still letting
 * attribute VALUES contain inline markup like `<code>` or `<em>`, because those
 * tag names can't start a new match.
 *
 * @param {string} html Output of the markdown pass.
 * @param {object} templates name → template HTML.
 */
function resolveComponents(html, templates) {
  return html.replace(/<([A-Z]\w*)\s+([\s\S]*?)\/>/g, (match, name, attrsStr) => {
    const template = templates[name];
    // Unknown component: leave the source text alone rather than deleting it,
    // so a typo in a content file is visible in the page.
    if (!template) return match;

    const attrs = {};
    const attrRegex = /(\w+)=(?:"([^"]*?)"|'([^']*?)')/g;
    let m;
    while ((m = attrRegex.exec(attrsStr)) !== null) {
      attrs[m[1]] = m[2] !== undefined ? m[2] : m[3];
    }

    // Values pass through raw: component attributes are authored by me in my own
    // content files, not by visitors, and several intentionally carry markup.
    return Object.keys(attrs).reduce(
      (out, key) => out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), attrs[key]),
      template,
    );
  });
}

/** Parse one file's raw text into an entry. */
function parseEntry(raw, components) {
  const parsed = parseFrontmatter(raw);
  // Markdown first, then components: the resolver needs the tags intact, and
  // the markdown pass leaves unknown inline HTML alone.
  const bodyHtml = resolveComponents(parseMarkdown(parsed.content), components);
  const footnotes = extractFootnotes(raw);
  return {
    ...parsed.data,
    bodyHtml,
    footnotes: footnotes.length ? footnotes : (parsed.data.footnotes || []),
  };
}

/** First paragraph unwrapped as the lede, the rest kept as the afterthought. */
function splitLede(entries) {
  entries.forEach((e) => {
    const paras = (e.bodyHtml || '').match(/<p>[\s\S]*?<\/p>/g) || [];
    e.ledeHtml = paras.length ? paras[0].replace(/^<p>|<\/p>$/g, '') : '';
    e.afterthoughtHtml = paras.slice(1).join('\n');
  });
}

/**
 * Turn `{ '/content/notes/01-x.mdx': '---\n…' }` into derived collections.
 *
 * Keys are sorted before parsing: content files are numbered (01-, 02-, …) and
 * that filename order IS their display order.
 *
 * @param {object} rawMap     path → raw .mdx text
 * @param {object} jsonMap    name → parsed JSON config
 * @param {object} components name → component template HTML, for the MDX tags
 */
export function buildContent(rawMap, jsonMap = {}, components = {}) {
  const collections = {};

  Object.keys(rawMap).sort().forEach((filePath) => {
    const m = filePath.match(/\/content\/([^/]+)\/[^/]+\.mdx$/);
    if (!m) return;
    const key = m[1];
    (collections[key] = collections[key] || []).push(parseEntry(rawMap[filePath], components));
  });

  // Make every collection exist, so pages never guard against undefined.
  ['articles', 'projects', 'notes', 'reading', 'music', 'movies', 'podcasts',
    'bookshelf', 'products'].forEach((k) => { collections[k] = collections[k] || []; });

  const {
    articles, projects, notes, reading, music, movies, podcasts, bookshelf, products,
  } = collections;

  // --- products -----------------------------------------------------------
  products.forEach((p) => {
    if (!p.url) return;
    try { p.urlHost = new URL(p.url).hostname.replace(/^www\./, ''); }
    catch { p.urlHost = ''; }
  });

  // --- cultural collections ------------------------------------------------
  [reading, music, movies, podcasts, bookshelf].forEach(splitLede);

  reading.forEach((r) => { r.statusLabel = READING_STATUS_LABEL[r.status] || r.status; });

  // The WHITE STAR marks unfilled positions rather than a faded filled one, so
  // the empty state reads as an outlined shape — legible for low vision and in
  // glare, where a fade isn't.
  movies.forEach((m) => {
    const rating = Math.max(0, Math.min(5, parseInt(m.rating, 10) || 0));
    m.stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    m.ratingValue = rating;
  });

  // --- articles ------------------------------------------------------------
  // `kind` decides the route, computed once so every list links to the same place.
  articles.forEach((a) => {
    const dir = a.kind === 'Study' ? 'studies' : a.kind === 'Build series' ? 'build' : 'essays';
    a.dir = dir;
    a.url = `/${dir}/${a.slug}/`;
    a.tagList = [a.tag1, a.tag2, a.tag3].filter(Boolean);
  });

  const buildSeries = articles
    .filter((a) => a.kind === 'Build series')
    .sort((a, b) => (a.seriesPart || 0) - (b.seriesPart || 0));
  const essays = articles.filter((a) => a.kind !== 'Study' && a.kind !== 'Build series');
  const studies = articles.filter((a) => a.kind === 'Study');

  // Series grouping is structural and independent of kind.
  const seriesGroups = {};
  articles.forEach((a) => {
    if (!a.series) return;
    (seriesGroups[a.series] = seriesGroups[a.series] || []).push(a);
  });
  Object.values(seriesGroups).forEach((g) => g.sort((a, b) => (a.seriesPart || 0) - (b.seriesPart || 0)));

  // --- notes ---------------------------------------------------------------
  // Their own lede split: the list renders the lede UNWRAPPED inside its own
  // markup, while the afterthought keeps its <p> wrappers.
  notes.forEach((n) => {
    const paras = [];
    const re = /<p>([\s\S]*?)<\/p>/g;
    let m;
    while ((m = re.exec(n.bodyHtml)) !== null) paras.push(m[1]);
    n.ledeHtml = paras[0] || '';
    n.afterthoughtHtml = paras.slice(1).map((p) => `<p>${p}</p>`).join('\n');
  });

  const notesGroups = [];
  const byMonth = {};
  notes.forEach((n) => {
    const month = n.month || 'Notes';
    if (!byMonth[month]) { byMonth[month] = { month, notes: [] }; notesGroups.push(byMonth[month]); }
    byMonth[month].notes.push(n);
  });

  return {
    ...collections,
    essays, studies, buildSeries, seriesGroups, notesGroups,
    data: jsonMap,
  };
}

/** Every distinct tag across a set of items, sorted. */
export function collectTags(items) {
  const set = new Set();
  items.forEach((it) => [it.tag1, it.tag2, it.tag3].filter(Boolean).forEach((t) => set.add(t)));
  return [...set].sort();
}

/**
 * Every route the site publishes, as paths with a trailing slash.
 *
 * `vite.config.js` turns each of these into an HTML entry, so this function is
 * the single definition of what pages exist.
 */
export function routesFor(content) {
  const routes = ['/'];

  routes.push('/notes/');
  content.notes.forEach((n) => routes.push(`/notes/${n.slug}/`));

  ['essays', 'studies'].forEach((dir) => {
    const items = content[dir];
    routes.push(`/${dir}/`);
    collectTags(items).forEach((t) => routes.push(`/${dir}/tag/${slugifyTag(t)}/`));
    items.forEach((a) => routes.push(`/${dir}/${a.slug}/`));
  });

  content.buildSeries.forEach((a) => routes.push(`/build/${a.slug}/`));

  routes.push('/projects/');
  MAKING_CATEGORIES.forEach((c) => routes.push(`/projects/cat/${c.slug}/`));
  content.projects.forEach((p) => routes.push(`/projects/${p.slug}/`));

  ['reading', 'music', 'movies', 'podcasts', 'bookshelf'].forEach((kind) => {
    if (!content[kind].length) return;
    routes.push(`/${kind}/`);
    content[kind].forEach((e) => routes.push(`/${kind}/${e.slug}/`));
  });

  // /enjoying/ pools every cultural kind plus products, paginated.
  const enjoyingCount = ['movies', 'music', 'reading', 'podcasts', 'bookshelf', 'products']
    .reduce((n, k) => n + content[k].length, 0);
  const pages = Math.max(1, Math.ceil(enjoyingCount / ENJOYING_PER_PAGE));
  routes.push('/enjoying/');
  for (let p = 2; p <= pages; p++) routes.push(`/enjoying/${p}/`);

  if (content.products.length) {
    routes.push('/products/');
    content.products.forEach((p) => routes.push(`/products/${p.slug}/`));
  }

  FLAT_ROUTES.forEach((r) => routes.push(`/${r}/`));

  return [...new Set(routes)].sort();
}
