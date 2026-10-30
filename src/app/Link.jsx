/**
 * Link.jsx — an in-app link.
 *
 * Thin wrapper over react-router's Link. It exists so call sites keep writing
 * `to="/notes/"` and nothing has to know there's a router underneath — the same
 * reason this file existed when it was resolving relative paths by hand.
 *
 * Those relative paths are gone. Under a router every href is root-absolute,
 * because the router matches on pathname and a relative href would resolve
 * against whatever page the reader happens to be standing on. That means the
 * output no longer works from a subdirectory or a file:// URL; it needs to be
 * served from a domain root, with unknown paths rewritten to index.html.
 */

import { Link as RouterLink } from 'react-router-dom';

export default function Link({ to, children, ...rest }) {
  return <RouterLink to={to} {...rest}>{children}</RouterLink>;
}
