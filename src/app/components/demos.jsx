/**
 * demos.jsx: the interactive figures the build-series posts use.
 *
 * These are the only stateful components in the app. Everything else renders
 * once and stays put, so three rules apply here that apply nowhere else:
 *
 * 1. They must read correctly with no JavaScript. Every page on this site is
 *    prerendered so that a reader with JS off, a crawler and a link preview all
 *    get real content. A demo that renders an empty box until React boots would
 *    quietly undo that for six posts. So each one ships with a real worked
 *    example already selected, interacting CHANGES the example, it isn't how
 *    you get one.
 *
 * 2. Initial state must be deterministic. No Date.now, no randomness, no
 *    reading `window` during render. If the server's markup and React's first
 *    client render disagree, React discards the prerendered HTML and rebuilds,
 *    which is both a flash and a waste of the work.
 *
 * 3. Native controls, not div soup. Radios in a fieldset, a real legend,
 *    results in a live region. The visual layout is a convenience; the source
 *    order is the actual document.
 *
 * They also import the real implementations, `relativeHref` from base.js, the
 * real route list from the content model. A demo that reimplements the thing it
 * documents is a demo that drifts. These can't: change the code and the figure
 * changes with it.
 */

import { useId, useState } from 'react';

import { relativeHref } from '../base.js';
import { content } from '../content.js';
import { routesFor } from '../lib/content-model.js';

/* ---------------------------------------------------------------- scaffold */

/**
 * The shared frame: a caption, the controls, and a live region for the output.
 *
 * `aria-live="polite"` on the output means a screen reader announces the new
 * example when you change the selection. Without it the demo is silent to
 * anyone not watching the pixels change, the interaction appears to do
 * nothing.
 */
function Figure({ title, note, controls, children }) {
  return (
    <figure className="demo">
      <figcaption className="demo__caption">
        <span className="kicker">Figure</span>
        <span className="demo__title">{title}</span>
      </figcaption>
      {controls}
      <div className="demo__output" aria-live="polite">{children}</div>
      {note && <p className="demo__note t-small">{note}</p>}
    </figure>
  );
}

/**
 * A radio group. Deliberately real radios: arrow keys move between them, the
 * group is announced as a group, and the legend says what's being chosen.
 * A row of <button>s would need a roving tabindex and three ARIA attributes to
 * get back to what the platform gives away for free.
 */
