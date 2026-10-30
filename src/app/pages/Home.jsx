/**
 * Home.jsx: /
 *
 * The launch homepage: hero plus the four most recent notes. The fuller version
 * (recent writing, projects, reading) is preserved in src/layouts/home.full.html
 * and isn't wired up yet.
 */

import { content, site } from '../content.js';
import Link from '../Link';
import FeedLink from '../components/FeedLink';
import { NoteItem } from '../components/NoteList';

const RECENT_NOTES = 4;

export default function Home() {
  return (
    <main id="main" className="home">
      <section className="hero">
        <p className="hero__lede">
          Notes and a few small projects on design as a form of <em>care</em>,
          by {site.ownerName}.
        </p>
        <p className="hero__body">
          I’m accessibility lead at Superhuman (formerly known as Grammarly).
          Most of what shows up here is about what happens when you treat design
          as care: for the people using the software, for the engineers building
          it, and for the systems that hold it all together.
        </p>
        <p className="hero__body">
          For years my online presence was rented space, social profiles and
          digital CVs on platforms I didn’t own. This site is me building a
          home on the internet instead. The foundation is my own, the creaky
          floorboards are ones I coded, and the front door is always open.
        </p>
        <p className="hero__body">
          It’s a place to slow down. A few of the longer rooms (essays,
          projects, the shelves) are still being arranged, but the notes are
          already here.
        </p>
        <div className="hero__cta">
          <Link className="btn btn--primary" to="/notes/">Read the notes</Link>
          <Link className="btn btn--ghost" to="/now/">What I’m up to now</Link>
        </div>
        <FeedLink href="/feed.xml" label="all updates" />
      </section>

      <section id="notes" className="container section">
        <header className="section__head">
          <h2 className="section__title">From the notebook</h2>
          <Link className="btn btn--link" to="/notes/">All notes</Link>
        </header>
        <ul className="note-list">
          {content.notes.slice(0, RECENT_NOTES).map((n) => (
            <NoteItem note={n} key={n.slug} />
          ))}
        </ul>
      </section>
    </main>
  );
}
