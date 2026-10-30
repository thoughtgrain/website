/**
 * base.js — the route the app is currently drawing.
 *
 * This used to carry a depth prefix as well, because every page was a real file
 * at a real path and links had to climb back to the root. Under a router
 * there's one file, every href is root-absolute, and the prefix has nothing
 * left to do — so all that remains is "which route is this".
 *
 * `useRoute` reads it from react-router rather than from the DOM. The pathname
 * is normalised to a trailing slash because the route table in routes.jsx
 * matches on that shape, and a reader who types `/notes` without one should
 * land on the same page as a reader who types `/notes/`.
 */

import { useLocation } from 'react-router-dom';

/** The current route, always with a trailing slash: "/notes/your-first-note/". */
export function useRoute() {
  const { pathname } = useLocation();
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/**
 * Kept for the one template that still needs a path prefix.
 *
 * layouts/styles.html is raw HTML with `{{basePath}}` slots in it, rendered as
 * text rather than converted to JSX. Everything is served from the root now, so
 * the prefix it wants is just that.
 */
export const useBase = () => '/';
