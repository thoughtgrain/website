# Architecture

A reference for how this site is actually built. Written for the maintainer (me,
in six months) so a small change doesn't mean re-reading everything.

---

## 1. Philosophy in one paragraph

Content is markdown with frontmatter, in `src/content/`. CSS is hand-written,
token-driven, in three layers. The build is Vite: it scans the content at config
time, generates one HTML entry per route, and prerenders each one to static HTML.
Deploy is GitHub Pages, from a single workflow. If something looks complicated,
it's worth questioning — this project has twice grown machinery it didn't need.

The core rules:

- **One output per route.** `/notes/your-first-note/` is a real file at a real
  path, prerendered to real HTML. No client-side router, no hash URLs, no SPA
  fallback to configure.
- **Content is the source of truth.** `src/content/` and `src/css/` are the site.
  Everything else is a way of turning them into pages, and has been replaced once
  already.
- **One way to do each thing.** The previous build had two paths for deciding
  whether anything had changed, and the bug lived in the gap between them.

Dependencies: Vite and React. That's a deliberate reversal — this was a
zero-dependency project, and the hand-rolled generator that bought grew to 5,665
lines across 42 modules before it was replaced by a config file and some
components.

---

## 2. Repository layout

```
website/
  vite.config.js               scans content, generates entries, emits feeds
  prerender.mjs                renders each route to static HTML
  package.json
  index.html                   generated — the home entry

  app/
    main.jsx                   mounts one page; imports the CSS in cascade order
    App.jsx                    the shell: nav, drawer, footer
    routes.jsx                 route string → page component
    content.js                 import.meta.glob → parsed collections
    base.js, Link.jsx          depth-prefix handling for relative links
    enhancers.js               re-exports the src/js progressive enhancers
    entry-server.jsx           the SSR entry prerender.mjs calls
    lib/
      frontmatter.js           YAML-lite parser
      markdown.js              markdown → HTML
      content-model.js         parse + derive + the route list
      feeds.js                 the eleven Atom feeds
    components/                Html, FeedLink, NoteList, TagFilter
    pages/                     one component per page type

  src/
    content/                   the site: .mdx entries + JSON config
    css/                       tokens.css, kit.css, site.css
    js/                        progressive enhancers
    layouts/                   the OLD templates — kept as reference only,
                               except styles.html, which /styles/ still renders

  .github/workflows/pages.yml  npm ci && npm run build → Pages
```

Generated at build time and gitignored: `index.html`, one directory per route at
the repo root, `.generated-routes.json`, `dist/`, `.ssr/`.

---

## 3. The build pipeline

Three passes, wired together by `npm run build`.

### 3.1 Config — `vite.config.js`

Runs in Node. `readdirSync` reads every `.mdx` and `.json` under `src/content/`
into a `{ path: rawText }` map, `buildContent` derives the collections, and
`routesFor` produces the route list. Then one HTML entry is written per route, at
the path it will be served from, and handed to `rollupOptions.input`.

Each entry is the same shell. The only things that differ are `data-route`,
which tells the app which page it is, and `data-base`, the prefix links need to
climb back to the root.

Entry generation writes directories at the repo root, so it refuses any route
whose first segment collides with a project directory and removes only what it
recorded creating. That guard caught a real collision on its first run: the
output directory was `build/` and the build-series posts route at `/build/<slug>/`.
Output is `dist/`.

### 3.2 Client build

Vite builds all fifty entries, bundling `app/` and the CSS. A plugin emits the
eleven Atom feeds — they need real files at real URLs, which no amount of client
rendering provides.

### 3.3 Prerender — `prerender.mjs`

A second Vite pass builds `app/entry-server.jsx` for Node, then this walks the
routes, calls `renderToString` for each, and injects the markup into that route's
shell. The words end up in the HTML: the site works with JS disabled, crawlers
and link previews see real content, and the output is genuinely static. React
hydrates rather than re-rendering.

### 3.4 One content model, two loaders

`app/lib/content-model.js` takes a `{ path: rawText }` map and returns the
collections and the route list. It does no I/O at all, which is the point:

- `vite.config.js` and `prerender.mjs` fill that map with `readdirSync`;
- `app/content.js` fills the same shape with `import.meta.glob`.

Both call `buildContent`, so the routes the config generates and the pages the
app renders cannot drift apart. The previous build had two different ways of
answering "what changed" and lost three rounds of debugging to the gap between
them.

---

## 4. Content model

### 4.1 Frontmatter

Every `.mdx` file opens with YAML between two `---` lines. The parser handles strings, numbers, booleans, and arrays of objects (for `toc:`). Common fields:

