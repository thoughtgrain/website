/**
 * entry-server.jsx: render a route to HTML, in Node.
 *
 * Built by Vite's SSR pass so `import.meta.glob` in content.js resolves the same
 * way it does in the browser. prerender.mjs loads the result and calls `render`
 * once per route.
 *
 * Without this the built pages would be empty shells that only fill in once
 * React runs, which is a strange thing for a content site to be. Prerendering
 * puts the words in the HTML, so the pages work with JS disabled, crawlers and
 * link previews see real content, and the output is genuinely static.
 */

import { renderToString } from 'react-dom/server';
import App from './App';

export function render(route, base) {
  return renderToString(<App route={route} base={base} />);
}
