import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { buildContent, routesFor } from './app/lib/content-model.js';
import { renderFeeds } from './app/lib/feeds.js';

const ROOT = import.meta.dirname;
const CONTENT = path.join(ROOT, 'src', 'content');

/**
 * Generated entries live at the repo root, in the directory each route is served
 * from — `/notes/your-first-note/index.html` and so on. Rollup derives an
 * output path from where its input sits, so entries parked in a `pages/` folder
 * come out at `build/pages/…`. Putting them where they belong is what makes the
 * output paths right.
 *
 * The list of what was generated is kept in this file so cleanup removes exactly
 * what the last run created, rather than deleting by guessed name.
 */
const GENERATED_MANIFEST = path.join(ROOT, '.generated-routes.json');

/**
 * Directories generation must never create or delete.
 *
 * It writes and removes directories at the repo root, which is the kind of code
 * that eats a project if a content slug ever collides with a real folder. This
 * is cheap insurance: a route that would collide fails the build loudly instead.
 *
 * It earned its keep immediately. The output directory was called `build/`, and
 * the build-series posts are routed at `/build/<slug>/` — so generation would
 * have written entries into the output directory and then cleaned them away on
 * the next run. Hence `dist/` for output, and `build` deliberately not listed.
 */
const OUT_DIR = 'dist';

const RESERVED = new Set([
  'app', 'src', 'lib', 'docs', 'node_modules', OUT_DIR,
  '.git', '.github', '.cache', 'public', 'assets',
]);

/**
 * Read every content file off disk into a { path: rawText } map.
 *
 * This runs in Node, at config time. The browser half fills the same shape with
 * `import.meta.glob` and hands it to the same `buildContent`, so the routes
 * generated here and the pages the app renders can't drift apart.
 */
function readContent() {
  const raw = {};
  readdirSync(CONTENT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((dir) => {
      const abs = path.join(CONTENT, dir.name);
      readdirSync(abs)
        .filter((f) => f.endsWith('.mdx'))
        .sort()
        .forEach((file) => {
          raw[`/src/content/${dir.name}/${file}`] = readFileSync(path.join(abs, file), 'utf8');
        });
    });
  return raw;
}

/** The structured JSON that configures the site rather than filling it. */
function readData() {
  const data = {};
  readdirSync(CONTENT)
    .filter((f) => f.endsWith('.json'))
    .forEach((file) => {
      data[file.replace(/\.json$/, '')] = JSON.parse(readFileSync(path.join(CONTENT, file), 'utf8'));
    });
  return data;
}

/** Remove only the directories the previous run created. */
function cleanGenerated() {
  if (!existsSync(GENERATED_MANIFEST)) return;
  let previous = [];
  try { previous = JSON.parse(readFileSync(GENERATED_MANIFEST, 'utf8')); } catch { return; }
  previous
    .filter((dir) => !RESERVED.has(dir))
    .forEach((dir) => rmSync(path.join(ROOT, dir), { recursive: true, force: true }));
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Write one HTML entry per route and return Rollup's `input` map.
 *
 * Every entry is the same shell. The only thing that differs is `data-route`,
 * which tells the app which page it is, and `data-base`, the depth prefix links
 * need to climb back to the root. Real files at real paths, so
 * `/notes/your-first-note/` is a URL a server resolves without rewrites.
 */
function generateEntries(routes, site) {
  cleanGenerated();

  const input = {};
  const topLevel = new Set();

  routes.forEach((route) => {
    const segments = route === '/' ? [] : route.slice(1, -1).split('/');

    if (segments.length) {
      const top = segments[0];
      if (RESERVED.has(top)) {
        throw new Error(
          `route "${route}" would write into "${top}/", which is a project directory. ` +
          'Rename the content slug.',
        );
      }
      topLevel.add(top);
    }

    const abs = path.join(ROOT, ...segments, 'index.html');
    mkdirSync(path.dirname(abs), { recursive: true });

    // Relative prefix back to the site root, so a built page works from a
    // subdirectory or a file:// URL without absolute paths.
    const base = segments.length ? '../'.repeat(segments.length) : './';

    writeFileSync(abs, `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(site.title || 'Site')}</title>
    <meta name="description" content="${escapeHtml(site.description || '')}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <link rel="alternate" type="application/atom+xml" title="${escapeHtml(site.title || '')}, all updates" href="${base}feed.xml" />
  </head>
  <body>
    <div id="root" data-route="${route}" data-base="${base}"></div>
    <script type="module" src="/app/main.jsx"></script>
  </body>
</html>
`);

    input[route === '/' ? 'index' : route.slice(1, -1)] = abs;
  });

  writeFileSync(GENERATED_MANIFEST, JSON.stringify([...topLevel].sort(), null, 2) + '\n');
  return input;
}

export default defineConfig(() => {
  const raw = readContent();
  const content = buildContent(raw, readData());
  const routes = routesFor(content);
  const input = generateEntries(routes, content.data.site || {});

  console.log(`[site] ${routes.length} routes from ${Object.keys(raw).length} content files`);

  return {
    root: ROOT,
    appType: 'mpa',
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
      rollupOptions: { input },
    },
    plugins: [
      react(),
      // The eleven Atom feeds need real files at real URLs, which no amount of
      // client rendering provides.
      {
        name: 'site-feeds',
        apply: 'build',
        generateBundle() {
          renderFeeds(content).forEach(({ fileName, source }) => {
            this.emitFile({ type: 'asset', fileName, source });
          });
        },
      },
    ],
  };
});