| Field | Used by | Notes |
|-------|---------|-------|
| `slug` | All | URL segment. Required. |
| `title` | All | Display title. |
| `summary` | Most | One-sentence dek under the title. |
| `date` | Articles, notes | Human date like `01 January 2026`. |
| `read` | Articles | Reading time, e.g. `5 min`. |
| `kind` | Articles | `Essay`, `Study`, or `Build series`. Routes the page. |
| `tag1`, `tag2`, `tag3` | Articles, projects | Up to three tags. Used in indexes + filters. |
| `toc` | Articles | Array of `{id, label}` for the in-page TOC. |
| `series` | Articles | Series label (any string). Triggers series UI. |
| `seriesPart` | Articles | Order within the series (number). |
| `category` | Projects | One of `Code`, `Design`, `Accessibility`, `Hardware`, `Experiments`. |
| `status` | Projects | `In progress` / `Ongoing` / `Maintained` / `Shipped` / `Paused`. |
| `month` | Notes | Used to group notes in the index. |
| `context` | Notes | Italic kicker beneath the body. |
| `image` | Notes | URL for an image note. |
| `imageAlt` | Notes | Required when `image` is set. |
| `caption` | Notes | Optional caption beneath the image. |

### 4.2 MDX components

Four custom tags are recognised in article bodies. Each maps to `src/components/<Name>.html` with `{{prop}}` placeholders.

- `<Dropcap text="…" />` — display-typeface initial on the opening paragraph.
- `<Pullquote text="…" cite="…" />` — bordered quote with attribution.
- `<PullquoteNoCite text="…" />` — same, no attribution.
- `<MarginaliaPin text="…" />` — small note in the right gutter on wide viewports.

To add a new component: drop `src/components/<Name>.html` with the placeholders, then reference it as `<Name prop="value" />` in MDX. No code change needed — `lib/parse/components.js` loads whatever is in that directory.

### 4.3 Notes can be text or image

A note's body is text by default. If the frontmatter has `image:` (and `imageAlt:`), the row renders a `<figure>` instead. If both an `image:` and a body are present, the first body paragraph becomes the caption.

---

## 5. Article kinds and routing

`kind:` in article frontmatter drives where the page lives.

| `kind:` | Route | Index |
|---------|-------|-------|
| `Essay` (default) | `/essays/<slug>/` | `/essays/` |
| `Study` | `/studies/<slug>/` | `/studies/` |
| `Build series` | `/build/<slug>/` | linked from `/colophon/` |

Build-series posts also carry `series: "Building this site"` and `seriesPart: 1..5`, which triggers the series UI. They use the same article layout (`article.html`) and the same `buildWritingReader` function — only the directory and the back-link change.

---

## 6. Pages and routing

`app/routes.jsx` maps a route string to a component. Pure dispatch, no router
library — every page is a real file that knows its own route, so there is no
history to manage, no links to intercept and no fallback to configure. Patterns
are tried in order, so a fixed second segment has to come before the pattern that
would swallow it as a slug: `/essays/tag/x/` before `/essays/:slug/`.

An unmatched route throws rather than rendering blank, because the only way to
get one is for `routesFor()` and this table to have drifted.

The old hand-rolled `{{var}}` / `{{#each}}` / `{{#if}}` template engine is gone;
React does that job. The one place its output survives is `/styles/`, which still
renders `src/layouts/styles.html` as raw HTML — 369 lines of static specimen with
`{{basePath}}` as its only variable, so converting it to JSX would have been
transcription risk for no gain.

---

## 7. The markdown parser

`parseMarkdown(md)` is a line-by-line state machine. Handles:

