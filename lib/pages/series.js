'use strict';

/**
 * pages/series.js — the build series at /build/<slug>/.
 *
 * Articles with `kind: Build series` get their own route and are surfaced from
 * the colophon rather than the essays index — they're documentation of this
 * site, not writing about anything else.
 *
 * Two things differ from essays and studies:
 *   - there is no /build/ index page; the colophon IS the index (see
 *     render/build-series-list.js, which the colophon renders).
 *   - the related pool is the series itself, so navigation stays inside it.
 */

const { buildWritingReader } = require('../render/writing');

module.exports = {
  id: 'series',
  label: 'The build series at /build/',

  // Which manifest sections this group reads, so `next` can rebuild what you
  // actually changed instead of walking the list from the top.
  // Build-series posts are articles with `kind: Build series`.
  inputs: ['articles'],

  run: function (ctx) {
    buildWritingReader(ctx, 'build', ctx.content.buildSeries, {
      backLabel: 'Back to colophon',
      backHref: 'colophon/',
      relatedPool: ctx.content.buildSeries,
    });
  },
};
