import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

import { renderFeeds } from './src/app/lib/feeds.js';
import { readContent, readData } from './src/app/lib/node-loader.js';
import { buildContent } from './src/app/lib/content-model.js';

/**
 * vite.config.js — a standard Vite app, shaped the way CodePen's blocks expect.
 *
 * `readdirSync` runs in Node at config time and collects every HTML file as an
 * entry. Today that's just `index.html` at the root: the site is a client-side
 * SPA, so one shell serves every route and react-router decides what to draw.
 * The glob is kept rather than hard-coding `index.html` because it's the shape
 * CodePen's own template uses, and because adding a second page later should
 * need no config change.
 *
 * https://rolldown.rs/reference/InputOptions.input
 */
const input = readdirSync(process.cwd(), { recursive: true })
  .filter(
    (file) =>
      file.endsWith('.html')
      && !file.split(path.sep).includes('node_modules')
      && !file.split(path.sep).includes('dist')
      // Only real pages. src/layouts holds the previous generator's templates:
      // .html, but not pages, and a recursive glob happily turns them into
      // entries.
      && !file.split(path.sep).includes('layouts'),
  )
  .map((file) => `./${file}`);

if (input.length === 0) {
  throw new Error('No entry point files found.');
}

export default defineConfig({
  plugins: [
    /**
     * Content is real MDX: the .mdx files compile to React components and
     * their tags — <Pullquote>, <Dropcap> — resolve against the map in
     * app/components/mdx.jsx.
     *
     * Both remark plugins are required, not optional. Without them the
     * frontmatter block isn't metadata at all: MDX reads `---` as a thematic
     * break and the slug, title and toc render as visible body text.
     *
     * `enforce: 'pre'` so this runs before the React plugin, which needs JSX
     * rather than MDX.
     */
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
      }),
    },
    react(),

    /**
     * The eleven Atom feeds.
     *
     * These are the one thing a client-rendered SPA genuinely cannot produce:
     * a feed reader asks for /feed.xml and gets whatever the server has, with
     * no chance to run JavaScript first. So they're generated at build time
     * from the same content model the app renders, and emitted as assets.
     */
    {
      name: 'site-feeds',
      apply: 'build',
      generateBundle() {
        const content = buildContent(readContent(), readData());
        renderFeeds(content).forEach(({ fileName, source }) => {
          this.emitFile({ type: 'asset', fileName, source });
        });
        // Every feed opens with <?xml-stylesheet href="/feed.xsl"?>, so the
        // stylesheet has to ship too or a browser rendering a feed 404s.
        this.emitFile({
          type: 'asset',
          fileName: 'feed.xsl',
          source: readFileSync(path.join(import.meta.dirname, 'src', 'feed.xsl'), 'utf8'),
        });
      },
    },
  ],

  build: {
    rolldownOptions: { input },
    target: 'esnext',
  },

  resolve: {
    alias: {
      // import.meta.dirname, not __dirname — this file is an ES module.
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
});
