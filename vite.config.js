/**
 * vite.config.js: the whole build, in one file and one command.
 *
 * The repo root is the Vite root, and it is also what gets uploaded to a
 * CodePen Pen: the generated entries at the top level, `.codepen/pen.config.json`
 * beside them, source under `src/`. CodePen runs a bare `vite build` with no
 * npm scripts of its own, so everything the site needs happens inside that one
 * invocation, and its own entry discovery is a recursive glob for `.html`,
 * which is exactly what fifty entries at the root give it.
 *
 * What a `vite build` does here:
 *
 *   1. Reads src/content with readdirSync, in Node, at config time, and derives
 *      the route list.
 *   2. Writes one HTML entry per route, at the path it's served from.
 *   3. Builds the `ssr` environment, a Node-loadable render function.
 *   4. Builds the `client` environment, the entries from step 2 plus the app.
 *   5. Prerenders every route and injects the markup into its shell.
 *
 * Steps 3–5 are sequenced by `builder.buildApp`. The output is fifty real HTML
 * files with the words already in them: no router, no rewrite rules, nothing
 * that has to run before a reader sees the page.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { compile as compileMdx } from '@mdx-js/mdx';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
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
 * Generated entries live at the root, in the folder each route is served from, 
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
 * `build/`, and the build-series posts route at `/build/<slug>/`, so
 * generation wrote entries into the output directory and cleaned them away on
 * the next run. Hence `dist`, listed here, and `build` deliberately not listed.
 */
const RESERVED = new Set([
  'src', 'dist', 'docs', 'node_modules', '.codepen', '.git', '.github', SSR_DIR,
]);

/**
 * Give every heading an id, so the `toc:` frontmatter has something to link to.
 *
 * This is a local plugin rather than `rehype-slug`, deliberately. Every import
 * at the top of this file is a way for the whole build to fail silently: if one
 * doesn't resolve, the config throws, Vite never runs, and the HTML ships
 * unprocessed, which looks like a successful build and a white page. That has
 * happened twice. @mdx-js/mdx and the remark plugins earn that risk; a dozen
 * lines of string munging does not.
 *
 * Matches github-slugger closely enough for our headings: lowercase, drop
 * anything that isn't a word character or a space, join on hyphens. The
 * duplicate counter is there because two sections can share a title.
 */
function rehypeHeadingIds() {
  const textOf = (node) => (node.type === 'text'
    ? node.value
    : (node.children || []).map(textOf).join(''));

  const slugify = (t) => t
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]+/gu, '')
    .trim()
    .replace(/\s+/g, '-');

  return (tree) => {
    const seen = new Map();
    const walk = (node) => {
      if (node.type === 'element' && /^h[1-6]$/.test(node.tagName) && !node.properties?.id) {
        const base = slugify(textOf(node)) || 'section';
        const n = seen.get(base) || 0;
        seen.set(base, n + 1);
        node.properties = { ...node.properties, id: n ? `${base}-${n}` : base };
      }
      (node.children || []).forEach(walk);
    };
    walk(tree);
  };
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
const baseFor = (segments) => (segments.length ? '../'.repeat(segments.length) : './');

/** Route string to path segments, "/notes/x/" to ["notes", "x"]. */
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
    // root. That mismatch produced fifty identical "Failed to resolve
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
 * because it needs the finished HTML on disk, the version with the asset links
 * Vite injected, which only exists once every other hook has run.
 *
 * `entryFile` comes from the SSR build's own output rather than being spelled
 * out, since Vite names it `.js` or `.mjs` depending on the nearest
 * package.json.
 */
