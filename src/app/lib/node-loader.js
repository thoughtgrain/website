/**
 * node-loader.js — fill the content map from disk, in Node.
 *
 * The app loads content in the browser with `import.meta.glob` (see
 * content.js). The feeds can't: they're generated during the build, in the
 * Vite config, where there's no module graph to glob — just a filesystem.
 *
 * So this is the second of the two loaders. Both produce the same
 * `{ path: rawText }` shape and both hand it to the same `buildContent`, which
 * is what stops the feeds and the pages describing different sites. The keys
 * match Vite's glob output exactly, for the same reason.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '..', '..');
const CONTENT = path.join(SRC, 'content');

/** Every .mdx file under content/, keyed the way the browser glob keys them. */
export function readContent() {
  const raw = {};
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
          raw[`../content/${dir.name}/${file}`] = readFileSync(path.join(abs, file), 'utf8');
        });
    });
  return raw;
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

/**
 * The MDX component templates from components/.
 *
 * Content writes `<Pullquote text="…" />`; these supply the markup it expands
 * to. They have to reach `buildContent` the same way the content does, or the
 * tags survive into the feed as literal text.
 */
export function readComponents() {
  const dir = path.join(SRC, 'components');
  const out = {};
  readdirSync(dir)
    .filter((f) => f.endsWith('.html'))
    .forEach((file) => {
      out[file.replace(/\.html$/, '')] = readFileSync(path.join(dir, file), 'utf8');
    });
  return out;
}
