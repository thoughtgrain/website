'use strict';

/**
 * pages/home.js — the homepage.
 *
 * A digest rather than a section index: the three most recent articles, up to
 * two projects that are actually live, and the four newest notes. Everything it
 * shows already exists on a dedicated page elsewhere; this is the front door.
 */

const { renderNoteItem } = require('../render/notes-list');

// How many of each kind the front page shows before you have to go to the
// section index. Small on purpose — the homepage is a doorway, not an archive.
const RECENT_ARTICLES = 3;
const RECENT_PROJECTS = 2;
const RECENT_NOTES = 4;

// Projects worth surfacing on the homepage: the ones with momentum. A shipped
// or shelved project is still on /projects/, just not out front.
const LIVE_STATUS = /In progress|Ongoing|Maintained/i;

module.exports = {
  id: 'home',
  label: 'The homepage',

  // Which manifest sections this group reads, so `next` can rebuild what you
  // actually changed instead of walking the list from the top.
  // The homepage digests three collections; it shows nothing else.
  inputs: ['articles', 'projects', 'notes'],

  run: function (ctx) {
    const { articles, projects, notes } = ctx.content;

    // The homepage sits at the root, so note links need no depth prefix — hence
    // the empty hrefPrefix, versus '../' from /notes/.
    const homeNotesHtml = '<ul class="note-list">' +
      notes.slice(0, RECENT_NOTES).map(function (n) { return renderNoteItem(n, ''); }).join('') +
      '</ul>';

    ctx.emit('index.html', 'home', {
      recentArticles: articles.slice(0, RECENT_ARTICLES),
      articleCount: articles.length,
      homeProjects: projects.filter(function (p) {
        return p.status && LIVE_STATUS.test(p.status);
      }).slice(0, RECENT_PROJECTS),
      projectCount: projects.length,
      homeNotesHtml: homeNotesHtml,
      feedLinkHtml: ctx.helpers.renderFeedLinkHtml('feed.xml', 'all updates'),
      basePath: '',
      pageTitle: ctx.site.title,
      pageDescription: ctx.site.description,
    });
  },
};
