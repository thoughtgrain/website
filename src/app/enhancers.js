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

import '../js/theme.js';
import '../js/accessibility.js';
import '../js/nav.js';
import '../js/texture.js';
import '../js/floorboards.js';
import '../js/tag-filter.js';
