/**
 * Enjoying.jsx: the five cultural collections, their readers, and the pooled
 * /enjoying/ stream.
 *
 * Reading: music, movies, podcasts and bookshelf are the same idea with
 * different cards, so they share one module: an index component per kind
 * (because the markup genuinely differs, a spine for a book, a poster and star
 * rating for a film) over one shared page frame, and a single reader that takes
 * the kind-specific header from a lookup.
 *
 * Products join the pooled stream even though their own pages live in
 * Products.jsx: the stream is about what I'm enjoying, and a recommended object
 * belongs there as much as a record does.
 */

import { content } from '../content.js';
import { ENJOYING_PER_PAGE } from '../lib/content-model.js';
import Link from '../Link';
import { mdxComponents } from '../components/mdx';
import FeedLink from '../components/FeedLink';

const META = {
  reading: {
    kicker: 'Reading',
    heading: 'Reading list',
    dek: 'What’s on the shelf, what’s up next, and what I’ve recently finished. Updated when I remember, probably monthly.',
  },
  music: {
    kicker: 'Music',
    heading: 'Albums that mattered',
    dek: 'Not a scrobble feed, a short list of records that earned a permanent hold on my attention. Roughly chronological; lightly annotated.',
  },
  movies: {
    kicker: 'Movies',
    heading: 'A viewing diary',
    dek: 'Most recent first. Five-star scale, honestly used. Re-watches marked in the note.',
  },
  podcasts: {
    kicker: 'Podcasts',
    heading: 'In rotation',
    dek: 'What’s in the feed. Mostly craft and long-form interviews. I quit podcasts for years, this is the short list I came back to.',
  },
  bookshelf: {
    kicker: 'Bookshelf',
    heading: 'Books that earned a permanent spot',
    dek: 'Separate from the current reading list. The shelf I carry between moves, books I reach for year after year, and the recent ones I already know I will.',
  },
};

/** Reading is grouped by status; this is the order the groups appear in. */
const READING_GROUPS = [
  { status: 'now', label: 'Now reading' },
  { status: 'next', label: 'Queued' },
  { status: 'done', label: 'Finished, recently' },
];

/** The frame every kind index shares. */
function KindPage({ kind, children }) {
  const meta = META[kind];
  return (
    <main id="main">
      <div className="container--narrow section">
        <header className="page-header page-header--left">
          <span className="kicker">{meta.kicker}</span>
          <h1>{meta.heading}</h1>
          <p className="lead">{meta.dek}</p>
          <FeedLink href={`/${kind}/feed.xml`} label={kind} />
        </header>

        {children}

        <p className="kind-index__cross-link">
          Or browse <Link to="/enjoying/">everything in one stream ↗</Link>
        </p>
      </div>
    </main>
  );
}