- Headings (`# … ######`) — `id` slugified from the text so TOC anchors work.
- Paragraphs.
- Unordered lists (`-` or `*`).
- Blockquotes (`> `).
- Horizontal rules (`---`).
- Fenced code blocks (` ``` `), with optional language tag. Content is HTML-escaped before being emitted inside `<pre><code class="language-xxx">…</code></pre>`.
- Inline: `**bold**`, `*italic*`, `` `code` ``, `[link](url)`.
- Raw HTML / JSX-style component tags at the start of a line — emitted verbatim so block components don't get wrapped in `<p>`.

What it doesn't handle: ordered lists, nested lists, tables, images, footnotes (those use `<Footnote>` component shorthand instead), reference-style links.

---

## 8. CSS architecture

Three files, concatenated into `dist/css/style.css` at build time.

### 8.1 `tokens.css` — foundations

- **Palette**, in OKLCH, with semantic aliases (`--bg`, `--fg`, `--accent`, etc).
- **Type scale**, sizes named `--t-h1` through `--t-micro`.
- **Spacing scale**, `--s-1` through `--s-11` in 4/8px steps.
- **Radii**, `--r-1` through `--r-card`.
- **Shadows**, mostly `none` in this design.
- **Motion** (`--ease-out`, `--dur-fast`).
- **Paper grain SVG** in `--paper-noise` and `--paper-flecks`.

Dark mode overrides the same custom properties under `[data-theme="dark"]`.

### 8.2 `kit.css` — components

The reusable patterns: `.btn`, `.tag`, `.kicker`, `.input`, `.essay-card`, `.project-tile`, `.note-item`, `.site-nav`, `.site-footer`, `.subscribe-card`, `.reader`. BEM-ish: `.essay-card__title`, `.note-item__figure`. No utility classes.

### 8.3 `site.css` — page-specific

The hero, the page header, sections, the grids, per-page blocks (CV, work history, podcasts grid, music shelf, movie diary), the drawer, the series nav, the build-series list, the code block surface, the paper grain layers (`body::before`, `body::after`), the glass nav.

### 8.4 Code blocks

`--bg-code` is a separate token from `--bg-sunken` (slightly darker warm cream / slightly lighter warm ink). Inline `code` and `pre` both sit on this surface. `pre` gets a hairline border and a 3px `--accent-soft` left rule. No syntax highlighting.

### 8.5 Paper grain

Two fixed full-viewport layers behind everything, `body::before` (broad grain) and `body::after` (sparse darker flecks). Driven by SVG `feTurbulence` + `feComponentTransfer` to threshold the alpha into discrete specks. Opacity is controlled by `--grain-opacity`, written every frame by `texture.js` from smoothed scroll velocity, so the grain dims during scroll and breathes back when motion stops. `prefers-reduced-motion: reduce` hides the layers entirely.

### 8.6 Glass nav

`.site-nav` is a full-width sticky strip with `backdrop-filter: blur(14px) saturate(140%)` over a 62% translucent `--bg`. Content stays in the 720px column via a `.site-nav__inner` wrapper. A `.site-nav::after` band just below the bar runs its own smaller `backdrop-filter: blur(6px)` with a top-to-bottom mask, so content scrolling under the bar passes through a soft blur ramp instead of a hard line.

---

## 9. JavaScript

Each file is wrapped in an IIFE, attaches its listeners on `DOMContentLoaded`, and bails early if the elements it expects aren't on the page. All files are concatenated into `dist/js/main.js` at build time.

### 9.1 `theme.js`

Reads `dwt-theme` from `localStorage`, sets/removes `data-theme="dark"` on `<html>`. Toggle button is `#theme-toggle`. Applies the theme synchronously before `DOMContentLoaded` to avoid a flash.

### 9.2 `nav.js`

Wires `#menu-open` to open `#site-menu-dialog` (the drawer), marks background siblings `inert`, focuses the dialog heading, traps tab focus, closes on `Esc` or `#menu-close`. Bails if `#menu-open` is missing.

### 9.3 `tag-filter.js`

On any index page with `[data-tags]` items and a `.filter-bar`, filters by tag without a reload.

### 9.4 `texture.js` — paper-grain fade

Samples scroll velocity per event, exponentially smooths it (`SMOOTH_IN`), and writes `--grain-opacity` on `<body>` each animation frame. A `requestAnimationFrame` loop decays the smoothed velocity (`SMOOTH_OUT`) once events stop. The grain dims toward `MIN_OPACITY` during motion and eases back to 1 over a few seconds.

Tunables at the top of the file:

```js
var MIN_OPACITY = 0.3;
var VEL_TO_FADE = 0.3;
var SMOOTH_IN = 0.06;
var SMOOTH_OUT = 0.97;
```

Bails entirely if `prefers-reduced-motion: reduce`.

### 9.5 `accessibility.js`, `floorboards.js`

Reserved placeholders. Kept so the concat order stays stable.

---

## 10. Nav configuration (`nav.json`)

The single source of truth for what appears in the drawer and the footer. Each item has an `enabled` flag.

```json
{
  "groups": [
    {
      "id": "writing",
      "label": "Writing",
      "items": [
        { "label": "Notes",   "href": "notes/",   "note": "Fragments",     "enabled": true  },
        { "label": "Essays",  "href": "essays/",  "note": "The long ones", "enabled": false }
      ]
    }
  ],
  "footerExtras": [
    { "label": "RSS",   "href": "feed.xml" },
    { "label": "Email", "href": "mailto:{{email}}" }
  ]
}
```

`lib/render/nav.js`'s `renderDrawerNav()` and `renderFooterNav()` walk the groups, filter by `enabled`, and emit HTML containing `{{basePath}}` (which the template engine resolves per-page). A group with zero enabled items is dropped entirely so no orphan headings appear.

Pages still build whether or not they're in the nav — disabling a route only removes it from the menus. Direct URLs continue to work, so deferred pages can be shared as preview links.

The current launch set is **Home, Now, Notes, About, Colophon**. Everything else is `"enabled": false`.

---

## 11. The series concept

Series is a structural relationship between articles — parts of one piece. Distinct from `tags` (topical) and the related-articles block ("you might also like").

Any article can opt into a series:

```yaml
series: "Building this site"
seriesPart: 3
```

Articles sharing a `series:` value are grouped and sorted by `seriesPart`. The article reader for a series article gets two new blocks:

- **Series TOC** at the top of the body — every part listed, current marked with "You are here" and rendered as a non-link.
- **Prev/Next** at the bottom — walks the series linearly, omits prev on first part and next on last.

When an article is in a series, the existing related + read-next blocks are suppressed. The series replaces them.

Build series posts (`kind: "Build series"`) all set `series: "Building this site"`. Future essays can use the same machinery for any multi-part piece.

---

## 12. Deploy

`.github/workflows/pages.yml` runs on push to `main` and `claude/**`:
`npm ci`, then `npm run build`, then uploads `dist/` to Pages. `npm ci` rather
than `npm install` so the lockfile is authoritative and CI can't quietly build a
different dependency tree than local.

`dist/` is not committed. It was, under the old generator, which meant every
commit carried a diff of the built site.

---

## 13. Common tasks

### 13.1 Add an essay, study or note

Drop a numbered `.mdx` file in the right folder under `src/content/`. Filenames
set the order, which is why they're numbered. Frontmatter needs at least `slug`,
`title` and `date`; essays and studies also take `kind`, `summary`, `read` and up
to three tags. Run `npm run dev` and it appears — the route is generated from the
content, so nothing else needs touching.

### 13.2 Add a page type

1. Write the component in `app/pages/`.
2. Add its pattern to the table in `app/routes.jsx`.
3. If it needs new routes, add them to `routesFor()` in `app/lib/content-model.js`.

### 13.3 Change a colour or type token

`src/css/tokens.css`. Everything else reads from it.

### 13.4 Flip a nav item on or off

`src/content/nav.json`, the `enabled` flag. Both the drawer and the footer read
from it. The item's page still builds, so a direct URL keeps working.

### 13.5 Add a product image

Save it as `src/assets/products/<slug>.{jpg,png,webp}`. It gets picked up by
glob. There's no scraping any more — the old build fetched `og:image` over the
network on every run, against a cache directory that didn't exist.

---

## 14. Known quirks and lessons

- **Don't detect change with metadata you don't control.** The old build compared
  file size and mtime. On iOS under File Provider Storage, mtimes aren't
  dependable, so an edited note read as unchanged and never re-rendered.
- **An optimisation that can make the build look broken is not worth 45ms.** A
  fingerprint check that skipped the render when nothing had changed produced
  "it builds the first time, then nothing" — twice — for 45ms of a 125ms build.
- **One way to answer a question, not two.** Staleness checking walked the
  entries already in the manifest, so an added or deleted file was invisible to
  it. One code path escaped that by luck; the others didn't.
- **A decision to skip work has to show its evidence.** Every round of debugging
  that build was lost to something it decided silently.
- **The file browser caches.** The symptom that started the last rewrite was a
  page that "wouldn't update". It had updated; Code App was showing a stale copy.
- **CSS grid `1fr` carries an implicit `min-width: min-content`.** An image in a
  grid cell expands it to the image's intrinsic width unless you use
  `minmax(0, 1fr)` and `min-width: 0` on the body cell. This bit the image-note row.
- **Fixed-position noise behind moving content triggers motion sickness.** The
  grain fade in `texture.js` is an accessibility default, with a hard opt-out
  under `prefers-reduced-motion`.
- **GitHub Pages holds the previous version at the edge for a few minutes.** Hard
  refresh and wait before debugging a deploy.

---

## 15. The reading order

If a new person inherits this repo, the order I'd hand them:

1. This file.
2. `docs/GETTING_STARTED.md`.
3. `vite.config.js`, then `app/lib/content-model.js` → `app/routes.jsx` → `app/pages/`.
4. `src/css/tokens.css`, then `kit.css`, then `site.css`.
5. The Build series essays at `/build/building-this-site-N-…/`.

Total reading time: about an hour. After that they should be able to fix anything in here without asking.
