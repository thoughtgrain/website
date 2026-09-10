'use strict';

/**
 * render/writing.js — the shared machinery behind /essays/, /studies/ and the
 * build series.
 *
 * All three are the same thing with different labels and routes: a list of
 * articles with an index, tag pages, and a reader per piece. Rather than
 * duplicate that in three page modules, the two builders live here and the page
 * modules just supply the copy.
 *
 * The interesting design decision is the tag filter. Chips are real links to
 * /<kind>/tag/<slug>/, and every tag page renders the FULL list with
 * non-matching cards marked `hidden`. So:
 *
 *   - without JS, clicking a chip navigates to a statically pre-filtered page;
 *   - with JS, the tag-filter runtime intercepts the click and toggles the
 *     hidden attribute in place, no page load.
 *
 * Same markup serves both. It costs a little page weight and buys a filter that
 * works with JS disabled, which is the trade I want.
 */

const { renderFeedLinkHtml, slugifyTag } = require('./helpers');
const { renderSeriesNavHtml, renderSeriesPrevNextHtml } = require('./series');

/** Every distinct tag across a set of items, sorted. */
function collectTags(items) {
  const tagSet = {};
  items.forEach(function (it) {
    [it.tag1, it.tag2, it.tag3].filter(Boolean).forEach(function (t) { tagSet[t] = true; });
  });
  return Object.keys(tagSet);
}

/** One filter chip. `aria-pressed` carries the state; `aria-current` the route. */
function chip(href, label, tag, isActive) {
  return '<a class="filter-bar__btn' + (isActive ? ' is-active' : '') + '"' +
         ' href="' + href + '"' +
         ' data-tag="' + tag + '"' +
         ' aria-pressed="' + (isActive ? 'true' : 'false') + '"' +
         (isActive ? ' aria-current="page"' : '') + '>' + label + '</a>';
}

/**
 * The per-page tag bar.
 *
 * Tags are the union across every item of the kind, so the same chip set appears
 * on the kind index and on every tag page — the bar doesn't shuffle as you
 * filter. There are no KIND chips, because the route already says which kind
 * you're looking at.
 *
 * @param {object[]} allItems Every item of this kind.
 * @param {string} kindLabel  Lowercase label, e.g. 'essays'.
 * @param {string} chipBase   Href prefix back to the kind index.
 * @param {string|null} activeTag The tag this page is filtered to, if any.
 */
function renderFilterRow(allItems, kindLabel, chipBase, activeTag) {
  if (!allItems.length) return '';
  const tags = collectTags(allItems).sort();
  if (!tags.length) return '';

  const allChip = chip(chipBase, 'All', 'all', !activeTag);
  const tagChips = tags.map(function (t) {
    return chip(chipBase + 'tag/' + slugifyTag(t) + '/', t, t, activeTag === t);
  }).join('');

  const labelId = 'tag-filter-label-' + kindLabel.toLowerCase();
  const liveId = 'tag-filter-live-' + kindLabel.toLowerCase();

  // The aria-live region is empty in the HTML; the runtime writes "N essays" into
  // it after a filter, so screen reader users hear the result of a click that
  // otherwise changes nothing announced.
  return '<div class="filter-row" data-tag-filter>' +
           '<span id="' + labelId + '" class="filter-row__label">Filter ' + kindLabel + ' by tag</span>' +
           '<div class="filter-bar filter-bar--tags" role="group" aria-labelledby="' + labelId + '">' +
             allChip + tagChips +
           '</div>' +
           '<p id="' + liveId + '" class="visually-hidden" aria-live="polite" aria-atomic="true"></p>' +
         '</div>';
}

/**
 * Compact "Related" cards under a reader's body.
 * Pre-rendered because the engine can't nest {{#each}} inside {{#if}}.
 */
function renderRelatedHtml(related) {
  if (!related.length) return '';
  const cards = related.map(function (r) {
    const tagSpans = [r.tag1, r.tag2, r.tag3].filter(Boolean)
      .map(function (t) { return '<span class="tag">' + t + '</span>'; }).join('');
    return '<a class="essay-card essay-card--compact" href="../../' + r.url + '">' +
             '<div class="essay-card__meta">' +
               '<span class="kicker">' + r.kind + '</span>' +
               '<span class="essay-card__date">' + r.date + (r.read ? ' &middot; ' + r.read : '') + '</span>' +
             '</div>' +
             '<h3 class="essay-card__title">' + r.title + '</h3>' +
             '<p class="essay-card__dek">' + r.summary + '</p>' +
             (tagSpans ? '<div class="essay-card__tags">' + tagSpans + '</div>' : '') +
           '</a>';
  }).join('');
  return '<div class="reader__related">' +
           '<h3 class="section__title section__title--sm">Related</h3>' +
           '<div class="grid grid--2">' + cards + '</div>' +
         '</div>';
}

