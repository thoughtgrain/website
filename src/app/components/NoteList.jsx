/**
 * NoteList.jsx: the month-grouped notes list.
 *
 * Shared by /notes/ and the homepage, which is why it isn't inside either. A
 * note is either a short text fragment or an image with an optional caption;
 * when it has both, the caption falls back to the text lede, so an image note
 * can still carry a sentence of context.
 */

import Link from '../Link';
import Html from './Html';

export function NoteItem({ note }) {
  const alt = note.imageAlt || note.caption || note.title || '';
  const caption = note.caption || note.lede || '';

  return (
    <li className={`note-item${note.image ? ' note-item--image' : ''}`}>
      <span className="note-item__date">{note.date}</span>
      <div>
        <Link to={`/notes/${note.slug}/`} className="note-item__link">
          {note.image ? (
            <figure className="note-item__figure">
              <img src={note.image} alt={alt} loading="lazy" />
              {caption && <Html as="figcaption" className="note-item__caption" html={caption} />}
            </figure>
          ) : (
            <p className="note-item__body">{note.lede}</p>
          )}
        </Link>
        {note.context && <div className="note-item__context">{note.context}</div>}
      </div>
    </li>
  );
}

export default function NoteList({ groups }) {
  return groups.map((group) => (
    <section className="notes-month" key={group.month}>
      <h3 className="notes-month__label">{group.month}</h3>
      <ul className="note-list">
        {group.notes.map((n) => <NoteItem note={n} key={n.slug} />)}
      </ul>
    </section>
  ));
}
