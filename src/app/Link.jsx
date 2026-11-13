/**
 * Link.jsx: an anchor that works out its own href from where the page lives.
 *
 * Pages are real files at real paths, so a link out of /notes/your-first-note/
 * has to climb two levels. Every call site writes the root-relative path it
 * means, `to="/notes/"`, and this resolves it against the current route, so
 * no component has to know its own depth.
 */

import { relativeHref, useRoute } from './base.js';

export default function Link({ to, children, ...rest }) {
  const href = relativeHref(useRoute(), to);
  return <a href={href} {...rest}>{children}</a>;
}
