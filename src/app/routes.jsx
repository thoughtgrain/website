/**
 * routes.jsx: route string in, page component out.
 *
 * Pure dispatch, no router library. Every page is a real HTML file that knows
 * its own route (`data-route` on #root), so there's no history to manage, no
 * links to intercept and no fallback to configure, the server already resolved
 * which page this is. A router here would be re-implementing what the filesystem
 * is already doing.
 *
 * Patterns are tried in order, so anything with a fixed second segment comes
 * before the pattern that would swallow it as a slug: /essays/tag/x/ has to be
 * matched before /essays/:slug/.
 */

import Home from './pages/Home';
import Notes from './pages/Notes';
import Note from './pages/Note';
import Writing from './pages/Writing';
import Article from './pages/Article';
import Projects from './pages/Projects';
import Project from './pages/Project';
import Styles from './pages/Styles';
import { Now, About, Learning, Gear, Colophon } from './pages/Flat';
import { KindIndex, KindReader, Enjoying } from './pages/Enjoying';
import { ProductsIndex, Product } from './pages/Products';

const KINDS = 'reading|music|movies|podcasts|bookshelf';

const ROUTES = [
  [/^\/$/, Home],

  [/^\/notes\/$/, Notes],
  [/^\/notes\/[^/]+\/$/, Note],

  [/^\/(essays|studies)\/$/, Writing],
  [/^\/(essays|studies)\/tag\/[^/]+\/$/, Writing],
  [/^\/(essays|studies)\/[^/]+\/$/, Article],
  [/^\/build\/[^/]+\/$/, Article],

  [/^\/projects\/$/, Projects],
  [/^\/projects\/cat\/[^/]+\/$/, Projects],
  [/^\/projects\/[^/]+\/$/, Project],

  [new RegExp(`^/(${KINDS})/$`), KindIndex],
  [new RegExp(`^/(${KINDS})/[^/]+/$`), KindReader],
  [/^\/enjoying\/(\d+\/)?$/, Enjoying],

  [/^\/products\/$/, ProductsIndex],
  [/^\/products\/[^/]+\/$/, Product],

  [/^\/now\/$/, Now],
  [/^\/about\/$/, About],
  [/^\/learning\/$/, Learning],
  [/^\/gear\/$/, Gear],
  [/^\/colophon\/$/, Colophon],
  [/^\/styles\/$/, Styles],
];

/**
 * @param {string} route e.g. "/notes/your-first-note/"
 * @returns {Function} A React component.
 */
export function pageFor(route) {
  const hit = ROUTES.find(([pattern]) => pattern.test(route));
  if (!hit) {
    // Every route comes from routesFor(), and every one of those should be
    // listed above, so reaching here means the two have drifted. Better to
    // fail the build than to prerender a blank page and find out later.
    throw new Error(`no page component for route "${route}"`);
  }
  return hit[1];
}
