/**
 * node-loader.js — fill the content map from disk, in Node.
 *
 * Lives beside vite.config.js rather than under src/app/, and that placement is
 * deliberate. This is build-time code: it imports `yaml` and reads the
 * filesystem, neither of which means anything in a browser. When it sat in the
 * app tree, CodePen scanned it as app code and put `yaml` into the page's
 * runtime importmap — a Node parser shipped to the browser for no reason.
 * Build-time code belongs beside the build.
 *
 * The app loads content with `import.meta.glob` over the compiled MDX modules.
 * The feeds can't: they're generated inside the Vite config, where there's no
 * module graph to glob — just a filesystem.
 *
 * So this is the second of the two loaders. Both produce the same
 * `{ path: { frontmatter, default } }` shape and both hand it to the same
 * `buildContent`, which is what stops the feeds and the pages describing
 * different sites. Keys match Vite's glob output exactly, for the same reason.
 *
 * The frontmatter is parsed with `yaml` — the same engine remark-frontmatter
 * uses — rather than a second hand-written parser. That matters: the previous
 * arrangement had two parsers that agreed on most fields and disagreed on
 * types, which is exactly the kind of drift that only shows up in production.
 *
 * `default` is a stub here. The feeds need metadata and nothing else: every
 * entry's summary comes from frontmatter, so no body ever has to be rendered
 * to produce one.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const SRC = path.join(import.meta.dirname, 'src');
const CONTENT = path.join(SRC, 'content');

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** The YAML block at the top of an .mdx file, as an object. */
function frontmatterOf(raw, file) {
  const m = raw.match(FRONTMATTER);
  if (!m) return {};
  try {
    return parseYaml(m[1]) || {};
  } catch (err) {
    throw new Error(`invalid frontmatter in ${file}: ${err.message}`);
  }
}

/** Every .mdx file under content/, keyed the way the browser glob keys them. */
export function readContent() {
  const out = {};
  readdirSync(CONTENT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .forEach((dir) => {
      const abs = path.join(CONTENT, dir.name);
      readdirSync(abs)
        .filter((f) => f.endsWith('.mdx'))
        // Content files are numbered (01-, 02-, …) and that filename order IS
        // their display order, so sort before reading.
        .sort()
        .forEach((file) => {
          const full = path.join(abs, file);
          out[`../content/${dir.name}/${file}`] = {
            frontmatter: frontmatterOf(readFileSync(full, 'utf8'), full),
            default: null,
          };
        });
    });
  return out;
}

/** The structured JSON that configures the site rather than filling it. */
export function readData() {
  const data = {};
  readdirSync(CONTENT)
    .filter((f) => f.endsWith('.json'))
    .forEach((file) => {
      data[file.replace(/\.json$/, '')] = JSON.parse(readFileSync(path.join(CONTENT, file), 'utf8'));
    });
  return data;
}
