/**
 * content.js: load every content file as a compiled MDX module.
 *
 * `import.meta.glob` without `?raw` means Vite hands these through the MDX
 * plugin chain, so each file arrives as `{ frontmatter, default }`: the parsed
 * YAML: and a React component for the body. The component is what the pages
 * render. There is no HTML string in the middle any more, which is the whole
 * difference between this and the previous hand-rolled markdown pass.
 *
 * `eager: true` inlines them rather than code-splitting. Every page needs the
 * whole model to resolve its links and neighbours, and the content is about
 * 30 KB in total, so a request per note would cost more than it saves.
 */

import { buildContent } from './lib/content-model.js';

const modules = import.meta.glob('../content/**/*.mdx', { eager: true });

const jsonFiles = import.meta.glob('../content/*.json', {
  import: 'default',
  eager: true,
});

/** Strip a glob key to its basename: "../content/site.json" → "site". */
const nameOf = (p, ext) => p.replace(new RegExp(`^.*/([^/]+)\\.${ext}$`), '$1');

// site.json: nav.json, … keyed by name rather than path.
const data = {};
Object.keys(jsonFiles).forEach((p) => {
  data[nameOf(p, 'json')] = jsonFiles[p];
});

export const content = buildContent(modules, data);
export const site = content.data.site || {};
export const nav = content.data.nav || { groups: [] };
