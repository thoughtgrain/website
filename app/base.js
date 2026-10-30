/**
 * base.js — where the page being rendered sits, and how to link out of it.
 *
 * Context rather than props drilled through every component: both values are
 * set once per page from the entry's `data-route` / `data-base` attributes and
 * never change during a render.
 *
 * Everything links relatively. That's what lets the built site work from a
 * subdirectory, from a file:// URL, or from whatever path a host hands it —
 * which matters here, because the output has to behave the same on GitHub
 * Pages and dropped into CodePen.
 */

import { createContext, useContext } from 'react';

export const BaseContext = createContext({ route: '/', base: './' });

/** The `../` prefix for this page's depth. Only the raw templates still need it. */
export const useBase = () => useContext(BaseContext).base;

/** The route of the page currently rendering, e.g. "/studies/tag/tag-one/". */
export const useRoute = () => useContext(BaseContext).route;

/**
 * The shortest relative href from one route to another.
 *
 * Prefixing a root-relative path with the page's depth works, but produces
 * round trips: from /products/ a link to /products/feed.xml comes out as
 * `../products/feed.xml`. Correct, and noise. Dropping the segments the two
 * paths already share gives plain `feed.xml` instead.
 *
 * @param {string} from The current route — always a directory, trailing slash.
 * @param {string} to   A root-relative target, directory or file.
 * @returns {string} A relative href; "./" for a link to the current page.
 */
export function relativeHref(from, to) {
  const fromSegs = from.split('/').filter(Boolean);
  const toSegs = to.split('/').filter(Boolean);

  let shared = 0;
  while (shared < fromSegs.length && shared < toSegs.length
         && fromSegs[shared] === toSegs[shared]) shared += 1;

  const rest = toSegs.slice(shared);
  const up = '../'.repeat(fromSegs.length - shared);
  // A directory target keeps its trailing slash, so the browser doesn't have
  // to redirect; a file target (feed.xml) never had one.
  const tail = rest.join('/') + (to.endsWith('/') && rest.length ? '/' : '');

  return up + tail || './';
}
