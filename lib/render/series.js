'use strict';

/**
 * render/series.js — the series navigation blocks.
 *
 * A "series" is a structural grouping: any article with a `series:` field joins
 * a group, ordered by `seriesPart:`. It's independent of an article's `kind`, so
 * a series can span essays and studies, and the Build series has its own route
 * (/build/<slug>/) while still using this same machinery.
 *
 * Two blocks are produced, and both are used by more than one page module —
 * which is why they live here rather than inside pages/series.js:
 *
 *   renderSeriesNavHtml       the full "Part 3 of 5" contents list
 *   renderSeriesPrevNextHtml  the previous/next pair at the foot of a reader
 *
 * Both emit `{{basePath}}` rather than a resolved prefix, because the same block
 * is rendered into pages at different depths.
 */

function renderSeriesNavHtml(article, seriesGroups) {
  if (!article.series || !seriesGroups[article.series]) return '';
  var parts = seriesGroups[article.series];
  var items = parts.map(function (p) {
    var n = p.seriesPart ? String(p.seriesPart).padStart(2, '0') : '';
    var isCurrent = p.slug === article.slug;
    // Title sans the series prefix if present — keeps the list readable.
    var label = p.title.replace(new RegExp('^' + article.series + ',?\\s*', 'i'), '')
      .replace(/^part\s+\d+:\s*/i, '');
    var inner =
      '<span class="series-nav__num">' + n + '</span>' +
      '<span class="series-nav__body">' +
        '<span class="series-nav__title">' + label + '</span>' +
      '</span>' +
      (isCurrent ? '<span class="series-nav__here" aria-label="You are here">You are here</span>' : '');
    var cls = 'series-nav__row' + (isCurrent ? ' is-current' : '');
    var aria = isCurrent ? ' aria-current="page"' : '';
    if (isCurrent) {
      return '<li class="' + cls + '"><span class="series-nav__link"' + aria + '>' + inner + '</span></li>';
    }
    return '<li class="' + cls + '"><a class="series-nav__link" href="{{basePath}}' + p.url + '"' + aria + '>' + inner + '</a></li>';
  }).join('');
  var idx = parts.findIndex(function (p) { return p.slug === article.slug; });
  var caption = (idx >= 0 ? 'Part ' + (idx + 1) + ' of ' + parts.length : parts.length + ' parts') +
                ' in <em>' + article.series + '</em>';
  return '<aside class="series-nav" aria-label="' + article.series + ' series navigation">' +
           '<div class="series-nav__caption"><span class="kicker">Series</span><span class="series-nav__meta">' + caption + '</span></div>' +
           '<ol class="series-nav__list">' + items + '</ol>' +
         '</aside>';
}

function seriesPrevNext(article, seriesGroups) {
  if (!article.series || !seriesGroups[article.series]) return { prev: null, next: null };
  var parts = seriesGroups[article.series];
  var idx = parts.findIndex(function (p) { return p.slug === article.slug; });
  return {
    prev: idx > 0 ? parts[idx - 1] : null,
    next: idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null
  };
}
function renderSeriesPrevNextHtml(article, seriesGroups) {
  var pn = seriesPrevNext(article, seriesGroups);
  if (!pn.prev && !pn.next) return '';
  var prev = pn.prev
    ? '<a class="series-prevnext__link series-prevnext__link--prev" href="{{basePath}}' + pn.prev.url + '">' +
        '<span class="kicker">Previous</span>' +
        '<span class="series-prevnext__title">' + pn.prev.title.replace(/^.*part \d+:\s*/i, '') + '</span>' +
      '</a>'
    : '<span></span>';
  var next = pn.next
    ? '<a class="series-prevnext__link series-prevnext__link--next" href="{{basePath}}' + pn.next.url + '">' +
        '<span class="kicker">Next</span>' +
        '<span class="series-prevnext__title">' + pn.next.title.replace(/^.*part \d+:\s*/i, '') + '</span>' +
      '</a>'
    : '<span></span>';
  return '<nav class="series-prevnext" aria-label="Series navigation">' + prev + next + '</nav>';
}


module.exports = { renderSeriesNavHtml, seriesPrevNext, renderSeriesPrevNextHtml };
