'use strict';

/**
 * render/nav.js — builds the drawer and footer navigation from nav.json.
 *
 * Both menus come from one config file so a single `enabled` flag flips a
 * section in and out of the whole site at once. Items that are disabled are
 * dropped here; their PAGES still build, so a direct URL keeps working and
 * nothing 404s while a section is being drafted.
 *
 * Note the `{{basePath}}` left in the output: it isn't resolved here. Nav HTML
 * is injected into every page, and each page sits at a different depth, so the
 * placeholder survives into the per-page render and resolves there. That is the
 * one case where the template engine's repeat-until-stable `{{key}}` pass is
 * doing essential work rather than defensive work.
 *
 * The mailto: address IS baked in here, because it isn't depth-dependent and
 * double-templating an email through the escape layer mangles it.
 */

/**
 * The drawer menu: grouped sections with a label and a note per item.
 * @param {object} navData Parsed nav.json.
 * @returns {string} HTML, still containing {{basePath}}.
 */
function renderDrawerNav(navData) {
  return navData.groups.map(function (g) {
    const enabled = (g.items || []).filter(function (it) { return it.enabled; });
    // An entirely disabled group renders nothing at all — no empty heading.
    if (!enabled.length) return '';

    const items = enabled.map(function (it) {
      return '<li><a class="drawer__item" href="{{basePath}}' + it.href + '">' +
               '<span class="drawer__item-label">' + it.label + '</span>' +
               '<span class="drawer__item-note">' + (it.note || '') + '</span>' +
             '</a></li>';
    }).join('');

    // Each group is its own landmark, labelled by its own heading, so screen
    // reader users can navigate between groups rather than one long list.
    const titleId = 'drawer-grp-' + g.id;
    return '<section aria-labelledby="' + titleId + '">' +
             '<h3 id="' + titleId + '" class="drawer__group-title">' + g.label + '</h3>' +
             '<ul class="drawer__list">' + items + '</ul>' +
           '</section>';
  }).join('');
}

/**
 * The footer menu: the same groups, flatter, plus the RSS and email links.
 * @param {object} navData Parsed nav.json.
 * @param {object} siteData Parsed site.json, for the email address.
 * @returns {string} HTML, still containing {{basePath}}.
 */
function renderFooterNav(navData, siteData) {
  return navData.groups.map(function (g) {
    const enabled = (g.items || []).filter(function (it) { return it.enabled; });
    if (!enabled.length) return '';

    const items = enabled.map(function (it) {
      return '<li><a href="{{basePath}}' + it.href + '">' + it.label + '</a></li>';
    });

    // RSS and Email hang off the About group rather than getting a group of
    // their own — two links don't justify a fourth column.
    if (g.id === 'about' && Array.isArray(navData.footerExtras)) {
      navData.footerExtras.forEach(function (ex) {
        const href = ex.href.replace('{{email}}', siteData.email || '');
        // mailto: is already absolute; everything else is site-relative and
        // needs the depth prefix.
        const finalHref = href.indexOf('mailto:') === 0 ? href : '{{basePath}}' + href;
        items.push('<li><a href="' + finalHref + '">' + ex.label + '</a></li>');
      });
    }

    const titleId = 'footer-grp-' + g.id;
    return '<section class="site-footer__group" aria-labelledby="' + titleId + '">' +
             '<h2 id="' + titleId + '" class="site-footer__group-title">' + g.label + '</h2>' +
             '<ul>' + items.join('') + '</ul>' +
           '</section>';
  }).join('');
}

module.exports = { renderDrawerNav, renderFooterNav };
