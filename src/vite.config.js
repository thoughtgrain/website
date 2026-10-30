/**
 * vite.config.js — the whole build, in one file and one command.
 *
 * This directory is the Vite root, and it is also the thing that gets uploaded
 * to a CodePen Pen. That shapes nearly every decision below: CodePen runs a bare
 * `vite build` with no npm scripts of its own, so everything the site needs has
 * to happen inside that single invocation, and nothing may reach outside this
 * folder except the output.
 *
 * What a `vite build` does here:
 *
 *   1. Reads src/content with readdirSync, in Node, at config time, and derives
 *      the route list.
 *   2. Writes one HTML entry per route, at the path it's served from.
 *   3. Builds the `ssr` environment — a Node-loadable render function.
 *   4. Builds the `client` environment — the entries from step 2 plus the app.
 *   5. Prerenders every route and injects the markup into its shell.
 *
 * Steps 3–5 are sequenced by `builder.buildApp`. Before Vite's Environment API
 * this took three separate commands chained in package.json, which worked fine
 * locally and not at all anywhere that just runs `vite build`.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { buildContent, routesFor } from './app/lib/content-model.js';
import { renderFeeds } from './app/lib/feeds.js';

const ROOT = import.meta.dirname;
const CONTENT = path.join(ROOT, 'content');

/**
 * Output. Vite's default — `dist` INSIDE the root — and deliberately so.
 *
 * It used to be `../dist`, on the reading that CodePen's exported zip shows
 * `src/` and `dist/` as siblings. That export is packaging: the Pen's own files
 * come back wrapped in `src/`, and the build output beside it. During the build
 * they're nested, which is why the CodePen template sets no outDir at all.
 * Writing to `../dist` put the whole site outside the Pen root, where nothing
 * served it.
 */
const OUT_DIR = path.join(ROOT, 'dist');

/**
 * The SSR bundle. Inside the root rather than beside it: a sandboxed builder is
 * far likelier to permit writes under the directory it was handed than outside
 * it, and this is scratch output that gets read once and never shipped.
 */
const SSR_DIR = '.ssr';

/**
 * Generated entries live in this directory, in the folder each route is served
 * from — `notes/your-first-note/index.html` and so on. The bundler derives an
 * output path from where its input sits, so entries parked in a `pages/` folder
 * would come out at `dist/pages/…`. Putting them where they belong is what makes
 * the output paths right.
 *
 * The list of what was generated is kept in this file so cleanup removes exactly
 * what the last run created, rather than deleting by guessed name.
 */
const GENERATED_MANIFEST = path.join(ROOT, '.generated-routes.json');

/**
 * Directories generation must never create or delete.
 *
 * It writes and removes directories at the root of a folder that also holds all
 * the source, which is the kind of code that eats a project if a content slug
 * ever collides with a real folder. This is cheap insurance: a route that would
 * collide fails the build loudly instead.
 *
 * It earned its keep immediately. The output directory used to be called
 * `build/`, and the build-series posts are routed at `/build/<slug>/` — so
 * generation wrote entries into the output directory and cleaned them away on
 * the next run. Hence `dist` for output, listed here, and `build` deliberately
 * not listed so the build-series routes still work.
 */
const RESERVED = new Set([
  'app', 'content', 'css', 'js', 'components', 'layouts', 'assets',
  'node_modules', '.codepen', '.git', 'dist', SSR_DIR,
]);

/**
 * Read every content file off disk into a { path: rawText } map.
 *
 * This runs in Node, at config time. The browser half fills the same shape with
 * `import.meta.glob` and hands it to the same `buildContent`, so the routes
 * generated here and the pages the app renders can't drift apart. The keys are
 * root-relative because that's what Vite's glob produces — same keys, both
 * halves, which is the point.
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
          raw[`/content/${dir.name}/${file}`] = readFileSync(path.join(abs, file), 'utf8');
        });
    });
  return raw;
}

/**
 * The MDX component templates from components/.
 *
 * Content writes `<Pullquote text="…" />`; these supply the markup it expands
 * to. They have to reach `buildContent` the same way the content does, or the
 * tags survive into the output as literal text — which is exactly what happened
 * when this step was first left out of the port.
 */