async function prerender(routes, entryFile, outDir = OUT_DIR) {
  const { render } = await import(path.join(ROOT, SSR_DIR, entryFile));
  let done = 0;

  for (const route of routes) {
    const segments = segmentsFor(route);
    const file = path.join(outDir, ...segments, 'index.html');

    const shell = readFileSync(file, 'utf8');
    const html = render(route, baseFor(segments));

    // The shell's root div is empty; fill it in place so every other attribute
    // Vite put on the page (asset links, meta) survives untouched.
    const filled = shell.replace(
      /(<div id="root"[^>]*>)(<\/div>)/,
      (_, open, close) => open + html + close,
    );

    if (filled === shell) throw new Error(`could not inject into ${file}, root div not found`);

    writeFileSync(file, filled);
    done += 1;
  }

  // Says where, not just how many. When this runs on someone else's builder
  // the interesting question is never the count, it's whether the directory it
  // filled is the directory that gets served.
  note(`${done} routes rendered into ${path.relative(ROOT, outDir) || '.'}`);
}

/**
 * What happened during this build, written somewhere a browser can reach.
 *
 * `console.log` assumes someone can see the build log. On a hosted builder
 * that may not be true, and then a silent skip and a silent success are
 * indistinguishable from the outside: both give a passing build and pages that
 * look fine in a browser. So the same lines also go to a file in the output,
 * servable at `/build-report.txt`.
 *
 * Deliberately last, and deliberately unable to fail the build: a diagnostic
 * that breaks the thing it is diagnosing is worse than no diagnostic.
 */
const reportLines = [];

function note(line) {
  reportLines.push(line);
  console.log(`[prerender] ${line}`);
}

