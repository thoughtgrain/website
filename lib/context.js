'use strict';

/**
 * context.js — the derive step.
 *
 * ## Why this module exists
 *
 * In the old build, parsing and deriving were spread through the first 400 lines
 * of a 1,354-line function, interleaved with rendering. Article URLs were
 * assigned at one point, star ratings at another, note ledes at a third — all as
 * in-place mutations of arrays that later phases read. That made the pipeline
 * strictly sequential: you couldn't render just the feeds, because the feeds
 * depended on derivations that only happened if you'd run everything before
 * them.
 *
 * Pulling all of it here is what makes `render --group <id>` possible. Every
 * group gets a fully-derived context, so any group can run alone, in any order,
 * in its own process. That's the whole basis of the resumable build.
 *
 * ## What comes out
 *
 * One `ctx` object, handed to every page module:
 *
 *   ctx.site        site.json, plus drawerNavHtml / footerNavHtml
 *   ctx.data        the other JSON config, pre-rendered where templates need it
 *   ctx.content     the nine collections, fully derived
 *   ctx.layouts     name → template source
 *   ctx.iconSprite  the inlined SVG sprite
 *   ctx.render      the template engine
 *   ctx.write       the counting writer (see fsx.js)
 *   ctx.args        parsed CLI flags
 *
 * Derivations MUTATE the parsed entries in place, which is how the original
 * worked and what the templates expect. It's safe here because context is built
 * fresh per run and nothing else holds a reference.
 */

const path = require('path');
const { SRC, ROOT } = require('./config');
const { readText } = require('./fsx');
const { loadCollections, loadData } = require('./parse/content');
const layoutStore = require('./render/layouts');
const { renderTemplate } = require('./render/template');
const { renderDrawerNav, renderFooterNav } = require('./render/nav');
const { escapeHtml, escapeXml } = require('./render/escape');
const helpers = require('./render/helpers');

// Learning resources carry a machine `kind`; this maps it to the short label
// shown in the pill beside each entry.
const LEARNING_KIND_LABEL = {
  book: 'Book', course: 'Course', talk: 'Talk', paper: 'Paper',
  reading: 'Reading', tool: 'Tool', newsletter: 'Letter',
  community: 'Community', event: 'Event',
};

// Reading entries carry a machine `status`; this is its display form.
const READING_STATUS_LABEL = { now: 'Now reading', next: 'Queued', done: 'Finished' };

/**
 * Pre-render the fragments the template engine can't produce itself.
 *
 * The engine has no nested `{{#each}}`, so anything that is a list inside a list
 * — a work entry's highlights, a learning topic's resources, a gear section's
 * items — has to be flattened to an HTML string here.
 */
function prerenderData(data) {
  (data.about.work || []).forEach(function (w) {
    if (w.highlights && w.highlights.length) {
      w.highlightsHtml = w.highlights.map(function (h) { return '<li>' + h + '</li>'; }).join('');
    }
  });

  (data.learning.topics || []).forEach(function (t) {
    t.resourcesHtml = (t.resources || []).map(function (r) {
      const kind = LEARNING_KIND_LABEL[r.kind] || r.kind;
      return '<li class="learning-resource">' +
               '<span class="learning-resource__kind">' + kind + '</span>' +
               '<span>' +
                 '<span class="learning-resource__label">' + r.label + '</span>' +
                 '<span class="learning-resource__author">, ' + r.author + '</span>' +
               '</span>' +
             '</li>';
    }).join('');
  });

  (data.gear.sections || []).forEach(function (s) {
    s.itemsHtml = (s.items || []).map(function (g) {
      return '<li class="gear-row">' +
               '<span class="gear-row__name">' + g.name + '</span>' +
               '<p class="gear-row__note">' + g.note + '</p>' +
             '</li>';
    }).join('');
  });
}

/**
 * Everything that has to be true about the content collections before ANY page
 * module runs. Ordering within this function matters; ordering between page
 * modules, after it, does not.
 */
