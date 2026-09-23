'use strict';

/**
 * pages/flat-pages.js — the six standing pages that aren't driven by a content
 * collection: /now/, /about/, /learning/, /gear/, /colophon/ and /styles/.
 *
 * Each is one JSON file plus one layout, so they're described as a table rather
 * than written out six times. The old build spent 90 near-identical lines on
 * these; the shape is now visible at a glance and adding a seventh is one entry.
 *
 * All six sit one level deep, hence the shared '../' basePath.
 */

const { renderBuildSeriesListHtml } = require('../render/build-series-list');

/**
 * The page table.
 *
 * `data(ctx)` returns the page-specific template values. Everything common —
 * site fields, nav, icon sprite, basePath — is added by the runner below.
 */
const FLAT_PAGES = [
  {
    route: 'now',
    layout: 'now',
    title: 'Now',
    description: function (ctx) { return 'What ' + ctx.site.ownerName + ' is up to this month.'; },
    data: function (ctx) {
      return { items: ctx.data.now.items, nowUpdated: ctx.data.now.updated };
    },
  },
  {
    route: 'about',
    layout: 'about',
    title: 'About',
    description: function (ctx) {
      return 'About ' + ctx.site.ownerName + ', designer, developer, accessibility lead.';
    },
    data: function (ctx) {
      return {
        initials: ctx.data.about.initials,
        work: ctx.data.about.work,
        elsewhere: ctx.data.about.elsewhere,
      };
    },
  },
  {
    route: 'learning',
    layout: 'learning',
    title: 'Learning',
    description: function (ctx) {
      return 'What ' + ctx.site.ownerName +
        ' is chasing, accessibility, perceptual contrast, management as craft.';
    },
    data: function (ctx) { return { topics: ctx.data.learning.topics }; },
  },
  {
    route: 'gear',
    layout: 'gear',
    title: 'Gear',
    description: function (ctx) { return 'The tools ' + ctx.site.ownerName + ' actually uses.'; },
    data: function (ctx) { return { sections: ctx.data.gear.sections }; },
  },
  {
    route: 'colophon',
    layout: 'colophon',
    title: 'Colophon',
    description: function (ctx) { return 'How ' + ctx.site.ownerName + '’s site is made.'; },
    data: function (ctx) {
      return {
        items: ctx.data.colophon.items,
        // The colophon doubles as the index for the build series — that's the
        // one place those posts are linked from. Rendered here rather than in
        // the series group so neither group depends on the other having run.
        buildSeriesHtml: renderBuildSeriesListHtml(ctx.content.buildSeries),
      };
    },
  },
  {
    route: 'styles',
    layout: 'styles',
    title: 'Styles',
    // A live specimen of the design system, linked from the colophon. It has no
    // JSON behind it at all — the layout IS the content.
    description: function () {
      return 'A live specimen of the palette, type, and components this site is built from.';
    },
    data: function () { return {}; },
  },
];

module.exports = {
  id: 'flat',
  label: 'now, about, learning, gear, colophon, styles',

  // Which manifest sections this group reads, so `next` can rebuild what you
  // actually changed instead of walking the list from the top.
  // The JSON config drives five of the six pages — and `articles` is not a
  // mistake: the colophon renders the build-series list.
  inputs: ['data', 'articles'],

  run: function (ctx) {
    FLAT_PAGES.forEach(function (page) {
      ctx.emit(page.route + '/index.html', page.layout, Object.assign({
        basePath: '../',
        pageTitle: page.title + ', ' + ctx.site.title,
        pageDescription: page.description(ctx),
      }, page.data(ctx)));
    });
  },
};
