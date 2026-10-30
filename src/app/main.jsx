/**
 * main.jsx: the one script every page loads.
 *
 * Every generated HTML entry loads this same module; the only thing that
 * differs is `data-route` on #root, which says which page this file is. That's
 * what makes it a multi-page build: one real HTML file per route at its real
 * URL, each rendering one route, rather than one page swapping content on the
 * client.
 *
 * There is no router. The server already resolved which page this is, and a
 * router here would re-implement what the filesystem is doing.
 *
 * Nor, for most pages, is there any React. The pages arrive prerendered, and
 * the drawer, theme toggle, tag filter and paper grain are plain DOM scripts.
 * React is only needed where a page has state to drive, which today means the
 * interactive figures in the build series. So this module does three things:
 * loads the stylesheet, starts the enhancers, and, only if the page needs it,
 * fetches the chunk that holds React and the app. On the 45 pages that don't,
 * the JavaScript that loads is about 2 KB instead of 105.
 */

// Cascade order is load-bearing: tokens define the variables, kit styles the
// components that use them, site handles per-page work. Alphabetical would
// break it, which is why these are three explicit imports.
import '../css/tokens.css';
import '../css/kit.css';
import '../css/site.css';

// The progressive enhancers query the DOM, so they use ready() rather than
// assuming DOMContentLoaded is still ahead of them. They used to be imported
// after React had rendered, which gated a 2 KB theme toggle behind a 96 KB
// framework and made the dark theme flash light on every load.
import './enhancers.js';

const rootEl = document.getElementById('root');

// A prerendered page with no interactive figure has nothing for React to do.
// An empty root means `vite dev`, where nothing has been prerendered and the
// whole page still has to be drawn client-side.
const needsReact = !rootEl.firstChild || rootEl.querySelector('.demo');

if (needsReact) {
  import('./hydrate').then(({ mount }) => mount(rootEl));
}
