/**
 * hydrate.jsx: attach React to a page that needs it.
 *
 * Loaded on demand by main.jsx, and only when the page contains something
 * React has to drive: an interactive figure, or an empty root in development
 * where nothing was prerendered. Everything else on the site is static HTML
 * plus a few plain DOM scripts, so for most pages this module never loads and
 * the 96 KB of react-dom it drags in never ships.
 *
 * Keeping this separate from main.jsx is what lets the bundler split it out:
 * main holds the CSS and the enhancers, this holds React and the app.
 */

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import App from './App';

export function mount(rootEl) {
  const route = rootEl.dataset.route || '/';
  const base = rootEl.dataset.base || './';

  const tree = (
    <StrictMode>
      <App route={route} base={base} />
    </StrictMode>
  );

  // Pages ship prerendered, so the markup is already here and React only has
  // to attach to it. `createRoot` would throw it away and rebuild from
  // scratch, which flashes and wastes the work. The empty-root fallback keeps
  // `vite dev` working, where nothing has been prerendered.
  if (rootEl.firstChild) {
    hydrateRoot(rootEl, tree);
  } else {
    createRoot(rootEl).render(tree);
  }
}
