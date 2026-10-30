/**
 * content-model.js — content in, routes and collections out. No I/O.
 *
 * This is the one piece of logic both halves of the build need, so it takes a
 * plain `{ path: entry }` map and nothing else. The browser fills it with
 * `import.meta.glob` over the compiled MDX modules; `node-loader.js` fills the
 * same shape from disk for the feeds. Neither variant leaks in here, which is
 * what keeps the feeds and the pages describing the same site.
 *
 * Each value is `{ frontmatter, default }` — the parsed YAML and a React
 * component for the body. The body is never an HTML string, which is why
 * nothing here reads or transforms it: MDX compiled it, the pages render it,
 * and this module only ever touches metadata.
 */

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

/**
 * One compiled module into one entry.
 *
 * `Body` is capitalised because it's a component and the pages render it as
 * `<Body />`. Entries with no body at all still get one, so no page has to
 * guard before rendering.
 */
function toEntry(mod) {
  return { ...(mod.frontmatter || {}), Body: mod.default || (() => null) };
}

/**
 * Turn `{ '../content/notes/01-x.mdx': { frontmatter, default } }` into the
 * derived collections.
 *
 * Keys are sorted first: content files are numbered (01-, 02-, …) and that
 * filename order IS their display order.
 *
 * @param {object} moduleMap path → compiled MDX module
 * @param {object} jsonMap   name → parsed JSON config
 */
export function buildContent(moduleMap, jsonMap = {}) {
  const collections = {};

  Object.keys(moduleMap).sort().forEach((filePath) => {
    const m = filePath.match(/\/content\/([^/]+)\/[^/]+\.mdx$/);
    if (!m) return;
    const key = m[1];
    (collections[key] = collections[key] || []).push(toEntry(moduleMap[filePath]));
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
