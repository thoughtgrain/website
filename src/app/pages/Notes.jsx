/**
 * Notes.jsx — /notes/
 */

import { content } from '../content.js';
import FeedLink from '../components/FeedLink';
import NoteList from '../components/NoteList';

export default function Notes() {
  return (
    <main id="main">
      <div className="container--narrow section">
        <header className="page-header page-header--left">
          <span className="kicker">Notes</span>
          <h1>Notes</h1>
          <p className="lead">
            Short thoughts and unfinished fragments. Published as they happen, mostly
            unedited. If an essay is a paragraph, a note is a sentence.
          </p>
          <FeedLink href="/notes/feed.xml" label="notes" />
        </header>

        <NoteList groups={content.notesGroups} />

        <p className="t-small notes-archive-line">
          ❦ older notes in <a href="#">the archive</a> ❦
        </p>
      </div>
    </main>
  );
}
