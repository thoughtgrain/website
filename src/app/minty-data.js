/**
 * minty-data.js: Minty's measurements, or nothing.
 *
 * Null in the browser. During the server render the `server-data` plugin in
 * vite.config.js swaps this body for src/minty/data.json, which
 * scripts/minty-data.mjs writes by running Minty's own code. The browser
 * fetches the same file as /minty/data.json when a figure needs to redraw.
 */

export default null;
