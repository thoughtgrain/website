/**
 * main.jsx — mount the app.
 *
 * One root, one shell, one bundle. The site is a client-side SPA now: a single
 * index.html loads this, react-router reads the address bar, and App draws
 * whichever page matches. Navigation between pages never touches the network.
 *
 * Worth being clear about the trade, because it's the whole architecture:
 * nothing is prerendered any more. The HTML that arrives is an empty div, and
 * every page's content exists only after this module has run. A reader with
 * JavaScript off, a crawler that doesn't execute it, and a link preview all get
 * the empty div. The eleven Atom feeds are generated at build time precisely
 * because they can't depend on any of this.
 *
 * Deep links need the host to serve index.html for unknown paths. Without that
 * rewrite only `/` resolves; everything else 404s before this file ever runs.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Cascade order is load-bearing: tokens define the variables, kit styles the
// components that use them, site handles per-page work. Alphabetical would
// break it, which is why these are three explicit imports.
import '../css/tokens.css';
import '../css/kit.css';
import '../css/site.css';

import App from './App.jsx';

const container = document.getElementById('app');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

// The progressive enhancers (theme toggle, drawer, paper grain) query the DOM,
// so they load after the first render rather than at import time. They use
// ready() rather than listening for DOMContentLoaded directly — by the time a
// dynamically imported module runs, that event has already fired and a listener
// for it would never run at all.
import('./enhancers.js');