function Choice({ legend, options, value, onChange, name }) {
  return (
    <fieldset className="demo__choice">
      <legend className="demo__legend">{legend}</legend>
      <div className="demo__options">
        {options.map((opt) => {
          const v = typeof opt === 'string' ? opt : opt.value;
          const label = typeof opt === 'string' ? opt : opt.label;
          return (
            <label className="demo__option" key={v}>
              <input
                type="radio"
                name={name}
                value={v}
                checked={value === v}
                onChange={() => onChange(v)}
              />
              <span>{label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Route "/notes/x/" to its path segments. */
const segmentsOf = (route) => (route === '/' ? [] : route.slice(1, -1).split('/'));

/** The `../` prefix a page at this route needs to reach the site root. */
const baseOf = (route) => {
  const n = segmentsOf(route).length;
  return n ? '../'.repeat(n) : './';
};

/* ------------------------------------------------------------- the figures */

/**
 * RouteExplorer: pick a route, see the HTML the build writes for it.
 *
 * The routes come from `routesFor(content)`, the same function the build calls,
 * so this list is the real one. Add a note to src/content and it appears here.
 */
export function RouteExplorer({ routes: given }) {
  const all = given || routesFor(content);
  // A handful that show different depths, rather than all fifty in a radio
  // group. Falls back gracefully if a slug is ever renamed.
  const preferred = ['/', '/about/', '/notes/', '/essays/your-first-essay/', '/projects/cat/code/'];
  const choices = preferred.filter((r) => all.includes(r));
  const [route, setRoute] = useState(choices[1] || choices[0] || '/');
  const name = useId();

  const segments = segmentsOf(route);
  const base = baseOf(route);
  const file = segments.length ? `${segments.join('/')}/index.html` : 'index.html';

  return (
    <Figure
      title="One route, one file"
      note={`Depth ${segments.length}. Every path in that file climbs ${segments.length || 'no'} level${segments.length === 1 ? '' : 's'} to reach the root.`}
      controls={<Choice legend="Route" name={name} options={choices} value={route} onChange={setRoute} />}
    >
      <p className="demo__path">
        <span className="demo__path-label">writes</span> <code>{file}</code>
      </p>
      <pre className="demo__code"><code>{`<div id="root"
     data-route="${route}"
     data-base="${base}"></div>
<script type="module" src="${base}src/app/main"></script>`}</code></pre>
    </Figure>
  );
}

/**
 * PathResolver: watch relativeHref work.
 *
 * Calls the actual function from base.js. The shared-prefix count and the
 * number of `../` are derived the same way the implementation derives them, so
 * if that algorithm changes this figure changes too.
 */
export function PathResolver() {
  const froms = ['/', '/notes/', '/essays/your-first-essay/', '/projects/cat/code/'];
  const tos = ['/', '/notes/', '/essays/', '/feed.xml'];
  const [from, setFrom] = useState('/projects/cat/code/');
  const [to, setTo] = useState('/notes/');
  const nameFrom = useId();
  const nameTo = useId();

  const fromSegs = segmentsOf(from);
  const toSegs = to.split('/').filter(Boolean);
  let shared = 0;
  while (shared < fromSegs.length && shared < toSegs.length
         && fromSegs[shared] === toSegs[shared]) shared += 1;

  const href = relativeHref(from, to);
  const up = fromSegs.length - shared;

  return (
    <Figure
      title="Resolving a link"
      note="Computed by the same relativeHref() the site uses. The segments both paths already share are dropped; the rest is climbed."
      controls={(
        <>
          <Choice legend="Reading this page" name={nameFrom} options={froms} value={from} onChange={setFrom} />
          <Choice legend="Linking to" name={nameTo} options={tos} value={to} onChange={setTo} />
        </>
      )}
    >
      <dl className="demo__facts">
        <div><dt>Shared segments</dt><dd>{shared || 'none'}</dd></div>
        <div><dt>Levels to climb</dt><dd>{up || 'none'}</dd></div>
        <div><dt>Written into the page</dt><dd><code>{href}</code></dd></div>
        <div><dt>Browser resolves to</dt><dd><code>{to}</code></dd></div>
      </dl>
    </Figure>
  );
}

/** BuildStepper: what exists on disk after each phase of one `vite build`. */
const PHASES = [
  {
    label: 'Read',
    body: 'readdirSync walks src/content. Twenty-three .mdx files and seven .json configs become one { path: module } map.',
    tree: ['src/content/…  23 .mdx', '(nothing written yet)'],
  },
  {
    label: 'Derive',
    body: 'buildContent turns that map into collections; routesFor turns the collections into the list of pages the site publishes.',
    tree: ['50 routes, in memory'],
  },
  {
    label: 'Write entries',
    body: 'One HTML shell per route, at the path it will be served from. Each carries its own data-route and data-base. Still empty inside.',
    tree: ['index.html', 'about/index.html', 'notes/your-first-note/index.html', '…47 more'],
  },
  {
    label: 'Bundle',
    body: 'Vite builds the SSR entry, then the client: all fifty shells plus the app and the CSS, hashed and rewritten to point at the real assets.',
    tree: ['dist/index.html', 'dist/assets/main-[hash].js', 'dist/assets/main-[hash].css'],
  },
  {
    label: 'Prerender',
    body: 'renderToString runs each route through the SSR bundle and injects the markup into that route’s shell. The words are now in the HTML.',
    tree: ['dist/**/index.html (filled)', 'dist/**/feed.xml, feed.json'],
  },
];

export function BuildStepper() {
  const [i, setI] = useState(0);
  const name = useId();
  const phase = PHASES[i];

  return (
    <Figure
      title="One command, five phases"
      note="All of it inside a single `vite build`. It used to be three chained commands, which worked locally and nowhere that just runs the one."
      controls={(
        <Choice
          legend="Phase"
          name={name}
          options={PHASES.map((p, n) => ({ value: String(n), label: `${n + 1}. ${p.label}` }))}
          value={String(i)}
          onChange={(v) => setI(Number(v))}
        />
      )}
    >
      <p className="demo__step-body">{phase.body}</p>
      <ul className="demo__tree">
        {phase.tree.map((line) => <li key={line}><code>{line}</code></li>)}
      </ul>
    </Figure>
  );
}

/** LoaderCompare: the same file, read two ways, producing the same key. */
export function LoaderCompare() {
  const [side, setSide] = useState('browser');
  const name = useId();

  const isBrowser = side === 'browser';
  return (
    <Figure
      title="Two readers, one key"
      note="Both hand their map to the same buildContent. The keys have to match exactly, or the feeds and the pages would describe different sites."
      controls={(
        <Choice
          legend="Reader"
          name={name}
          options={[
            { value: 'browser', label: 'In the app' },
            { value: 'node', label: 'In the build' },
          ]}
          value={side}
          onChange={setSide}
        />
      )}
    >
      <pre className="demo__code"><code>{isBrowser
        ? `import.meta.glob('../content/**/*.mdx', { eager: true })

// → { '../content/notes/01-your-first-note.mdx': { frontmatter, default } }`
        : `readdirSync(CONTENT, { withFileTypes: true })
  // …then, per file:
  out['../content/' + dir + '/' + file] = { frontmatter, default: null }

// → { '../content/notes/01-your-first-note.mdx': { frontmatter, default } }`}</code></pre>
      <p className="demo__step-body">
        {isBrowser
          ? 'Vite’s glob, compiled MDX modules, used to render every page.'
          : 'Node’s filesystem, frontmatter only, used to build the feeds, where there is no module graph to glob.'}
      </p>
    </Figure>
  );
}

/** FeedFormats. One set of entries, serialised two ways. */
export function FeedFormats() {
  const [format, setFormat] = useState('atom');
  const name = useId();

  const samples = {
    atom: `<entry>
  <title>Your first essay</title>
  <link href="https://example.com/essays/your-first-essay/" />
  <id>https://example.com/essays/your-first-essay/</id>
  <updated>2026-01-01T00:00:00.000Z</updated>
</entry>`,
    json: `{
  "id": "https://example.com/essays/your-first-essay/",
  "url": "https://example.com/essays/your-first-essay/",
  "title": "Your first essay",
  "date_published": "2026-01-01T00:00:00.000Z"
}`,
  };

  return (
    <Figure
      title="The same entries, twice"
      note="Both serialisers share one orderEntries(), so the two formats cannot drift into listing different items or a different order."
      controls={(
        <Choice
          legend="Format"
          name={name}
          options={[
            { value: 'atom', label: 'Atom (feed.xml)' },
            { value: 'json', label: 'JSON Feed (feed.json)' },
          ]}
          value={format}
          onChange={setFormat}
        />
      )}
    >
      <pre className="demo__code"><code>{samples[format]}</code></pre>
    </Figure>
  );
}

export const demoComponents = {
  RouteExplorer, PathResolver, BuildStepper, LoaderCompare, FeedFormats,
};
