'use strict';

/**
 * render/build-series-list.js — the numbered series list the colophon shows.
 *
 * This lives in its own module because it crosses a group boundary: the entries
 * come from the `series` group's articles, but the markup is rendered into the
 * colophon, which belongs to `flat-pages`. Keeping it here means neither group
 * has to depend on the other having run — which is what lets `render --group
 * flat` work on its own.
 *
 * Emits `{{basePath}}` rather than a resolved prefix, so the same block would
 * work if the colophon ever moved depth.
 */

/**
 * @param {object[]} buildSeries Articles with kind "Build series", part-ordered.
 * @returns {string} HTML, or '' when there is no series.
 */
function renderBuildSeriesListHtml(buildSeries) {
  if (!buildSeries.length) return '';
  var items = buildSeries.map(function (p) {
    var num = p.seriesPart ? '<span class="build-series__num">' + String(p.seriesPart).padStart(2, '0') + '</span>' : '';
    return '<li class="build-series__row">' +
             '<a class="build-series__link" href="{{basePath}}' + p.url + '">' +
               num +
               '<span class="build-series__body">' +
                 '<span class="build-series__title">' + p.title.replace(/^Building this site, /, '') + '</span>' +
                 '<span class="build-series__dek">' + p.summary + '</span>' +
               '</span>' +
             '</a>' +
           '</li>';
  }).join('');
  return '<section class="build-series">' +
           '<h2 class="build-series__heading">How this site was built</h2>' +
           '<p class="build-series__intro">A short series on the rules, the bones, the template engine, the content, and the deploy.</p>' +
           '<ol class="build-series__list">' + items + '</ol>' +
         '</section>';
}

module.exports = { renderBuildSeriesListHtml };
