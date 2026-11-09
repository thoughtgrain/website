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
 * React is only needed where a figure has state to drive (the build series'
 * demos, Minty's charts and pedal), and then only for that figure: each is an
 * island, hydrated on its own while the page around it stays static. So this
 * module does three things: loads the stylesheet, starts the enhancers, and,
 * only if the page has islands, fetches React and those figures' code. Pages
 * without any load about 5 KB of JavaScript.
 *
 * The one exception is `vite dev`, where nothing is prerendered: there the
 * whole page is drawn in the browser by hydrate.jsx.
 */

// Cascade order is load-bearing: tokens define the variables, kit styles the
// components that use them, site handles per-page work. Alphabetical would
// break it, which is why these are three explicit imports.
import '../css/tokens.css';
import '../css/kit.css';
import '../css/site.css';
// The OP-XY project's own styles: its masthead, the device-frame sprites and
// the screen archive. Last, so its monochrome accent can override the rust.
import '../css/operator.css';
// Minty's pages: its mint accent and its charts.
import '../css/minty.css';

// The progressive enhancers query the DOM, so they use ready() rather than
// assuming DOMContentLoaded is still ahead of them. They used to be imported
// after React had rendered, which gated a 2 KB theme toggle behind a 96 KB
// framework and made the dark theme flash light on every load.
import './enhancers.js';

const rootEl = document.getElementById('root');

if (!rootEl.firstChild) {
  // An empty root means `vite dev`: nothing was prerendered, so the whole
  // page still has to be drawn client-side.
  import('./hydrate').then(({ mount }) => mount(rootEl));
} else if (rootEl.querySelector('[data-island]')) {
  // Figures React drives on their own, without the rest of the page: see
  // islands/island.jsx. A prerendered page without any has nothing for React
  // to do.
  import('./islands/client').then(({ mountIslands }) => mountIslands(rootEl));
}
