/**
 * vite.config.js — the whole build, in one file and one command.
 *
 * The repo root is the Vite root, and it is also what gets uploaded to a
 * CodePen Pen: the generated entries at the top level, `.codepen/pen.config.json`
 * beside them, source under `src/`. CodePen runs a bare `vite build` with no
 * npm scripts of its own, so everything the site needs happens inside that one
 * invocation — and its own entry discovery is a recursive glob for `.html`,
 * which is exactly what fifty entries at the root give it.
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
 * Steps 3–5 are sequenced by `builder.buildApp`. The output is fifty real HTML
 * files with the words already in them: no router, no rewrite rules, nothing
 * that has to run before a reader sees the page.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { compile as compileMdx } from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import rehypeSlug from 'rehype-slug';
import { defineConfig } from 'vite';

import { buildContent, routesFor } from './src/app/lib/content-model.js';
import { renderFeeds } from './src/app/lib/feeds.js';
import { readContent, readData } from './node-loader.js';

const ROOT = import.meta.dirname;

/** Output: Vite's default, `dist` inside the root. */
const OUT_DIR = path.join(ROOT, 'dist');

/**
 * The SSR bundle. Inside the root rather than beside it: a sandboxed builder is
 * likelier to permit writes under the directory it was handed than outside it,
 * and this is scratch output read once and never shipped.
 */
const SSR_DIR = '.ssr';

/**
 * Generated entries live at the root, in the folder each route is served from —
 * `notes/your-first-note/index.html` and so on. The bundler derives an output
 * path from where its input sits, so entries parked in a `pages/` folder would
 * come out at `dist/pages/…`. Putting them where they belong is what makes the
 * output paths right, and it's also what lets CodePen's recursive `.html` glob
 * find all fifty of them.
 *
 * The list of what was generated is kept in this file so cleanup removes
 * exactly what the last run created, rather than deleting by guessed name.
 */
const GENERATED_MANIFEST = path.join(ROOT, '.generated-routes.json');

/**
 * Directories generation must never create or delete.
 *
 * It writes and removes directories at the repo root, which is the kind of code
 * that eats a project if a content slug ever collides with a real folder. This
 * is cheap insurance: a route that would collide fails the build loudly.
 *
 * It earned its keep immediately. The output directory used to be called
 * `build/`, and the build-series posts route at `/build/<slug>/` — so
 * generation wrote entries into the output directory and cleaned them away on
 * the next run. Hence `dist`, listed here, and `build` deliberately not listed.
 */
const RESERVED = new Set([
  'src', 'dist', 'docs', 'node_modules', '.codepen', '.git', '.github', SSR_DIR,
]);

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
const baseFor = (segments) => (segments.length ? '../'.repeat(segments.length) : './');

/** Route string to path segments — "/notes/x/" to ["notes", "x"]. */
const segmentsFor = (route) => (route === '/' ? [] : route.slice(1, -1).split('/'));

/**
 * Write one HTML entry per route and return the bundler's `input` map.
 *
 * Every entry is the same shell. The only things that differ are `data-route`,
 * which tells the app which page it is, and `data-base`, the depth prefix links
 * need to climb back to the root.
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
          `route "${route}" would write into "${top}/", which is a project directory. `
          + 'Rename the content slug.',
        );
      }
      topLevel.add(top);
    }

    const abs = path.join(ROOT, ...segments, 'index.html');
    mkdirSync(path.dirname(abs), { recursive: true });

    // `base` does double duty: the prefix the app hands to Link, and how the
    // module script finds itself.
    //
    // Two things about that src, both the result of getting them wrong first.
    // It's RELATIVE, because a root-absolute path resolves under a plain
    // `vite build` but not under CodePen's, which doesn't map `/` to the Vite
    // root — that mismatch produced fifty identical "Failed to resolve
    // /app/main.jsx" errors. And it's EXTENSIONLESS, so it resolves whether the
    // file is main.jsx as it is here or main.js after a pipeline has compiled
    // the JSX out: `resolve.extensions` covers both, while a literal `.js`
    // specifier fails locally (Vite maps .js to .ts/.tsx, never .jsx).
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
    <link rel="alternate" type="application/feed+json" title="${escapeHtml(site.title || '')}, all updates" href="${base}feed.json" />
  </head>
  <body>
    <div id="root" data-route="${route}" data-base="${base}"></div>
    <script type="module" src="${base}src/app/main"></script>
  </body>
</html>
`);

    input[route === '/' ? 'index' : route.slice(1, -1)] = abs;
  });

  writeFileSync(GENERATED_MANIFEST, `${JSON.stringify([...topLevel].sort(), null, 2)}\n`);
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
 * out, since Vite names it `.js` or `.mjs` depending on the nearest
 * package.json.
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
    done += 1;
  }

  console.log(`[prerender] ${done} routes rendered to HTML`);
}

/**
 * Read the content and write the entries — once per process, however many times
 * the config is evaluated.
 */
