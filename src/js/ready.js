/* ready.js — "run this once the DOM exists", whenever you happen to load.
 *
 * These enhancement scripts used to be `<script defer>` tags at the foot of a
 * static page, so `DOMContentLoaded` was always still ahead of them. Under Vite
 * they're ES modules that main.jsx imports *after* the first React render, by
 * which point DOMContentLoaded has long since fired — a bare
 * `addEventListener('DOMContentLoaded', …)` registers a callback for an event
 * that will never come again, and the control silently does nothing.
 *
 * Hence this: if the parser is still going, wait; if it isn't, run now. That
 * covers both load orders, so the scripts don't care how they got here.
 *
 * @param {Function} fn Runs once, with the DOM in place.
 */
export function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}
