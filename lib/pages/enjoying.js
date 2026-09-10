'use strict';

/**
 * pages/enjoying.js — the cultural collections.
 *
 * Five kinds (reading, music, movies, podcasts, bookshelf) each get:
 *   /<kind>/            a flat index
 *   /<kind>/<slug>/     a reader with prev/next
 *
 * and all five are pooled into a paginated /enjoying/ stream, which is the page
 * the nav actually links to. Products join that pool too, even though their own
 * pages are built by pages/products.js — the stream is about what I'm enjoying,
 * and a recommended object belongs there as much as a record does.
 *
 * The per-kind indexes vary enough in markup (a spine for a book, a poster and
 * star rating for a film) that each supplies its own pre-rendered block, but
 * they share one emitter so the page-level plumbing is written once.
 */

const { ENJOYING_PER_PAGE } = require('../config');
const { renderFeedLinkHtml } = require('../render/helpers');

/**
 * Reader pages for one kind. Neighbours are collection order — filenames are
 * numbered, so that's chronological.
 */
function buildEntryPages(ctx, dir, items, layoutName) {
  if (!items.length) return;
  items.forEach(function (item, idx) {
    const prev = idx > 0 ? items[idx - 1] : null;
    const next = idx < items.length - 1 ? items[idx + 1] : null;
    // Slug and title only — enough for the nav links, and it stops a neighbour's
    // body leaking into this page through the merge.
    const brief = function (n) { return n ? { slug: n.slug, title: n.title } : null; };

    ctx.emit(dir + '/' + item.slug + '/index.html', layoutName, Object.assign({}, item, {
      prev: brief(prev),
      next: brief(next),
      basePath: '../../',
      pageTitle: item.title + ', ' + ctx.site.title,
      pageDescription: item.note || item.title,
    }));
  });
}

/**
 * One kind index. Skipped entirely when the kind is empty — an index page
 * listing nothing is worse than no page, and the nav item for it is off anyway.
 */
function writeKindIndex(ctx, dir, layoutName, data) {
  if (!data || !data.itemCount) return;
  ctx.emit(dir + '/index.html', layoutName, Object.assign({}, data, {
    feedLinkHtml: renderFeedLinkHtml('feed.xml', dir),
    basePath: '../',
    pageTitle: data.pageHeading + ', ' + ctx.site.title,
    pageDescription: data.pageDek,
  }));
}

/** The uniform card shape the /enjoying/ stream renders, whatever the kind. */
function enjoyingItem(kindLabel, kindPath, e, byline, subMeta) {
  return {
    kindLabel: kindLabel,
    kindPath: kindPath,
    slug: e.slug,
    title: e.title,
    byline: byline,
    subMeta: subMeta,
    note: e.note || '',
  };
}

/** Reading is grouped by status; this is the order those groups appear in. */
const READING_GROUPS = [
  { status: 'now', label: 'Now reading' },
  { status: 'next', label: 'Queued' },
  { status: 'done', label: 'Finished, recently' },
];

/** A book card on the reading index, with its coloured spine placeholder. */
function renderReadingBook(r) {
  return '<li>' +
           '<a class="book-card" href="../reading/' + r.slug + '/">' +
             '<div class="book-card__cover">' +
               '<div class="cover-placeholder cover-placeholder--book reading-card__spine reading-card__spine--' + r.spine + '">' +
                 '<span class="reading-card__spine-title">' + r.title + '</span>' +
               '</div>' +
             '</div>' +
             '<h4 class="book-card__title">' + r.title + '</h4>' +
             '<div class="book-card__author">' + r.author + '</div>' +
             '<p class="book-card__note">' + r.note + '</p>' +
           '</a>' +
         '</li>';
}

/** A book card on the bookshelf index — no spine colour, plus a year. */
function renderBookshelfBook(b) {
  return '<li>' +
           '<a class="book-card" href="../bookshelf/' + b.slug + '/">' +
             '<div class="book-card__cover">' +
               '<div class="cover-placeholder cover-placeholder--paper cover-placeholder--book">' +
                 b.title +
               '</div>' +
             '</div>' +
             '<h4 class="book-card__title">' + b.title + '</h4>' +
             '<div class="book-card__author">' + b.author +
               ' <span class="book-card__year">&middot; ' + b.year + '</span>' +
             '</div>' +
             '<p class="book-card__note">' + b.note + '</p>' +
           '</a>' +
         '</li>';
}

