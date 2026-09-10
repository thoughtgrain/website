'use strict';

/**
 * pages/notes.js — /notes/ and each note's own page.
 *
 * Notes are the site's short form: a fragment, a photograph, an unfinished
 * thought. They're grouped by month on the index and each gets a permalink with
 * older/newer navigation.
 *
 * Ordering note: the collection is newest-first (filenames are numbered to make
 * it so), which is why `prev` is the LATER index and `next` the earlier one —
 * "previous" means previous in reading order, i.e. older.
 */

const { renderNotesGroups } = require('../render/notes-list');

// How many sibling notes to offer at the foot of a note page.
const RELATED_COUNT = 3;

module.exports = {
  id: 'notes',
  label: '/notes/ and note permalinks',

  run: function (ctx) {
    const { notes, notesGroups } = ctx.content;

    // --- /notes/ ----------------------------------------------------------
    ctx.emit('notes/index.html', 'notes', {
      notesGroupsHtml: renderNotesGroups(notesGroups, '../'),
      feedLinkHtml: ctx.helpers.renderFeedLinkHtml('feed.xml', 'notes'),
      basePath: '../',
      pageTitle: 'Notes, ' + ctx.site.title,
      pageDescription: 'Short thoughts and unfinished fragments by ' + ctx.site.ownerName + '.',
    });

    // --- /notes/<slug>/ ---------------------------------------------------
    notes.forEach(function (note, idx) {
      const newer = idx > 0 ? notes[idx - 1] : null;
      const older = idx < notes.length - 1 ? notes[idx + 1] : null;

      // Everything except this note, capped. Not clever — notes are short and
      // there aren't many, so recency is as good a relation as any.
      const related = notes.filter(function (n, i) { return i !== idx; }).slice(0, RELATED_COUNT);

      // Only the three fields the template needs, so the nav can't accidentally
      // inherit the neighbour's body or footnotes through the merge below.
      const brief = function (n) {
        return n ? { slug: n.slug, title: n.title, date: n.date } : null;
      };

      ctx.emit('notes/' + note.slug + '/index.html', 'note', Object.assign({}, note, {
        prev: brief(older),
        next: brief(newer),
        related: related.map(brief),
        basePath: '../../',
        pageTitle: note.title + ', ' + ctx.site.title,
        pageDescription: note.title,
      }));
    });
  },
};
