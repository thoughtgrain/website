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

// `react-dom/server.node`, not `react-dom/server`.
//
// The bare `./server` subpath is a conditional export: node, browser, workerd,
// deno, edge-light and more. A resolver that applies none of those conditions
// matches no branch and fails outright, which is what CodePen's build did:
//
//   Rolldown failed to resolve import "react-dom/server"
//
// `./server.node` is conditioned only on `default`, so it always resolves, and
// it is the same implementation the `node` condition would have selected. Same
// reasoning as the extensionless import specifiers elsewhere in this app:
// prefer the form that resolves everywhere to the form that is nominally more
// correct.
//
// `./server.browser` is also unconditional and looks equally valid. It is not.
// Its scheduler drives work through a MessageChannel, which in Node is an open
// handle nothing ever closes, so the build renders all fifty-one pages, prints
// its summary and then hangs forever instead of exiting. The markup is
// identical; the process just never comes back.
import { renderToString } from 'react-dom/server.node';
import App from './App';

export function render(route, base) {
  return renderToString(<App route={route} base={base} />);
}
