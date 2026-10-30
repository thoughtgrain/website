/**
 * enhancers.js — the existing progressive enhancement scripts.
 *
 * These are the browser-only files from src/js/: the theme toggle, the drawer,
 * the paper-grain fade, the tag filter. They manipulate the DOM directly, which
 * is fine — they enhance markup React has already rendered, and none of them
 * owns state React also owns.
 *
 * Imported after the first render (see main.jsx) because they query the DOM at
 * module scope. Order matters for one of them: theme.js applies the stored
 * colour scheme, so it goes first to avoid a flash of the wrong theme.
 */

import '../src/js/theme.js';
import '../src/js/accessibility.js';
import '../src/js/nav.js';
import '../src/js/texture.js';
import '../src/js/floorboards.js';
import '../src/js/tag-filter.js';
