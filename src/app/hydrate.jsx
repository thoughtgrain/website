/**
 * hydrate.jsx: draw the whole page in the browser, for `vite dev`.
 *
 * Loaded by main.jsx only when #root is empty, which happens in development,
 * where nothing has been prerendered. Built pages never load it: their
 * interactive figures are islands, each hydrated on its own by
 * islands/client.jsx, and the rest of the page is static HTML plus a few
 * plain DOM scripts.
 *
 * Keeping this separate from main.jsx is what lets the bundler split it out:
 * main holds the CSS and the enhancers, this holds React and the whole app.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

export function mount(rootEl) {
  const route = rootEl.dataset.route || '/';
  const base = rootEl.dataset.base || './';

  const tree = (
    <StrictMode>
      <App route={route} base={base} />
    </StrictMode>
  );

  // Nothing is here to attach to, so React draws the page from scratch. The
  // islands inside it render in place (no collector in the browser), as
  // ordinary parts of this tree.
  createRoot(rootEl).render(tree);
}
