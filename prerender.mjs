/**
 * prerender.mjs — put the content into the HTML.
 *
 * Runs after both Vite passes: the client build has written one shell per route,
 * and the SSR build has produced a Node-loadable render function. This walks the
 * routes, renders each, and injects the markup into its shell.
 *
 * Deliberately a separate step rather than a plugin — it needs the finished
 * client HTML on disk, which is after every plugin hook has run.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { buildContent, routesFor } from './app/lib/content-model.js';

const ROOT = import.meta.dirname;
const DIST = path.join(ROOT, 'dist');
const CONTENT = path.join(ROOT, 'src', 'content');

function readContent() {
  const raw = {};
  readdirSync(CONTENT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((dir) => {
      const abs = path.join(CONTENT, dir.name);
      readdirSync(abs).filter((f) => f.endsWith('.mdx')).sort().forEach((file) => {
        raw[`/src/content/${dir.name}/${file}`] = readFileSync(path.join(abs, file), 'utf8');
      });
    });
  return raw;
}

function readData() {
  const data = {};
  readdirSync(CONTENT).filter((f) => f.endsWith('.json')).forEach((file) => {
    data[file.replace(/\.json$/, '')] = JSON.parse(readFileSync(path.join(CONTENT, file), 'utf8'));
  });
  return data;
}

/** The MDX component templates, same as vite.config.js reads. */
function readComponents() {
  const dir = path.join(ROOT, 'src', 'components');
  const out = {};
  readdirSync(dir).filter((f) => f.endsWith('.html')).forEach((file) => {
    out[file.replace(/\.html$/, '')] = readFileSync(path.join(dir, file), 'utf8');
  });
  return out;
}

const { render } = await import('./.ssr/entry-server.js');

const routes = routesFor(buildContent(readContent(), readData(), readComponents()));
let done = 0;

for (const route of routes) {
  const segments = route === '/' ? [] : route.slice(1, -1).split('/');
  const file = path.join(DIST, ...segments, 'index.html');
  const base = segments.length ? '../'.repeat(segments.length) : './';

  const shell = readFileSync(file, 'utf8');
  const html = render(route, base);

  // The shell's root div is empty; fill it in place so every other attribute
  // Vite put on the page (asset links, meta) survives untouched.
  const filled = shell.replace(
    /(<div id="root"[^>]*>)(<\/div>)/,
    (_, open, close) => open + html + close,
  );

  if (filled === shell) throw new Error(`could not inject into ${file} — root div not found`);

  writeFileSync(file, filled);
  done++;
}

console.log(`[prerender] ${done} routes rendered to HTML`);
