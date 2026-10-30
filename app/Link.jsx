/**
 * Link.jsx — an anchor that respects how deep the current page is.
 *
 * Pages are real files at real paths, so a link out of /notes/your-first-note/
 * needs to climb two levels. Taking a root-relative `to` and prefixing the
 * page's own base means every page can write `/notes/` and get a correct
 * relative href — which keeps the build working from a subdirectory or a
 * file:// URL, not just the domain root.
 */

import { useBase } from './base.js';

export default function Link({ to, children, ...rest }) {
  const base = useBase();
  // Strip the leading slash; `base` already ends in one (or is './').
  const href = to === '/' ? base : base + to.replace(/^\//, '');
  return <a href={href} {...rest}>{children}</a>;
}
