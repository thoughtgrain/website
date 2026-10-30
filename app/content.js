/**
 * content.js — the browser half of content loading.
 *
 * `vite.config.js` fills the same `{ path: rawText }` shape with `readdirSync`
 * at build time; this fills it with Vite's own glob. Both hand it to the same
 * `buildContent`, which is what keeps the routes the config generates and the
 * pages the app renders from drifting apart.
 *
 * `eager: true` inlines the files into the bundle rather than code-splitting
 * them — 30 KB of content total, so a request per note would cost more than it
 * saves. `query: '?raw'` gets the text rather than letting Vite try to parse
 * .mdx as a module.
 */

import { buildContent } from './lib/content-model.js';

const rawFiles = import.meta.glob('/src/content/**/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const jsonFiles = import.meta.glob('/src/content/*.json', {
  import: 'default',
  eager: true,
});

// site.json, nav.json, … keyed by name rather than path.
const data = {};
Object.keys(jsonFiles).forEach((p) => {
  data[p.replace(/^.*\/([^/]+)\.json$/, '$1')] = jsonFiles[p];
});

export const content = buildContent(rawFiles, data);
export const site = content.data.site || {};
export const nav = content.data.nav || { groups: [] };
