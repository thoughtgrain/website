/**
 * opxy-manifest.js: the OP-XY screen index, or nothing.
 *
 * In the browser this module is exactly what you see: null. The screens pages
 * are prerendered, nothing on them needs React to run again, and the index
 * behind them is half a megabyte of text that no page should ship twice.
 *
 * During the server render the `opxy-manifest` plugin in vite.config.js swaps
 * this file's body for the contents of src/opxy/manifest.json, so the same
 * import gives the pages the whole index while they are being rendered and
 * nothing once they are done. A plain relative import, rather than a virtual
 * module id, because the host scans the source for package names and a bare
 * specifier here would end up in every page's importmap.
 */

export default null;