function writeReport(outDir) {
  try {
    const sample = path.join(outDir, 'index.html');
    const html = existsSync(sample) ? readFileSync(sample, 'utf8') : '';
    const empty = /<div id="root"[^>]*><\/div>/.test(html);

    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, 'build-report.txt'), `${[
      `built:    ${new Date().toISOString()}`,
      `outDir:   ${outDir}`,
      '',
      ...reportLines.map((l) => `  ${l}`),
      '',
      `index.html is ${html.length} bytes`,
      `index.html #root is ${empty ? 'EMPTY, so this build did NOT prerender' : 'FILLED, so this build prerendered'}`,
      '',
      'If the page a browser receives disagrees with those two lines, then',
      'something replaced the output after this build finished.',
    ].join('\n')}\n`);
  } catch {
    // Never let the report be the reason a build fails.
  }
}

/**
 * Read the content and write the entries, once per process, however many times
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

/**
 * The plugins that turn this source tree into something runnable.
 *
 * A factory rather than an inline array because two builds need them: the main
 * one declared below, and the fallback SSR build further down, which runs with
 * `configFile: false` and so gets nothing it isn't handed directly.
 */
function contentPlugins() {
  return [
    /**
     * Give `React.createElement` a React to call.
     *
     * Locally every component is `.jsx` and the React plugin uses the
     * automatic runtime, so no file mentions `React` and none needs to import
     * it. CodePen compiles the JSX out before Vite runs, using the *classic*
     * runtime, so what this build actually receives is `.js` full of
     *
     *   React.createElement(StrictMode, null, ...)
     *
     * with no import anywhere. Their client build has something that supplies
     * that binding. The nested SSR build, running `configFile: false`, does
     * not, so the bundle compiled cleanly and then died the moment it rendered:
     *
     *   React is not defined
     *
     * Adding the import is enough, and it is a no-op everywhere the automatic
     * runtime is in use, since nothing there references `React` at all.
     */
    {
      name: 'provide-react-binding',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('node_modules') || !/\.[jt]sx?(\?|$)/.test(id)) return null;
        if (!/\bReact\s*\.\s*(createElement|Fragment)/.test(code)) return null;
        if (/\bimport\s+(\*\s+as\s+)?React\b/.test(code)) return null;
        return { code: `import React from 'react';\n${code}`, map: null };
      },
    },

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
     * Extensionless is the portable form: resolve.extensions finds .jsx here
     * and .js there. A literal `.js` specifier is not an option, since Vite
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
            + 'Drop the extension, which resolves to .jsx locally and .js wherever '
            + 'the JSX has already been compiled out.',
          );
        }
      },
    },

    /**
     * Content is real MDX, compiled on the way through.
     *
     * This is @mdx-js/mdx directly rather than @mdx-js/rollup, which is a thin
     * wrapper over it. The wrapper declares a non-optional `rollup`
     * peerDependency, npm installs it, and `rollup` is one of only two packages
     * in the tree that pull `fsevents`, which Yarn Berry rewrites to a `patch:`
     * source, which CodePen rejects because it can't become an esm.sh URL.
     * Dropping the wrapper drops that whole chain. Same compiler, same remark
     * plugins, same output.
     *
     * Both remark plugins are required, not optional: without them the
     * frontmatter block isn't metadata at all. MDX reads `---` as a thematic
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
            // replaced it, so every in-page anchor on the site pointed at an
            // id that was never emitted.
            rehypePlugins: [rehypeHeadingIds],
          },
        );
        return { code: String(compiled), map: null };
      },
    },
    react(),
  ];
}

/**
 * True once `builder.buildApp` has taken charge of sequencing the build.
 *
 * Set at the top of buildApp, which runs before any environment is built, so
 * the fallback below can tell whether it's needed before it fires.
 */
let usingBuilder = false;

/**
 * Build the SSR bundle and prerender, without the Environment API.
 *
 * `buildApp` is the good path and does this itself. But a host can drive Vite
 * through its legacy build path instead, and then `buildApp` is never called:
 * the client environment gets built, nothing else does, and the prerender pass
 * that puts the words into the HTML silently doesn't happen. CodePen does
 * exactly this, which is how the deployed site ended up as fifty correctly
 * bundled pages containing an empty div.
 *
 * So this is the same three steps, reachable from a plain plugin hook. The
 * nested build is deliberately `configFile: false`: re-entering this config
 * would re-read the content, rewrite all fifty entries mid-build, and bring
 * the fallback plugin along with it. Handing it `contentPlugins()` gives it
 * exactly what it needs to compile the app and nothing that can recurse.
 */
/**
 * Find react-dom's Node server renderer as an absolute file path.
 *
 * The SSR entry imports `react-dom/server.node`, and on CodePen that doesn't
 * resolve. Nor does `react-dom/server`. That is not a conditional-exports
 * problem, because `./server.node` is conditioned only on `default`; the whole
 * server family is simply unreachable by specifier there.
 *
 * It is on disk, though. The client build bundles React into a 350 KB chunk,
 * and a bundler cannot bundle what it cannot read. So rather than ask the
 * resolver for a package subpath, ask Node where the package is and then point
 * at the file inside it. `server.node.js` sits at the package root next to
 * `index.js`, so once the directory is known there is nothing left to resolve.
 *
 * Returns the attempts as well as the answer: when this fails it fails on a
 * machine I can't reach, and the list of what was tried is the whole
 * diagnosis.
 */
function findReactServerEntry(require, attempts) {
  for (const spec of ['react-dom/server.node', 'react-dom/server']) {
    try {
      const found = require.resolve(spec);
      attempts.push(`resolved ${spec}`);
      return found;
    } catch (err) {
      attempts.push(`could not resolve ${spec} (${err.code || 'failed'})`);
    }
  }

  try {
    const dir = path.dirname(require.resolve('react-dom/package.json'));
    attempts.push(`react-dom package dir: ${dir}`);
    for (const file of ['server.node.js', 'server.js', 'server.browser.js']) {
      const candidate = path.join(dir, file);
      if (existsSync(candidate)) {
        attempts.push(`using ${file} directly`);
        return candidate;
      }
    }
    attempts.push(`no server entry file in ${dir}`);
  } catch (err) {
    attempts.push(`could not locate react-dom at all (${err.code || 'failed'})`);
  }

  return null;
}

/**
 * Pin every bare import the SSR graph needs to an absolute path.
 *
 * Aliasing the server renderer got past the first error and straight into the
 * second: `react` itself doesn't resolve in this build either. Which makes the
 * shape of the problem clear. It was never about one awkward subpath. This
 * build resolves no bare specifiers at all, because `configFile: false` means
 * it has none of the host's resolver setup and the host is evidently supplying
 * React to the client build through its own config rather than through a
 * node_modules the nested build can see.
 *
 * Node can find these packages from here, which the server renderer proved by
 * resolving on the first attempt. So resolve them all the same way and hand
 * the bundler absolute paths, leaving it nothing to look up.
 *
 * Anchored regexes, not bare strings: a string alias of `react` also matches
 * `react/jsx-runtime` as a prefix and would rewrite it to
 * `/path/to/react/index.js/jsx-runtime`. Each specifier is pinned exactly, so
 * the JSX runtime gets its own entry.
 */
const SSR_BARE_IMPORTS = [
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
];

function ssrAliases() {
  const require = createRequire(import.meta.url);
  const attempts = [];
  const alias = [];

  const server = findReactServerEntry(require, attempts);
  if (server) {
    alias.push({
      find: /^react-dom\/server(\.node|\.browser|\.edge)?$/,
      replacement: server,
    });
  }

  const missing = [];
  for (const spec of SSR_BARE_IMPORTS) {
    try {
      alias.push({
        find: new RegExp(`^${spec.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&')}$`),
        replacement: require.resolve(spec),
      });
    } catch (err) {
      // jsx-dev-runtime is absent from some builds and never reached in a
      // production bundle, so it is not worth failing over.
      if (!spec.endsWith('jsx-dev-runtime')) missing.push(spec);
      attempts.push(`could not resolve ${spec} (${err.code || 'failed'})`);
    }
  }

  attempts.push(`pinned ${alias.length} specifiers to absolute paths`);
  return { alias, attempts, missing: server ? missing : ['react-dom/server', ...missing] };
}