function ReadingIndex() {
  return (
    <KindPage kind="reading">
      {READING_GROUPS.map((g) => {
        const group = content.reading.filter((r) => r.status === g.status);
        if (!group.length) return null;
        return (
          <section className="reading-group" key={g.status}>
            <h3 className="notes-month__label">
              {g.label} <span className="reading-group__count">{group.length}</span>
            </h3>
            <ul className="book-grid">
              {group.map((r) => (
                <li key={r.slug}>
                  <Link className="book-card" to={`/reading/${r.slug}/`}>
                    <div className="book-card__cover">
                      <div className={`cover-placeholder cover-placeholder--book reading-card__spine reading-card__spine--${r.spine}`}>
                        <span className="reading-card__spine-title">{r.title}</span>
                      </div>
                    </div>
                    <h4 className="book-card__title">{r.title}</h4>
                    <div className="book-card__author">{r.author}</div>
                    <p className="book-card__note">{r.note}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </KindPage>
  );
}

function MusicIndex() {
  return (
    <KindPage kind="music">
      <ul className="album-grid">
        {content.music.map((m) => (
          <li key={m.slug}>
            <Link className="album-card" to={`/music/${m.slug}/`}>
              <div className="album-card__cover">
                <div className="cover-placeholder cover-placeholder--paper cover-placeholder--square">{m.title}</div>
              </div>
              <div className="album-card__meta">
                <span className="album-card__year">{m.year}</span>
                {m.tag && <span className="album-card__tag">&middot; {m.tag}</span>}
              </div>
              <h3 className="album-card__title">{m.title}</h3>
              <div className="album-card__artist">{m.artist}</div>
              <p className="album-card__note">{m.note}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="t-small t-small--subtle t-small--centered kind-index__archive-line">
        ❦ Forty-odd more on the long list, pruned out of kindness ❦
      </p>
    </KindPage>
  );
}

function MoviesIndex() {
  return (
    <KindPage kind="movies">
      <ul className="movies-diary">
        {content.movies.map((m) => (
          <li key={m.slug}>
            <Link className="movie-row" to={`/movies/${m.slug}/`}>
              <div className="movie-row__poster">
                <div className="cover-placeholder cover-placeholder--paper cover-placeholder--poster">{m.title}</div>
              </div>
              <div className="movie-row__body">
                <span className="movie-row__date">{m.date}</span>
                <h3 className="movie-row__title">{m.title} <em>({m.year})</em></h3>
                <div className="movie-row__director">dir. {m.director}</div>
                <p className="movie-row__note">{m.note}</p>
              </div>
              {/* role="img" + aria-label rather than the bare <div> the old
                  template had, which carried a TODO saying exactly this. A
                  plain div can't take an accessible name, so the rating was
                  invisible to assistive tech. The glyphs stay aria-hidden so it
                  isn't announced as ten separate star characters. */}
              <div className="movie-row__rating" role="img" aria-label={`${m.ratingValue} out of 5`}>
                <span aria-hidden="true">{m.stars}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </KindPage>
  );
}

function PodcastsIndex() {
  return (
    <KindPage kind="podcasts">
      <ul className="podcast-grid">
        {content.podcasts.map((p) => (
          <li key={p.slug}>
            <Link className="podcast-card" to={`/podcasts/${p.slug}/`}>
              <div className="podcast-card__cover">
                <div className="cover-placeholder cover-placeholder--paper cover-placeholder--square">{p.title}</div>
              </div>
              <div className="podcast-card__body">
                <h3 className="podcast-card__title">{p.title}</h3>
                <div className="podcast-card__host">{p.host}</div>
                <p className="podcast-card__note">{p.note}</p>
                <span className="podcast-card__status">&middot; {p.status}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </KindPage>
  );
}

function BookshelfIndex() {
  // Grouped by section in first-encounter order, which is filename order, so
  // the numbering in src/content/bookshelf/ controls the section sequence.
  const sections = [];
  const bySection = {};
  content.bookshelf.forEach((b) => {
    if (!bySection[b.section]) {
      bySection[b.section] = { name: b.section, books: [] };
      sections.push(bySection[b.section]);
    }
    bySection[b.section].books.push(b);
  });

  return (
    <KindPage kind="bookshelf">
      {sections.map((s) => (
        <section className="bookshelf-section" key={s.name}>
          <h3 className="bookshelf-section__title">{s.name}</h3>
          <ul className="book-grid">
            {s.books.map((b) => (
              <li key={b.slug}>
                <Link className="book-card" to={`/bookshelf/${b.slug}/`}>
                  <div className="book-card__cover">
                    <div className="cover-placeholder cover-placeholder--paper cover-placeholder--book">{b.title}</div>
                  </div>
                  <h4 className="book-card__title">{b.title}</h4>
                  <div className="book-card__author">
                    {b.author} <span className="book-card__year">&middot; {b.year}</span>
                  </div>
                  <p className="book-card__note">{b.note}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </KindPage>
  );
}

const INDEXES = {
  reading: ReadingIndex,
  music: MusicIndex,
  movies: MoviesIndex,
  podcasts: PodcastsIndex,
  bookshelf: BookshelfIndex,
};

export function KindIndex({ route }) {
  const Component = INDEXES[route.slice(1, -1)];
  return <Component />;
}

/**
 * The modifier class on a reader `<article>`, per kind.
 *
 * Deliberately a lookup rather than `${kind}-reader`: two of the collection
 * keys are plural but their CSS hooks are singular (`movie-reader__year` in
 * site.css is the one with rules behind it today). Interpolating the key
 * directly silently renames those hooks, so the table is the contract.
 */
const READER_CLASS = {
  reading: 'reading-reader',
  music: 'music-reader',
  movies: 'movie-reader',
  podcasts: 'podcast-reader',
  bookshelf: 'bookshelf-reader',
};

/** The kind-specific kickers, title, meta line and cover of a reader page. */
function readerHead(kind, e) {
  if (kind === 'reading') {
    return {
      kickers: [
        <span className="kicker" key="k">Reading</span>,
        <span className="kicker" key="s">&middot; {e.statusLabel}</span>,
      ],
      title: e.title,
      meta: <span className="kicker">{e.author}</span>,
      cover: (
        <div className="book-card book-card--single cover-frame cover-frame--book">
          <div className="book-card__cover">
            <div className={`cover-placeholder cover-placeholder--book reading-card__spine reading-card__spine--${e.spine}`}>
              <span className="reading-card__spine-title">{e.title}</span>
            </div>
          </div>
        </div>
      ),
    };
  }

  if (kind === 'music') {
    return {
      kickers: [
        <span className="kicker" key="k">Music</span>,
        <span className="kicker" key="y">&middot; {e.year}</span>,
        ...(e.tag ? [<span className="kicker" key="t">&middot; {e.tag}</span>] : []),
      ],
      title: e.title,
      meta: <span className="kicker">{e.artist}</span>,
      cover: (
        <div className="album-card album-card--single cover-frame cover-frame--album">
          <div className="album-card__cover">
            <div className="cover-placeholder cover-placeholder--paper cover-placeholder--square">{e.title}</div>
          </div>
        </div>
      ),
    };
  }

  if (kind === 'movies') {
    return {
      kickers: [
        <span className="kicker" key="k">Movie</span>,
        <span className="kicker" key="d">&middot; {e.date}</span>,
      ],
      title: <>{e.title} <em className="movie-reader__year">({e.year})</em></>,
      meta: (
        <>
          <span className="kicker">dir. {e.director}</span>
          <span className="kicker">
            &middot;{' '}
            <span className="movie-row__rating" role="img" aria-label={`${e.ratingValue} out of 5`}>
              <span aria-hidden="true">{e.stars}</span>
            </span>
          </span>
        </>
      ),
      cover: (
        <div className="movie-row__poster cover-frame cover-frame--poster">
          <div className="cover-placeholder cover-placeholder--paper cover-placeholder--poster">{e.title}</div>
        </div>
      ),
    };
  }

  if (kind === 'podcasts') {
    return {
      kickers: [
        <span className="kicker" key="k">Podcast</span>,
        ...(e.status ? [<span className="kicker" key="s">&middot; {e.status}</span>] : []),
      ],
      title: e.title,
      meta: <span className="kicker">Host: {e.host}</span>,
      cover: (
        <div className="podcast-card podcast-card--single cover-frame cover-frame--podcast">
          <div className="podcast-card__cover">
            <div className="cover-placeholder cover-placeholder--paper cover-placeholder--square">{e.title}</div>
          </div>
        </div>
      ),
    };
  }

  return {
    kickers: [
      <span className="kicker" key="k">Bookshelf</span>,
      <span className="kicker" key="s">&middot; {e.section}</span>,
      ...(e.year ? [<span className="kicker" key="y">&middot; {e.year}</span>] : []),
    ],
    title: e.title,
    meta: <span className="kicker">{e.author}</span>,
    cover: (
      <div className="book-card book-card--single cover-frame cover-frame--book">
        <div className="book-card__cover">
          <div className="cover-placeholder cover-placeholder--paper cover-placeholder--book">{e.title}</div>
        </div>
      </div>
    ),
  };
}

export function KindReader({ route }) {
  const [kind, slug] = route.slice(1, -1).split('/');
  const items = content[kind];
  const idx = items.findIndex((e) => e.slug === slug);
  const entry = items[idx];
  if (!entry) {
    return <main id="main"><div className="container section"><h1>Not found</h1></div></main>;
  }

  const prev = idx > 0 ? items[idx - 1] : null;
  const next = idx < items.length - 1 ? items[idx + 1] : null;
  const head = readerHead(kind, entry);

  return (
    <main id="main">
      <article className={`container--narrow section reader reader--wide ${READER_CLASS[kind]}`}>
        <Link className="btn btn--link reader__back" to="/enjoying/">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" /></svg>
          <span className="reader__back-label">All enjoying</span>
        </Link>

        <header className="reader__head">
          <div className="reader__kicker">{head.kickers}</div>
          <h1>{head.title}</h1>
          <div className="reader__meta">{head.meta}</div>
        </header>

        {head.cover}

        <div className="prose">
          <p className="lead">{entry.note}</p>
          <entry.Body components={mdxComponents} />
        </div>

        <nav className="note-reader__nav" aria-label="Between entries">
          <div>
            {prev && (
              <Link to={`/${kind}/${prev.slug}/`} className="note-reader__nav-link">
                <span className="kicker">&larr; Earlier</span>
                <span>{prev.title}</span>
              </Link>
            )}
          </div>
          <div className="note-reader__nav-right">
            {next && (
              <Link to={`/${kind}/${next.slug}/`} className="note-reader__nav-link note-reader__nav-link--right">
                <span className="kicker">Later &rarr;</span>
                <span>{next.title}</span>
              </Link>
            )}
          </div>
        </nav>
      </article>
    </main>
  );
}

/** The uniform card the pooled stream renders, whatever the kind. */
function streamItem(kindLabel, kindPath, e, byline, subMeta) {
  return { kindLabel, kindPath, slug: e.slug, title: e.title, byline, subMeta, note: e.note || '' };
}

export function Enjoying({ route }) {
  const segments = route.slice(1, -1).split('/');
  const page = segments.length > 1 ? parseInt(segments[1], 10) : 1;

  const items = [
    ...content.movies.map((m) => streamItem('Movie', 'movies', m, `dir. ${m.director}`, m.date)),
    ...content.music.map((m) => streamItem('Music', 'music', m, m.artist, String(m.year))),
    ...content.reading.map((r) => streamItem('Reading', 'reading', r, r.author, r.statusLabel)),
    ...content.podcasts.map((p) => streamItem('Podcast', 'podcasts', p, `Host: ${p.host}`, p.status)),
    ...content.bookshelf.map((b) => streamItem('Bookshelf', 'bookshelf', b, b.author, b.section)),
    ...content.products.map((p) => streamItem('Product', 'products', p, p.urlHost || '', p.price || '')),
  ];

  const totalPages = Math.max(1, Math.ceil(items.length / ENJOYING_PER_PAGE));
  const slice = items.slice((page - 1) * ENJOYING_PER_PAGE, page * ENJOYING_PER_PAGE);

  return (
    <main id="main">
      <div className="container--narrow section">
        <header className="page-header page-header--left">
          <span className="kicker">Enjoying</span>
          <h1>Enjoying</h1>
          <p className="lead">
            Books, records, films, podcasts. The things I keep coming back to, lightly annotated.
          </p>
        </header>

        <ul className="essay-list enjoying-list">
          {slice.map((item) => (
            <li className="essay-card enjoying-card" key={`${item.kindPath}-${item.slug}`}>
              <Link className="essay-card__link" to={`/${item.kindPath}/${item.slug}/`}>
                <div className="essay-card__meta">
                  <span className="kicker">{item.kindLabel}</span>
                  {item.subMeta && <span className="essay-card__date">&middot; {item.subMeta}</span>}
                </div>
                <h3 className="essay-card__title">{item.title}</h3>
                <div className="essay-card__author">{item.byline}</div>
                <p className="essay-card__dek">{item.note}</p>
              </Link>
            </li>
          ))}
        </ul>

        <nav className="enjoying-pagination" aria-label="Enjoying pagination">
          <div>
            {page > 1 && (
              <Link className="btn btn--link" to={page === 2 ? '/enjoying/' : `/enjoying/${page - 1}/`}>
                <span className="kicker">&larr; Newer</span>
              </Link>
            )}
          </div>
          <div className="t-small enjoying-pagination__status">
            Page {page} of {totalPages}
          </div>
          <div>
            {page < totalPages && (
              <Link className="btn btn--link" to={`/enjoying/${page + 1}/`}>
                <span className="kicker">Older &rarr;</span>
              </Link>
            )}
          </div>
        </nav>
      </div>
    </main>
  );
}
