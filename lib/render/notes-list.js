'use strict';

/**
 * render/notes-list.js — the grouped notes list.
 *
 * Shared by the /notes/ index and the homepage, which is why it isn't inside
 * pages/notes.js. Both render the same month-grouped list; only the href prefix
 * differs, because the homepage sits one level shallower.
 *
 * A note is either a short text fragment (its first paragraph, from the MDX
 * body) or an image with an optional caption. When a note has both an image and
 * body text, the caption falls back to the text lede — so an image note can
 * still carry a sentence of context.
 */

/**
 * Render one note as a list item.
 *
 * @param {object} n Parsed note, after the lede split in context.js.
 * @param {string} hrefPrefix Depth prefix for the link.
 * @returns {string}
 */
function renderNoteItem(n, hrefPrefix) {
  var href = hrefPrefix + 'notes/' + n.slug + '/';
  var inner;
  if (n.image) {
    var alt = (n.imageAlt || n.caption || n.title || '').replace(/"/g, '&quot;');
    var captionHtml = n.caption || n.ledeHtml || '';
    inner = '<figure class="note-item__figure">' +
              '<img src="' + n.image + '" alt="' + alt + '" loading="lazy" />' +
              (captionHtml ? '<figcaption class="note-item__caption">' + captionHtml + '</figcaption>' : '') +
            '</figure>';
  } else {
    inner = '<p class="note-item__body">' + n.ledeHtml + '</p>';
  }
  return '<li class="note-item' + (n.image ? ' note-item--image' : '') + '">' +
           '<span class="note-item__date">' + n.date + '</span>' +
           '<div>' +
             '<a href="' + href + '" class="note-item__link">' + inner + '</a>' +
             (n.context ? '<div class="note-item__context">' + n.context + '</div>' : '') +
           '</div>' +
         '</li>';
}

/**
 * Render every month group as a section.
 *
 * @param {Array<{month: string, notes: object[]}>} notesGroups
 * @param {string} hrefPrefix Depth prefix, passed straight to renderNoteItem.
 * @returns {string}
 */
function renderNotesGroups(notesGroups, hrefPrefix) {
  return notesGroups.map(function (g) {
    return '<section class="notes-month">' +
             '<h3 class="notes-month__label">' + g.month + '</h3>' +
             '<ul class="note-list">' +
               g.notes.map(function (n) { return renderNoteItem(n, hrefPrefix); }).join('') +
             '</ul>' +
           '</section>';
  }).join('\n');
}

module.exports = { renderNoteItem, renderNotesGroups };