function deriveContent(content) {
  const { articles, projects, notes, reading, music, movies, podcasts, bookshelf, products } = content;

  // --- products -----------------------------------------------------------
  // The bare hostname is used twice: as the byline on /enjoying/ and on the
  // "Buy from …" button. Derived once so those can't drift apart.
  products.forEach(function (p) {
    if (p.url) {
      try { p.urlHost = new URL(p.url).hostname.replace(/^www\./, ''); }
      catch (e) { p.urlHost = ''; }
    }
  });

  // --- cultural collections ------------------------------------------------
  // Index pages show the lede; readers show lede + afterthought.
  helpers.splitLede(reading);
  helpers.splitLede(music);
  helpers.splitLede(movies);
  helpers.splitLede(podcasts);
  helpers.splitLede(bookshelf);

  reading.forEach(function (r) {
    r.statusLabel = READING_STATUS_LABEL[r.status] || r.status;
  });

  // Pre-render the five-star block. The WHITE STAR ☆ marks unfilled positions
  // rather than a faded ★, so the empty state reads as an outlined shape — it
  // stays legible for low-vision users and in glare, where a fade doesn't. The
  // glyphs are aria-hidden because the parent .movie-row__rating carries a real
  // aria-label; without that, a screen reader announces ten star characters.
  movies.forEach(function (m) {
    const rating = Math.max(0, Math.min(5, parseInt(m.rating, 10) || 0));
    m.starsHtml = '<span aria-hidden="true">' + '★'.repeat(rating) + '☆'.repeat(5 - rating) + '</span>';
  });

  // --- articles ------------------------------------------------------------
  // `kind` decides the route. Computing `url` up front means every template that
  // lists articles — home, indexes, tag pages, feeds, series nav — links to the
  // same place without each one re-deriving the rule.
  articles.forEach(function (a) {
    let dir;
    if (a.kind === 'Study') dir = 'studies';
    else if (a.kind === 'Build series') dir = 'build';
    else dir = 'essays';
    a.url = dir + '/' + a.slug + '/';
  });

  // The pipe-joined tag list the writing-index stamps onto each card as
  // data-tags. The tag-filter runtime reads that attribute to decide what to
  // show and hide without a page load.
  articles.forEach(function (a) {
    a.tagList = [a.tag1, a.tag2, a.tag3].filter(Boolean).join('|');
  });

  const buildSeries = articles
    .filter(function (a) { return a.kind === 'Build series'; })
    .sort(function (a, b) { return (a.seriesPart || 0) - (b.seriesPart || 0); });
  const essays = articles.filter(function (a) {
    return a.kind !== 'Study' && a.kind !== 'Build series';
  });
  const studies = articles.filter(function (a) { return a.kind === 'Study'; });

  // Series grouping is structural and independent of kind: any article with a
  // `series:` field joins a group, sorted by `seriesPart:`.
  const seriesGroups = {};
  articles.forEach(function (a) {
    if (!a.series) return;
    if (!seriesGroups[a.series]) seriesGroups[a.series] = [];
    seriesGroups[a.series].push(a);
  });
  Object.keys(seriesGroups).forEach(function (k) {
    seriesGroups[k].sort(function (a, b) { return (a.seriesPart || 0) - (b.seriesPart || 0); });
  });

  // --- notes ---------------------------------------------------------------
  // Notes get their own lede split rather than reusing helpers.splitLede: the
  // note list renders the lede UNWRAPPED (it goes inside a <p> of its own in the
  // list markup) while the afterthought keeps its <p> wrappers.
  notes.forEach(function (n) {
    const paras = [];
    const re = /<p>([\s\S]*?)<\/p>/g;
    let m;
    while ((m = re.exec(n.bodyHtml)) !== null) paras.push(m[1]);
    n.ledeHtml = paras[0] || '';
    n.afterthoughtHtml = paras.slice(1).map(function (p) { return '<p>' + p + '</p>'; }).join('\n');
  });

  // Group notes by month, preserving the newest-first order the filenames set.
  const notesGroups = [];
  const notesByMonth = {};
  notes.forEach(function (n) {
    const month = n.month || 'Notes';
    if (!notesByMonth[month]) {
      notesByMonth[month] = { month: month, notes: [] };
      notesGroups.push(notesByMonth[month]);
    }
    notesByMonth[month].notes.push(n);
  });

  return {
    articles, projects, notes, reading, music, movies, podcasts, bookshelf, products,
    essays, studies, buildSeries, seriesGroups, notesGroups,
  };
}

/**
 * Build the context for one run.
 *
 * @param {object} manifest From manifest.scan() or manifest.load().
 * @param {object} writer   From fsx.createWriter().
 * @param {object} args     Parsed CLI flags.
 * @returns {object} ctx
 */
function createContext(manifest, writer, args) {
  const data = loadData(manifest);

  // site.json doubles as the base template data for every page, so the nav HTML
  // is attached to it rather than kept separately.
  const site = data.site;
  site.drawerNavHtml = renderDrawerNav(data.nav);
  site.footerNavHtml = renderFooterNav(data.nav, site);

  prerenderData(data);

  const content = deriveContent(loadCollections(manifest));

  // Almost every page is rendered the same way: merge site data with the
  // page's own, render the inner layout, then wrap that in base.html. Doing it
  // once here keeps ten page modules from repeating the three-line dance — and
  // keeps the {{content}} slot's raw-HTML handling in exactly one place.
  const ctx = {
    site: site,
    data: data,
    content: content,
    layouts: layoutStore.loadAll(),
    layout: layoutStore.get,
    iconSprite: readText(path.join(SRC, 'assets', 'icons.svg')),
    render: renderTemplate,
    escapeHtml: escapeHtml,
    escapeXml: escapeXml,
    helpers: helpers,
    write: writer,
    args: args || {},
    manifest: manifest,
    ROOT: ROOT,
    SRC: SRC,
  };

  /**
   * Merge site defaults into a page's data. Every page needs the nav, the icon
   * sprite and the site title, and forgetting one of them is a silent bug.
   *
   * @param {object} pageData Page-specific values, including `basePath`.
   * @returns {object}
   */
  ctx.pageData = function (pageData) {
    return Object.assign({}, site, { iconSprite: ctx.iconSprite }, pageData);
  };

  /**
   * Render one page: inner layout first, then base.html around it.
   *
   * @param {string} layoutName Inner layout, e.g. 'article'.
   * @param {object} data Already through ctx.pageData().
   * @returns {string} Complete HTML document.
   */
  ctx.renderPage = function (layoutName, data) {
    const inner = renderTemplate(layoutStore.get(layoutName), data);
    return renderTemplate(layoutStore.get('base'), Object.assign({}, data, { content: inner }));
  };

  /**
   * Render a page and write it to dist/ in one step. The common case.
   *
   * @param {string} relPath Output path relative to dist/.
   * @param {string} layoutName Inner layout.
   * @param {object} pageData Page-specific values.
   */
  ctx.emit = function (relPath, layoutName, pageData) {
    writer.writeOut(relPath, ctx.renderPage(layoutName, ctx.pageData(pageData)));
  };

  return ctx;
}

module.exports = { createContext, deriveContent, prerenderData };
