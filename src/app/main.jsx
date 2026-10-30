/**
 * main.jsx: mount one page.
 *
 * Every generated HTML entry loads this same module; the only thing that
 * differs is `data-route` on #root, which says which page this file is. That's
 * what makes it a multi-page build: fifty real HTML files at fifty real URLs,
 * each rendering one route, rather than one page swapping content on the
 * client.
 *
 * There is no router. The server already resolved which page this is, a router
 * here would re-implement what the filesystem is doing, and cost 50 KB to do it.
 */

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

// Cascade order is load-bearing: tokens define the variables, kit styles the
// components that use them, site handles per-page work. Alphabetical would
// break it, which is why these are three explicit imports.
import '../css/tokens.css';
import '../css/kit.css';
import '../css/site.css';

import App from './App';

const rootEl = document.getElementById('root');
const route = rootEl.dataset.route || '/';
const base = rootEl.dataset.base || './';

const tree = (
  <StrictMode>
    <App route={route} base={base} />
  </StrictMode>
);

// Pages ship prerendered, so the markup is already here and React only has to
// attach to it. `createRoot` would throw it away and rebuild from scratch,
// which flashes and wastes the work. The empty-root fallback keeps `vite dev`
// working, where nothing has been prerendered.
if (rootEl.firstChild) {
  hydrateRoot(rootEl, tree);
} else {
  createRoot(rootEl).render(tree);
}

// The progressive enhancers (theme toggle, drawer, paper grain) query the DOM,
// so they load after the first render rather than at import time. They use
// ready() rather than listening for DOMContentLoaded directly, by the time a
// dynamically imported module runs, that event has already fired and a listener
// for it would never run at all.
import('./enhancers.js');