async function buildSsrAndPrerender(routes, outDir) {
  const { build } = await import('vite');

  const { alias, attempts, missing } = ssrAliases();
  attempts.forEach((a) => note(`  resolve: ${a}`));
  if (missing.length) {
    throw new Error(
      `these packages are not reachable from the build config (${missing.join(', ')}), `
      + 'so the pages cannot be prerendered here.',
    );
  }

  const result = await build({
    configFile: false,
    root: ROOT,
    logLevel: 'warn',
    plugins: contentPlugins(),

    // `configFile: false` means this build inherits nothing, from the host or
    // from the config above, so it has to say what it is building for.
    //
    // Without this, `react-dom/server` can fail to resolve. Its export map is
    // conditional (node, browser, workerd, edge-light and so on), and a
    // resolver that applies none of those conditions matches no branch at all:
    //
    //   Rolldown failed to resolve import "react-dom/server"
    //
    // which is what CodePen's build produced. See entry-server.jsx, which also
    // avoids the conditional subpath entirely.
    //
    // The aliases are the part that actually matters on CodePen, where this
    // build resolves no bare specifiers at all. Every one the SSR graph needs
    // is pinned to an absolute path above, which takes the resolver out of the
    // question entirely rather than trying to configure it correctly for a
    // machine I can't inspect.
    resolve: {
      conditions: ['node', 'import', 'module', 'default'],
      alias,
    },
    ssr: { target: 'node' },

    build: {
      ssr: path.join(ROOT, 'src', 'app', 'entry-server'),
      outDir: SSR_DIR,
      emptyOutDir: true,
      copyPublicDir: false,
      target: 'esnext',
    },
  });

  const entry = [result].flat()[0].output.find((c) => c.isEntry);
  await prerender(routes, entry.fileName, outDir);
}

