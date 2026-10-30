/**
 * Article.jsx — the reader for essays, studies and build-series posts.
 *
 * All three are the same page with different copy and a different back link,
 * which is why `kind` routes them (content-model.js) but doesn't fork them here.
 *
 * Series and "related" are mutually exclusive by design: related means "you
 * might also like this", series means "this is the next part of what you were
 * already reading". Showing both would have them compete for the same attention
 * at the foot of the page.
 */

import { content } from '../content.js';
import Link from '../Link.jsx';
import Html from '../components/Html.jsx';

const RELATED_COUNT = 2;

const BACK = {
  essays: { href: '/essays/', label: 'All essays' },
  studies: { href: '/studies/', label: 'All studies' },
  build: { href: '/colophon/', label: 'Back to colophon' },
};

/** The "Part 3 of 5" contents list, shown on any article that belongs to one. */
function SeriesNav({ article }) {
  const parts = content.seriesGroups[article.series];
  if (!parts) return null;

  const idx = parts.findIndex((p) => p.slug === article.slug);
  const caption = idx >= 0 ? `Part ${idx + 1} of ${parts.length}` : `${parts.length} parts`;

  return (
    <aside className="series-nav" aria-label={`${article.series} series navigation`}>
      <div className="series-nav__caption">
        <span className="kicker">Series</span>
        <span className="series-nav__meta">{caption} in <em>{article.series}</em></span>
      </div>
      <ol className="series-nav__list">
        {parts.map((p) => {
          const current = p.slug === article.slug;
          // Drop the series prefix from the title — it's already in the caption,
          // and repeating it on every row makes the list unreadable.
          const label = p.title
            .replace(new RegExp(`^${article.series},?\\s*`, 'i'), '')
            .replace(/^part\s+\d+:\s*/i, '');
          const num = p.seriesPart ? String(p.seriesPart).padStart(2, '0') : '';

          const inner = (
            <>
              <span className="series-nav__num">{num}</span>
              <span className="series-nav__body">
                <span className="series-nav__title">{label}</span>
              </span>
              {current && <span className="series-nav__here" aria-label="You are here">You are here</span>}
            </>
          );

          return (
            <li className={`series-nav__row${current ? ' is-current' : ''}`} key={p.slug}>
              {current
                ? <span className="series-nav__link" aria-current="page">{inner}</span>
                : <Link className="series-nav__link" to={p.url}>{inner}</Link>}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/** Previous / next within the series, at the foot of the reader. */
function SeriesPrevNext({ article }) {
  const parts = content.seriesGroups[article.series];
  if (!parts) return null;

  const idx = parts.findIndex((p) => p.slug === article.slug);
  const prev = idx > 0 ? parts[idx - 1] : null;
  const next = idx >= 0 && idx < parts.length - 1 ? parts[idx + 1] : null;
  if (!prev && !next) return null;

  const strip = (t) => t.replace(/^.*part \d+:\s*/i, '');

  return (
    <nav className="series-prevnext" aria-label="Series navigation">
      {prev ? (
        <Link className="series-prevnext__link series-prevnext__link--prev" to={prev.url}>
          <span className="kicker">Previous</span>
          <span className="series-prevnext__title">{strip(prev.title)}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link className="series-prevnext__link series-prevnext__link--next" to={next.url}>
          <span className="kicker">Next</span>
          <span className="series-prevnext__title">{strip(next.title)}</span>
        </Link>
      ) : <span />}
    </nav>
  );
}

/** Compact cards under the body, for articles with no series. */
function Related({ items }) {
  if (!items.length) return null;
  return (
    <div className="reader__related">
      <h3 className="section__title section__title--sm">Related</h3>
      <div className="grid grid--2">
        {items.map((r) => (
          <Link className="essay-card essay-card--compact" to={r.url} key={r.slug}>
            <div className="essay-card__meta">
              <span className="kicker">{r.kind}</span>
              <span className="essay-card__date">{r.date}{r.read ? ` · ${r.read}` : ''}</span>
            </div>
            <h3 className="essay-card__title">{r.title}</h3>
            <p className="essay-card__dek">{r.summary}</p>
            {r.tagList.length > 0 && (
              <div className="essay-card__tags">
                {r.tagList.map((t) => <span className="tag" key={t}>{t}</span>)}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Article({ route }) {
  const [dir, slug] = route.slice(1, -1).split('/');
  const article = content.articles.find((a) => a.dir === dir && a.slug === slug);
  if (!article) {
    return <main id="main"><div className="container section"><h1>Not found</h1></div></main>;
  }

  const inSeries = Boolean(article.series && content.seriesGroups[article.series]);

  // Related is drawn from the same pool minus this piece, and minus anything in
  // a series — series parts have their own navigation and would otherwise turn
  // up as loose recommendations mid-series.
  const pool = dir === 'build' ? content.buildSeries : content.articles;
  const related = inSeries
    ? []
    : pool.filter((a) => a.slug !== article.slug && !a.series).slice(0, RELATED_COUNT);

  const back = BACK[dir] || BACK.essays;

  return (
    <main id="main">
      <div className="reader-with-toc">
        <article className="reader">
          <Link className="btn btn--link reader__back" to={back.href}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" /></svg>
            <span className="reader__back-label">{back.label}</span>
          </Link>

          <div className="reader__kicker"><span className="kicker">{article.kind}</span></div>
          <h1>{article.title}</h1>
          <p className="reader__dek">{article.summary}</p>
          <div className="reader__meta">
            <span className="kicker">{article.date}</span>
            {article.read && <span className="kicker">&middot; {article.read}</span>}
            {article.tagList.map((t) => <span className="kicker" key={t}>&middot; {t}</span>)}
          </div>

          {inSeries && <SeriesNav article={article} />}
          <Html className="reader__body prose" html={article.bodyHtml} />
          {inSeries && <SeriesPrevNext article={article} />}
          {!inSeries && <Related items={related} />}
        </article>

        {article.toc && (
          <aside className="toc" aria-label="Table of contents">
            <div className="toc__title">In this essay</div>
            <ol>
              {article.toc.map((t) => (
                <li key={t.id}><a href={`#${t.id}`}>{t.label}</a></li>
              ))}
            </ol>
            {!inSeries && related.length > 0 && (
              <div className="toc__aside">
                <span className="kicker">Read next</span>
                <ul className="toc__next">
                  {related.map((r) => (
                    <li key={r.slug}><Link to={r.url}>{r.title}</Link></li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}