module.exports = {
  id: 'enjoying',
  label: 'reading, music, movies, podcasts, bookshelf and /enjoying/',

  run: function (ctx) {
    const { reading, music, movies, podcasts, bookshelf, products } = ctx.content;

    // --- readers -----------------------------------------------------------
    buildEntryPages(ctx, 'reading', reading, 'reading');
    buildEntryPages(ctx, 'music', music, 'music');
    buildEntryPages(ctx, 'movies', movies, 'movies');
    buildEntryPages(ctx, 'podcasts', podcasts, 'podcasts');
    buildEntryPages(ctx, 'bookshelf', bookshelf, 'bookshelf');

    // --- /reading/ ---------------------------------------------------------
    const readingGroupsHtml = READING_GROUPS.map(function (g) {
      const group = reading.filter(function (r) { return r.status === g.status; });
      if (!group.length) return '';
      return '<section class="reading-group">' +
               '<h3 class="notes-month__label">' + g.label +
                 ' <span class="reading-group__count">' + group.length + '</span>' +
               '</h3>' +
               '<ul class="book-grid">' + group.map(renderReadingBook).join('') + '</ul>' +
             '</section>';
    }).join('');

    writeKindIndex(ctx, 'reading', 'reading-index', {
      pageKicker: 'Reading',
      pageHeading: 'Reading list',
      pageDek: 'What’s on the shelf, what’s up next, and what I’ve recently finished. Updated when I remember, probably monthly.',
      groupsHtml: readingGroupsHtml,
      itemCount: reading.length,
    });

    // --- /music/, /movies/, /podcasts/ ------------------------------------
    // These three pass their items straight to the layout; the per-kind markup
    // differences live in the templates rather than here.
    writeKindIndex(ctx, 'music', 'music-index', {
      pageKicker: 'Music',
      pageHeading: 'Albums that mattered',
      pageDek: 'Not a scrobble feed, a short list of records that earned a permanent hold on my attention. Roughly chronological; lightly annotated.',
      items: music,
      itemCount: music.length,
    });

    writeKindIndex(ctx, 'movies', 'movies-index', {
      pageKicker: 'Movies',
      pageHeading: 'A viewing diary',
      pageDek: 'Most recent first. Five-star scale, honestly used. Re-watches marked in the note.',
      items: movies,
      itemCount: movies.length,
    });

    writeKindIndex(ctx, 'podcasts', 'podcasts-index', {
      pageKicker: 'Podcasts',
      pageHeading: 'In rotation',
      pageDek: 'What’s in the feed. Mostly craft and long-form interviews. I quit podcasts for years, this is the short list I came back to.',
      items: podcasts,
      itemCount: podcasts.length,
    });

    // --- /bookshelf/ -------------------------------------------------------
    // Grouped by section, in first-encounter order — which is filename order,
    // so the numbering in src/content/bookshelf/ controls the section sequence.
    const bookshelfSections = [];
    const bookshelfBySection = {};
    bookshelf.forEach(function (b) {
      if (!bookshelfBySection[b.section]) {
        bookshelfBySection[b.section] = { name: b.section, books: [] };
        bookshelfSections.push(bookshelfBySection[b.section]);
      }
      bookshelfBySection[b.section].books.push(b);
    });
    const bookshelfSectionsHtml = bookshelfSections.map(function (s) {
      return '<section class="bookshelf-section">' +
               '<h3 class="bookshelf-section__title">' + s.name + '</h3>' +
               '<ul class="book-grid">' + s.books.map(renderBookshelfBook).join('') + '</ul>' +
             '</section>';
    }).join('');

    writeKindIndex(ctx, 'bookshelf', 'bookshelf-index', {
      pageKicker: 'Bookshelf',
      pageHeading: 'Books that earned a permanent spot',
      pageDek: 'Separate from the current reading list. The shelf I carry between moves, books I reach for year after year, and the recent ones I already know I will.',
      sectionsHtml: bookshelfSectionsHtml,
      itemCount: bookshelf.length,
    });

    // --- /enjoying/, paginated --------------------------------------------
    // Every kind pooled into one stream. Products are included here but their
    // own pages belong to the products group; only `urlHost`, derived in
    // context.js, is needed, so this doesn't depend on that group having run.
    const enjoyingItems = [].concat(
      movies.map(function (m) { return enjoyingItem('Movie', 'movies', m, 'dir. ' + m.director, m.date); }),
      music.map(function (m) { return enjoyingItem('Music', 'music', m, m.artist, String(m.year)); }),
      reading.map(function (r) { return enjoyingItem('Reading', 'reading', r, r.author, r.statusLabel); }),
      podcasts.map(function (p) { return enjoyingItem('Podcast', 'podcasts', p, 'Host: ' + p.host, p.status); }),
      bookshelf.map(function (b) { return enjoyingItem('Bookshelf', 'bookshelf', b, b.author, b.section); }),
      products.map(function (p) { return enjoyingItem('Product', 'products', p, p.urlHost || '', p.price || ''); })
    );

    // Always at least one page, so /enjoying/ exists even with no entries.
    const totalPages = Math.max(1, Math.ceil(enjoyingItems.length / ENJOYING_PER_PAGE));

    for (let page = 1; page <= totalPages; page++) {
      const start = (page - 1) * ENJOYING_PER_PAGE;
      const slice = enjoyingItems.slice(start, start + ENJOYING_PER_PAGE);

      // Page 1 lives at /enjoying/, the rest at /enjoying/<n>/ — one level
      // deeper, so basePath and the pager hrefs both change.
      const basePath = page === 1 ? '../' : '../../';
      const relDir = page === 1 ? 'enjoying' : 'enjoying/' + page;

      /** A relative href from THIS page to page n. */
      function pageHref(n) {
        if (page === 1) return n === 1 ? '' : (String(n) + '/');
        return n === 1 ? '../' : ('../' + String(n) + '/');
      }

      ctx.emit(relDir + '/index.html', 'enjoying', {
        items: slice,
        pageNumber: page,
        totalPages: totalPages,
        prevHref: page > 1 ? pageHref(page - 1) : '',
        nextHref: page < totalPages ? pageHref(page + 1) : '',
        pageKicker: 'Enjoying',
        pageHeading: 'Enjoying',
        pageDek: 'Books, records, films, podcasts. The things I keep coming back to, lightly annotated.',
        basePath: basePath,
        pageTitle: (page === 1 ? 'Enjoying' : 'Enjoying, page ' + page) + ', ' + ctx.site.title,
        pageDescription: 'Reading, music, movies, podcasts, bookshelf, ' + ctx.site.ownerName + '.',
      });
    }
  },
};