/** The same relations again, as a terse list inside the sticky TOC aside. */
function renderReadNextHtml(related) {
  if (!related.length) return '';
  const items = related.map(function (r) {
    return '<li><a href="../../' + r.url + '">' + r.title + '</a></li>';
  }).join('');
  return '<div class="toc__aside">' +
           '<span class="kicker">Read next</span>' +
           '<ul class="toc__next">' + items + '</ul>' +
         '</div>';
}

/**
 * Build a kind index plus one page per tag.
 *
 * @param {object} ctx
 * @param {string} dir      Route segment, 'essays' or 'studies'.
 * @param {object[]} allItems
 * @param {object} meta     kicker, heading, dek, empty, kindLabel.
 */
function buildWritingIndex(ctx, dir, allItems, meta) {
  // --- the kind index: everything visible, "All" chip current ---------------
  ctx.emit(dir + '/index.html', 'writing-index', {
    items: allItems.map(function (it) { return Object.assign({}, it, { hiddenAttr: '' }); }),
    pageKicker: meta.kicker,
    pageHeading: meta.heading,
    pageDek: meta.dek,
    feedLinkHtml: renderFeedLinkHtml('feed.xml', meta.kindLabel),
    filterRowHtml: renderFilterRow(allItems, meta.kindLabel, '', null),
    emptyHtml: allItems.length === 0 ? '<p class="empty-state">' + meta.empty + '</p>' : '',
    basePath: '../',
    pageTitle: meta.heading + ', ' + ctx.site.title,
    pageDescription: meta.dek,
  });

  // --- one page per tag ----------------------------------------------------
  // Note the un-sorted tag list here: page ORDER doesn't matter (each is its own
  // file), only the chip bar needs a stable sort.
  collectTags(allItems).forEach(function (tag) {
    const slug = slugifyTag(tag);

    // Every item is present in the DOM; non-matching ones carry `hidden` so the
    // no-JS view shows only the tagged subset while the runtime can reveal them
    // instantly when another chip is picked.
    const tagged = allItems.map(function (it) {
      const matches = [it.tag1, it.tag2, it.tag3].indexOf(tag) !== -1;
      return Object.assign({}, it, { hiddenAttr: matches ? '' : 'hidden' });
    });
    const matchCount = tagged.filter(function (it) { return !it.hiddenAttr; }).length;

    ctx.emit(dir + '/tag/' + slug + '/index.html', 'writing-index', {
      items: tagged,
      pageKicker: meta.kicker,
      pageHeading: meta.heading + ' · ' + tag,
      pageDek: 'Filtered to ' + tag + '. ' + meta.dek,
      feedLinkHtml: renderFeedLinkHtml('../feed.xml', meta.kindLabel),
      filterRowHtml: renderFilterRow(allItems, meta.kindLabel, '../', tag),
      emptyHtml: matchCount === 0
        ? '<p class="empty-state">No ' + meta.kindLabel + ' tagged ' + tag + '.</p>'
        : '',
      basePath: '../../../',
      pageTitle: meta.heading + ' · ' + tag + ', ' + ctx.site.title,
      pageDescription: 'Filtered to ' + tag + '. ' + meta.dek,
    });
  });
}

/**
 * Build the reader page for each item of a kind.
 *
 * Series and "related" are mutually exclusive by design: related means "you
 * might also like this", series means "this is the next part of what you were
 * already reading". Showing both would compete for the same attention at the
 * foot of the page.
 *
 * @param {object} ctx
 * @param {string} dir   Route segment: 'essays', 'studies' or 'build'.
 * @param {object[]} items
 * @param {object} meta  backLabel, optional backHref and relatedPool.
 */
function buildWritingReader(ctx, dir, items, meta) {
  const { articles, seriesGroups } = ctx.content;

  items.forEach(function (item) {
    const inSeries = Boolean(item.series) && Boolean(seriesGroups[item.series]);

    // Related is drawn from the pool minus this piece, and minus anything that
    // belongs to a series — series parts have their own navigation and would
    // otherwise show up as loose recommendations mid-series.
    const pool = meta.relatedPool || articles;
    const related = pool.filter(function (a) {
      return a.slug !== item.slug && !a.series;
    }).slice(0, 2);

    ctx.emit(dir + '/' + item.slug + '/index.html', 'article', Object.assign({}, item, {
      basePath: '../../',
      backHref: meta.backHref || (dir + '/'),
      backLabel: meta.backLabel,
      relatedHtml: inSeries ? '' : renderRelatedHtml(related),
      readNextHtml: inSeries ? '' : renderReadNextHtml(related),
      seriesNavHtml: inSeries ? renderSeriesNavHtml(item, seriesGroups) : '',
      seriesPrevNextHtml: inSeries ? renderSeriesPrevNextHtml(item, seriesGroups) : '',
      pageTitle: item.title + ', ' + ctx.site.title,
      pageDescription: item.summary,
    }));
  });
}

module.exports = {
  collectTags,
  renderFilterRow,
  renderRelatedHtml,
  renderReadNextHtml,
  buildWritingIndex,
  buildWritingReader,
};
