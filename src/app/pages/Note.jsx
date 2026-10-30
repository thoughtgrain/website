/**
 * Note.jsx: /notes/:slug/
 *
 * The collection is newest-first, so "earlier" is the NEXT index and "later" is
 * the previous one. Worth stating because the variable names read backwards
 * otherwise.
 */

import { content } from '../content.js';
import Link from '../Link';
import { mdxComponents } from '../components/mdx';

const RELATED_COUNT = 3;

export default function Note({ route }) {
  const slug = route.split('/').filter(Boolean)[1];
  const idx = content.notes.findIndex((n) => n.slug === slug);
  const note = content.notes[idx];
  if (!note) return <main id="main"><div className="container--narrow section"><h1>Not found</h1></div></main>;

  const later = idx > 0 ? content.notes[idx - 1] : null;
  const earlier = idx < content.notes.length - 1 ? content.notes[idx + 1] : null;
  const related = content.notes.filter((_, i) => i !== idx).slice(0, RELATED_COUNT);

  return (
    <main id="main">
      <article id={note.slug} className="container--narrow section note-reader">
        <Link className="btn btn--link reader__back" to="/notes/">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" /></svg>
          <span className="reader__back-label">All notes</span>
        </Link>

        <header className="note-reader__head">
          <div className="note-reader__meta">
            <span className="kicker">Note</span>
            <span className="kicker">&middot; {note.date}</span>
            {note.context && <span className="kicker">&middot; {note.context}</span>}
          </div>
          <h1 className="note-reader__title">{note.title}.</h1>
        </header>

        <div className="note-reader__body prose">
          {note.image && (
            <figure className="note-reader__figure">
              <img src={note.image} alt={note.imageAlt} width={note.imageWidth} height={note.imageHeight} loading="lazy" decoding="async" />
              {note.caption && <figcaption className="note-reader__caption">{note.caption}</figcaption>}
            </figure>
          )}
          {note.lede && <p className="note-reader__lede">{note.lede}</p>}
          <note.Body components={mdxComponents} />
          <hr className="note-reader__rule" />
          <p className="note-reader__sign">
            Filed under <em>{note.context}</em>. Permalink <a href={`#${note.slug}`}>#{note.slug}</a>.
          </p>
        </div>

        <nav className="note-reader__nav" aria-label="Between notes">
          <div>
            {earlier && (
              <Link to={`/notes/${earlier.slug}/`} className="note-reader__nav-link">
                <span className="kicker">&larr; Earlier</span>
                <span>{earlier.title}</span>
              </Link>
            )}
          </div>
          <div className="note-reader__nav-right">
            {later && (
              <Link to={`/notes/${later.slug}/`} className="note-reader__nav-link note-reader__nav-link--right">
                <span className="kicker">Later &rarr;</span>
                <span>{later.title}</span>
              </Link>
            )}
          </div>
        </nav>

        <aside className="note-reader__related">
          <span className="kicker">Nearby notes</span>
          <ul className="note-reader__related-list">
            {related.map((r) => (
              <li key={r.slug}>
                <Link to={`/notes/${r.slug}/`}>
                  <span className="t-small t-caps note-reader__related-date">{r.date}</span>
                  <span>{r.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </article>
    </main>
  );
}
