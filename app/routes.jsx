/**
 * routes.jsx — route string in, page component out.
 *
 * Pure dispatch, no router library. Every page is a real HTML file that knows
 * its own route (`data-route` on #root), so there's no history to manage, no
 * links to intercept and no fallback to configure — the server already resolved
 * which page this is. A router here would be re-implementing something the
 * filesystem is already doing.
 *
 * Patterns are tried in order, so put specific paths before the ones with a
 * slug segment.
 */

import Notes from './pages/Notes.jsx';
import Note from './pages/Note.jsx';
import Pending from './pages/Pending.jsx';

const ROUTES = [
  [/^\/notes\/$/, Notes],
  [/^\/notes\/[^/]+\/$/, Note],
];

/**
 * @param {string} route e.g. "/notes/your-first-note/"
 * @returns {Function} A React component.
 */
export function pageFor(route) {
  const hit = ROUTES.find(([pattern]) => pattern.test(route));
  // Anything not yet ported renders a placeholder rather than a blank page, so
  // the build stays runnable while the remaining layouts are worked through.
  return hit ? hit[1] : Pending;
}