function readComponents() {
  const dir = path.join(ROOT, 'components');
  const out = {};
  readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .forEach((file) => {
      out[file.replace(/\.html$/, '')] = readFileSync(path.join(dir, file), 'utf8');
    });
  return out;
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

/** The `../` prefix a page at this route needs to reach the site root. */
function baseFor(segments) {
  return segments.length ? '../'.repeat(segments.length) : './';
}

/** Route string to its path segments — "/notes/x/" to ["notes", "x"]. */
function segmentsFor(route) {
  return route === '/' ? [] : route.slice(1, -1).split('/');
}

/**
 * Write one HTML entry per route and return the bundler's `input` map.
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
    const segments = segmentsFor(route);

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

    // `base` does double duty: it's the prefix the app hands to Link, and it's
    // how the module script finds itself. That src has to be RELATIVE — a
    // root-absolute /app/main.jsx resolves fine under a plain `vite build` but
    // not under CodePen's, which doesn't map / to the Vite root. Relative works
    // in both, as long as it climbs the right number of levels: an earlier
    // version used a flat `./app/main.jsx` everywhere and every page below the
    // root looked for its script in its own folder.
    const base = baseFor(segments);

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
    <script type="module" src="${base}app/main.jsx"></script>
  </body>
</html>
`);

    input[route === '/' ? 'index' : route.slice(1, -1)] = abs;
  });

  writeFileSync(GENERATED_MANIFEST, JSON.stringify([...topLevel].sort(), null, 2) + '\n');
  return input;
}

/**
 * Put the content into the HTML.
 *
 * Runs after both environments: the client build has written one shell per
 * route, and the SSR build has produced a Node-loadable render function. This
 * walks the routes, renders each, and injects the markup into its shell.
 *
 * It has to come after the client build rather than live in a plugin hook,
 * because it needs the finished HTML on disk — the version with the asset links
 * Vite injected, which only exists once every other hook has run.
 *
 * `entryFile` comes from the SSR build's own output rather than being spelled
 * out here. Vite names it `.mjs` or `.js` depending on whether the nearest
 * package.json declares `"type": "module"` — and this root's package.json is
 * CodePen's, which declares nothing but dependencies.
 */
async function prerender(routes, entryFile) {
  const { render } = await import(path.join(ROOT, SSR_DIR, entryFile));
  let done = 0;

  for (const route of routes) {
    const segments = segmentsFor(route);
    const file = path.join(OUT_DIR, ...segments, 'index.html');

    const shell = readFileSync(file, 'utf8');
    const html = render(route, baseFor(segments));

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
}

/**
 * Read the content and write the entries — once per process, however many times
 * the config is evaluated.
 *
 * Vite resolves the config once per environment, so without this the content
 * gets re-read and every generated entry deleted and rewritten three times a
 * build. Harmless but wasteful, and deleting files three times as often as
 * necessary is not a habit worth keeping.
 */
let prepared;
function prepare() {
  if (prepared) return prepared;

  const raw = readContent();
  const content = buildContent(raw, readData(), readComponents());
  const routes = routesFor(content);
  const input = generateEntries(routes, content.data.site || {});

  console.log(`[site] ${routes.length} routes from ${Object.keys(raw).length} content files`);

  prepared = { content, routes, input };
  return prepared;
}

export default defineConfig(() => {
  const { content, routes, input } = prepare();

  return {
    root: ROOT,
    appType: 'mpa',

    // Relative asset URLs. Vite defaults to `/`, which only works when the site
    // is served from a domain root — a page opened from any subpath (a CodePen
    // preview, a project Pages URL, file://) asks for /assets/main-<hash>.js and
    // gets a 404. Every other path in this build is already resolved relative to
    // the file that wants it; this is the last one that wasn't.
    base: './',

    environments: {
      client: {
        build: {
          outDir: OUT_DIR,
          emptyOutDir: true,
          // rolldownOptions, not rollupOptions: Vite 8 bundles with rolldown.
          // The old name still works as a deprecated alias, but CodePen's own
          // examples use this one and there's no reason to sit on the alias.
          rolldownOptions: { input },
          // The output is prerendered HTML plus a module bundle for hydration —
          // every browser that runs it supports modern syntax by definition, so
          // there's nothing to gain from downlevelling it.
          target: 'esnext',
        },
      },
      ssr: {
        build: {
          ssr: path.join(ROOT, 'app', 'entry-server.jsx'),
          outDir: SSR_DIR,
          emptyOutDir: true,
          copyPublicDir: false,
          target: 'esnext',
        },
      },
    },

    // Defining this is what makes a plain `vite build` build both environments
    // instead of just the client — Vite picks the Environment API builder when
    // the config has a `builder`. The order matters: prerender reads the SSR
    // bundle and writes into the client output, so it goes last.
    builder: {
      // One resolved config for both environments. Without it Vite re-imports
      // this file per environment, so the module-level memo in prepare() never
      // survives and the content gets read — and every entry deleted and
      // rewritten — three times a build.
      sharedConfigBuild: true,
      async buildApp(builder) {
        const ssr = await builder.build(builder.environments.ssr);
        const entry = [ssr].flat()[0].output.find((c) => c.isEntry);
        await builder.build(builder.environments.client);
        await prerender(routes, entry.fileName);
      },
    },

    plugins: [
      react(),
      // The eleven Atom feeds need real files at real URLs, which no amount of
      // client rendering provides.
      //
      // Scoped to the client: with the Environment API a plugin runs in every
      // environment by default, which had the SSR pass emitting its own useless
      // copy of all eleven into .ssr/.
      {
        name: 'site-feeds',
        apply: 'build',
        applyToEnvironment: (env) => env.name === 'client',
        generateBundle() {
          renderFeeds(content).forEach(({ fileName, source }) => {
            this.emitFile({ type: 'asset', fileName, source });
          });

          // Every feed opens with <?xml-stylesheet href="/feed.xsl"?>, so the
          // stylesheet has to land in the output too — without it a browser
          // asked to render a feed gets a 404 and falls back to raw XML.
          this.emitFile({
            type: 'asset',
            fileName: 'feed.xsl',
            source: readFileSync(path.join(ROOT, 'feed.xsl'), 'utf8'),
          });
        },
      },
    ],
  };
});
