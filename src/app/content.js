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

const rawFiles = import.meta.glob('/content/**/*.mdx', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const jsonFiles = import.meta.glob('/content/*.json', {
  import: 'default',
  eager: true,
});

// The MDX component templates. Same shape the Node loaders build with
// readdirSync, so buildContent can't tell the two apart.
const componentFiles = import.meta.glob('/components/*.html', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const components = {};
Object.keys(componentFiles).forEach((p) => {
  components[p.replace(/^.*\/([^/]+)\.html$/, '$1')] = componentFiles[p];
});

// site.json, nav.json, … keyed by name rather than path.
const data = {};
Object.keys(jsonFiles).forEach((p) => {
  data[p.replace(/^.*\/([^/]+)\.json$/, '$1')] = jsonFiles[p];
});

export const content = buildContent(rawFiles, data, components);
export const site = content.data.site || {};
export const nav = content.data.nav || { groups: [] };