let prepared;
function prepare() {
  if (prepared) return prepared;

  const raw = readContent();
  const content = buildContent(raw, readData());
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
    // is served from a domain root — a page opened from any subpath asks for
    // /assets/main-<hash>.js and gets a 404. Every other path in this build is
    // resolved relative to the file that wants it; this is the last one.
    base: './',

    /**
     * Declared at the TOP level, not inside environments.client.
     *
     * The client environment inherits this, so it reads the same either way
     * here — but it does not read the same everywhere. A pipeline that drives
     * Vite through the legacy build path rather than the Environment API
     * builder only ever looks at this key. With `input` nested under
     * `environments`, such a build finds nothing to bundle and emits no assets
     * at all: the HTML ships untouched, its bare `react` imports and
     * extensionless paths unresolvable, and every page renders white.
     *
     * That is exactly what CodePen produced. Keeping the build declared here
     * means the worst case is fifty bundled pages without prerendered markup,
     * rendering client-side — degraded, but working.
     */
    build: {
      outDir: OUT_DIR,
      emptyOutDir: true,
      rolldownOptions: { input },
      target: 'esnext',
    },

    environments: {
      ssr: {
        build: {
          // Extensionless, like every other specifier here: a pipeline that
          // compiles the JSX out leaves this as entry-server.js.
          ssr: path.join(ROOT, 'src', 'app', 'entry-server'),
          outDir: SSR_DIR,
          emptyOutDir: true,
          copyPublicDir: false,
          target: 'esnext',
        },
      },
    },

    // Defining this is what makes a plain `vite build` build both environments
    // instead of just the client. The order matters: prerender reads the SSR
    // bundle and writes into the client output, so it goes last.
    builder: {
      // One resolved config for both environments, so prepare()'s memo holds
      // and the entries aren't deleted and rewritten three times a build.
      sharedConfigBuild: true,
      async buildApp(builder) {
        const ssr = await builder.build(builder.environments.ssr);
        const entry = [ssr].flat()[0].output.find((c) => c.isEntry);
        await builder.build(builder.environments.client);
        await prerender(routes, entry.fileName);
      },
    },

    plugins: [
      /**
       * Refuse to build if any import names a `.jsx` file explicitly.
       *
       * This exists because the failure is invisible here and fatal there.
       * CodePen's babel block compiles every .jsx to .js before Vite runs, but
       * doesn't rewrite the specifiers inside, so `import App from './App.jsx'`
       * ends up pointing at a file that no longer has that name:
       *
       *   Could not resolve './App.jsx' in src/app/main.js
       *
       * Extensionless is the portable form — resolve.extensions finds .jsx
       * here and .js there. A literal `.js` specifier is not an option: Vite
       * maps .js to .ts/.tsx, never .jsx, so it breaks the local build instead.
       */
      {
        name: 'no-explicit-jsx-specifiers',
        apply: 'build',
        buildStart() {
          const offenders = [];
          const walk = (dir) => {
            readdirSync(dir, { withFileTypes: true }).forEach((e) => {
              const abs = path.join(dir, e.name);
              if (e.isDirectory()) return walk(abs);
              if (!/\.(jsx?|mjs)$/.test(e.name)) return;
              readFileSync(abs, 'utf8').split('\n').forEach((line, i) => {
                if (/(?:from|import)\s+['"][^'"]+\.jsx['"]/.test(line)) {
                  offenders.push(`${path.relative(ROOT, abs)}:${i + 1}`);
                }
              });
            });
          };
          walk(path.join(ROOT, 'src', 'app'));
          if (offenders.length) {
            throw new Error(
              `explicit .jsx import specifier in:\n  ${offenders.join('\n  ')}\n`
              + 'Drop the extension — it resolves to .jsx locally and .js wherever '
              + 'the JSX has already been compiled out.',
            );
          }
        },
      },

      /**
       * Content is real MDX, compiled on the way through.
       *
       * This is @mdx-js/mdx directly rather than @mdx-js/rollup, which is a
       * thin wrapper over it. The wrapper declares a non-optional `rollup`
       * peerDependency, npm installs it, and `rollup` is one of only two
       * packages in the tree that pull `fsevents` — which Yarn Berry rewrites
       * to a `patch:` source, which CodePen rejects because it can't become an
       * esm.sh URL. Dropping the wrapper drops that whole chain. Same compiler,
       * same remark plugins, same output.
       *
       * Both remark plugins are required, not optional: without them the
       * frontmatter block isn't metadata at all — MDX reads `---` as a thematic
       * break and the slug, title and toc render as visible body text.
       *
       * `enforce: 'pre'` so this runs before the React plugin, which needs JSX
       * rather than MDX.
       */
      {
        name: 'site-mdx',
        enforce: 'pre',
        async transform(code, id) {
          if (!id.endsWith('.mdx')) return null;
          const compiled = await compileMdx(
            { value: code, path: id },
            {
              remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
              // Heading ids, which the `toc:` frontmatter links to. The old
              // markdown parser slugified them; MDX doesn't, and nothing
              // replaced it — so every in-page anchor on the site pointed at
              // an id that was never emitted.
              rehypePlugins: [rehypeSlug],
            },
          );
          return { code: String(compiled), map: null };
        },
      },
      react(),

      /**
       * The feeds: eleven sections, each as Atom and as JSON Feed. They need
       * real files at real URLs, which no amount of client rendering provides.
       *
       * Scoped to the client: with the Environment API a plugin runs in every
       * environment by default, which had the SSR pass emitting its own useless
       * copy of all of them into .ssr/.
       */
      {
        name: 'site-feeds',
        apply: 'build',
        applyToEnvironment: (env) => env.name === 'client',
        generateBundle(_options, bundle) {
          const feeds = renderFeeds(content);
          feeds.forEach(({ fileName, source }) => {
            this.emitFile({ type: 'asset', fileName, source });
          });

          // A copy of the XSL stylesheet beside every feed.xml.
          //
          // One shared copy won't do. The <link> and <a href> the transform
          // emits resolve against the FEED's URL, not the stylesheet's, so the
          // paths inside have to match the depth of the feed that used it.
          // Eleven ~3 KB copies is the cheap way to be correct at every depth.
          const cssFile = Object.keys(bundle).find((f) => f.endsWith('.css'));
          const template = readFileSync(path.join(ROOT, 'src', 'feed-style.xml'), 'utf8');

          feeds
            .filter(({ fileName }) => fileName.endsWith('feed.xml'))
            .forEach(({ fileName }) => {
              const depth = fileName.split('/').length - 1;
              const up = depth ? '../'.repeat(depth) : './';
              this.emitFile({
                type: 'asset',
                fileName: fileName.replace(/feed\.xml$/, 'feed-style.xml'),
                source: template
                  .replaceAll('{{cssHref}}', up + (cssFile || ''))
                  .replaceAll('{{homeHref}}', up),
              });
            });
        },
      },
    ],
  };
});
