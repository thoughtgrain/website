/**
 * assets.js: where each project's hosted files are, from one config.
 *
 * Some projects have files too big to ship with the site (OP-XY's screen
 * sprites, Minty's audio), so they live on a separate asset host. Its address
 * is written once, in src/content/assets.json: a `host`, and a folder under it
 * per project. A project can instead name a full URL, if its files are ever
 * hosted somewhere else.
 *
 * VITE_ASSETS_HOST overrides `host` for a local build against local copies of
 * the files, laid out the same way (opxy/…, minty/…).
 *
 * Read on the server only: the pages are prerendered with the URLs already in
 * them, and anything a browser-side island needs is passed to it as a prop.
 */

import { content } from './content.js';

const config = content.data.assets || {};

/** Ends with a slash, so a base plus a file name is plain concatenation. */
const withSlash = (url) => (url && !url.endsWith('/') ? `${url}/` : url || '');
const isAbsolute = (url) => /^[a-z][a-z\d+.-]*:\/\//i.test(url);

const host = withSlash(import.meta.env.VITE_ASSETS_HOST || config.host || '');

/**
 * The base URL for one project's files, always ending with a slash, or ''
 * when the project or the host isn't configured (the pages handle that).
 */
export function assetsBaseFor(project) {
  const entry = (config.projects || {})[project];
  if (entry == null) return '';
  if (isAbsolute(entry)) return withSlash(entry);
  return host ? withSlash(host + entry.replace(/^\//, '')) : '';
}
