'use strict';

/**
 * pages/projects.js — /projects/, its category pages, and each project reader.
 *
 * Projects are organised two ways at once, on purpose:
 *
 *   - by LIFECYCLE on the index (In flight / Shipped / Paused), because the
 *     first question about someone's project list is "what's still alive";
 *   - by CATEGORY at /projects/cat/<slug>/, for people who came looking for one
 *     kind of work.
 *
 * The index is the catch-all; category pages are a filtered view of the same
 * tiles, rendered statically so they work without JS.
 */

const { renderFeedLinkHtml } = require('../render/helpers');

/**
 * Lifecycle buckets, in display order. The `status:` frontmatter field is free
 * text (and may carry a leading symbol), so it's matched loosely rather than
 * compared exactly.
 */
const PROJECT_GROUPS = [
  { key: 'in-flight', label: 'In flight' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'paused', label: 'Paused' },
];

/**
 * Categories at /projects/cat/<slug>/. These are a fixed list rather than
 * derived from the content: the pages exist even when empty, so a link in the
 * menu never 404s while a category is still being filled.
 */
const MAKING_CATEGORIES = [
  { slug: 'code', label: 'Code', dek: 'Software, libraries, scripts, and other things made by typing.' },
  { slug: 'accessibility', label: 'Accessibility', dek: 'A11y work, audits, contrast tools, and pieces of the practice.' },
  { slug: 'hardware', label: 'Hardware', dek: 'Physical objects, instruments, and circuits.' },
  { slug: 'design', label: 'Design', dek: 'Visual work, type, identity, posters, and illustration.' },
  { slug: 'experiments', label: 'Experiments', dek: 'Smaller scratch builds, prototypes, and weekend things.' },
];

/** Map a free-text status onto one of the three lifecycle buckets. */
function projectStatusBucket(status) {
  const s = String(status || '').toLowerCase();
  if (/in progress|ongoing|maintained/.test(s)) return 'in-flight';
  if (/shipped/.test(s)) return 'shipped';
  if (/paused|shelved|archived/.test(s)) return 'paused';
  // Untagged work is treated as live rather than hidden — a missing status is
  // far more likely to mean "I forgot" than "this is dead".
  return 'in-flight';
}

/**
 * One project tile. Everything here is escaped because it comes straight from
 * frontmatter without passing through the markdown or template layers.
 */
function renderProjectTile(escapeHtml, p) {
  return '<a class="project-tile" href="../projects/' + p.slug + '/">' +
           '<div class="project-tile__plate project-tile__plate--' + (p.plate || 'cocoa') + '">' +
             '<div class="project-tile__glyph">' + escapeHtml(p.glyph || '') + '</div>' +
             '<div class="project-tile__plate-label">' + escapeHtml(p.label || '') + '</div>' +
           '</div>' +
           '<div class="project-tile__body">' +
             '<div class="project-tile__meta">' +
               '<span class="kicker">' + escapeHtml(p.status || '') + '</span>' +
               '<span class="project-tile__year">' + escapeHtml(p.year || '') + '</span>' +
             '</div>' +
             '<h4 class="project-tile__title">' + escapeHtml(p.title || '') + '</h4>' +
             '<p class="project-tile__blurb">' + escapeHtml(p.summary || '') + '</p>' +
           '</div>' +
         '</a>';
}

/** Group a project list by lifecycle. Empty buckets render nothing at all. */
function renderProjectGroupsHtml(escapeHtml, list) {
  return PROJECT_GROUPS.map(function (g) {
    const members = list.filter(function (p) { return projectStatusBucket(p.status) === g.key; });
    if (!members.length) return '';
    return '<section class="projects-group">' +
             '<h3 class="projects-group__label">' + g.label +
               ' <span class="projects-group__count">' + members.length + '</span>' +
             '</h3>' +
             '<div class="grid grid--projects">' +
               members.map(function (p) { return renderProjectTile(escapeHtml, p); }).join('') +
             '</div>' +
           '</section>';
  }).join('');
}

module.exports = {
  id: 'projects',
  label: '/projects/, category pages and readers',

  run: function (ctx) {
    const projects = ctx.content.projects;
    const escapeHtml = ctx.escapeHtml;

    // --- /projects/ --------------------------------------------------------
    ctx.emit('projects/index.html', 'projects', {
      groupsHtml: renderProjectGroupsHtml(escapeHtml, projects),
      feedLinkHtml: renderFeedLinkHtml('feed.xml', 'projects'),
      basePath: '../',
      pageTitle: 'All projects, ' + ctx.site.title,
      pageDescription: 'Projects by ' + ctx.site.ownerName + '.',
      pageKicker: 'Making',
      pageHeading: 'All projects',
      pageLead: 'Things I’ve made, or am still making. Filter by category in the menu, or read them all below.',
    });

    // --- /projects/cat/<slug>/ --------------------------------------------
    // Same layout as the index. `categoryEmpty` lets the template say "nothing
    // here yet" instead of rendering an empty grid — better than a 404 for a
    // category that's real but unpopulated.
    MAKING_CATEGORIES.forEach(function (cat) {
      const members = projects.filter(function (p) {
        return String(p.category || '').toLowerCase() === cat.label.toLowerCase();
      });
      ctx.emit('projects/cat/' + cat.slug + '/index.html', 'projects', {
        groupsHtml: renderProjectGroupsHtml(escapeHtml, members),
        feedLinkHtml: '',
        basePath: '../../../',
        pageTitle: cat.label + ', Making, ' + ctx.site.title,
        pageDescription: cat.dek,
        pageKicker: 'Making',
        pageHeading: cat.label,
        pageLead: cat.dek,
        categoryEmpty: members.length === 0 ? 'true' : '',
      });
    });

    // --- /projects/<slug>/ -------------------------------------------------
    projects.forEach(function (project) {
      // Tags are joined into one string rather than looped in the template, so
      // the reader__meta row reads as a single kicker — "tag · tag · tag" —
      // instead of several separate fragments.
      const tagsJoined = [project.tag1, project.tag2, project.tag3]
        .filter(Boolean).join(' · ');

      ctx.emit('projects/' + project.slug + '/index.html', 'project', Object.assign({}, project, {
        basePath: '../../',
        tagsJoined: tagsJoined,
        pageTitle: project.title + ', ' + ctx.site.title,
        pageDescription: project.summary,
      }));
    });
  },
};