export default defineConfig(() => {
  const { content, routes, input } = prepare();

  return {
    root: ROOT,
    appType: 'mpa',

    // Relative asset URLs. Vite defaults to `/`, which only works when the site
    // is served from a domain root, a page opened from any subpath asks for
    // /assets/main-<hash>.js and gets a 404. Every other path in this build is
    // resolved relative to the file that wants it; this is the last one.
    base: './',

    /**
     * Declared at the TOP level, not inside environments.client.
     *
     * The client environment inherits this, so it reads the same either way
     * here, but it does not read the same everywhere. A pipeline that drives
     * Vite through the legacy build path rather than the Environment API
     * builder only ever looks at this key. With `input` nested under
     * `environments`, such a build finds nothing to bundle and emits no assets
     * at all: the HTML ships untouched, its bare `react` imports and
     * extensionless paths unresolvable, and every page renders white.
     *
     * That is exactly what CodePen produced. Keeping the build declared here
     * means the worst case is fifty bundled pages without prerendered markup,
     * rendering client-side, degraded, but working.
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
        // Tells the fallback plugin to stand down. buildApp runs before any
        // environment is built, so this is set well before the client
        // environment's closeBundle fires.
        usingBuilder = true;

        note('buildApp ran; the fallback is not needed');

        const ssr = await builder.build(builder.environments.ssr);
        const entry = [ssr].flat()[0].output.find((c) => c.isEntry);
        await builder.build(builder.environments.client);
        await prerender(routes, entry.fileName);

        writeReport(OUT_DIR);
      },
    },

    plugins: [
      ...contentPlugins(),

      /**
       * Prerender even when the host never calls `buildApp`.
       *
       * The `builder` key below is the good path: it builds SSR, then client,
       * then prerenders, in that order. But a host is free to drive Vite
       * through its legacy build path instead, and then buildApp is simply
       * never invoked. The client environment gets built, nothing else does,
       * and the pass that puts the words into the HTML quietly doesn't run.
       *
       * CodePen does this. The deployed site was fifty correctly bundled pages
       * whose every `#root` was empty: 1,261 bytes where a prerendered page is
       * 8,924. It looked like success in a browser, because React filled them
       * in on load, and like nothing at all to a crawler, a link preview or
       * anyone with JavaScript off.
       *
       * `closeBundle` is late enough to be safe. The HTML is on disk by then,
       * with the asset links Vite injected, which is the version prerendering
       * has to modify.
       *
       * The outDir comes from the resolved config rather than the constant,
       * because a host that merges its own build options in may well have
       * changed it.
       */
      {
        name: 'prerender-fallback',
        apply: 'build',
        applyToEnvironment: (env) => env.name !== 'ssr',
        async closeBundle() {
          if (usingBuilder) return;

          const configured = this.environment?.config?.build?.outDir;
          const outDir = configured ? path.resolve(ROOT, configured) : OUT_DIR;

          // Loud, on every branch, via console rather than this.warn.
          //
          // A silent skip is indistinguishable from a silent success from the
          // outside: both give you a build that passes and pages that look
          // fine in a browser. That ambiguity cost a round trip, so this says
          // which path it took whether or not anything went wrong, and says it
          // through a channel the host's log level can't filter out.
          note('buildApp was not called by this host; running the fallback');

          // Never fail the host's build from in here.
          //
          // Prerendering is an enhancement on a site that already works: skip
          // it and the pages render client-side, which is where this project
          // was for its whole life until recently. A hook that can take the
          // whole deploy down with it is a worse outcome than one that
          // quietly does less, and the first version of this could, and did.
          try {
            await buildSsrAndPrerender(routes, outDir);
          } catch (err) {
            // A bundler error arrives wrapped in colour codes and twenty
            // frames of backtrace, none of which says anything. The useful
            // line is usually the resolver's, so keep the prose and drop the
            // machinery.
            const detail = String(err.message || err)
              // eslint-disable-next-line no-control-regex
              .replace(/\u001b\[[0-9;]*m/g, '')
              .split('\n')
              .map((l) => l.trimEnd())
              .filter((l) => l && !/^\s*\d+:|^Stack backtrace|^\s+at /.test(l))
              .slice(0, 6);

            note('SKIPPED, so these pages render client-side:');
            detail.forEach((l) => note(`  ${l}`));
            this.warn(`[prerender] skipped: ${detail[0] || err.message}`);
          }

          writeReport(outDir);
        },
      },


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
