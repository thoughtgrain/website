/**
 * Demo.jsx: /projects/:slug/demo/ and /projects/:slug/demo/:machine/
 *
 * The demonstration of the MCP server. Not a description of it: the pages
 * replay the sessions it actually ran, from the records it wrote.
 *
 *   Demo      the featured machine's session as a player (see Session.jsx),
 *             then every other machine's session as a row, then the whole
 *             output as a filterable grid of thumbnails. The grid is
 *             prerendered in full; src/js/opxy-filter.js makes it live.
 *
 *   Machine   one machine's session, in full, with each frame and variant
 *             anchored by id so a hit in the grid lands on the step that
 *             produced it.
 *
 * Both read the manifest, which is only present during the server render.
 * Should a page ever render without it, it says so instead of showing an
 * empty page.
 */

import { content } from '../content.js';
import { relativeHref } from '../base.js';
import Link from '../Link';
import { OperatorShell } from '../components/operator/Shell';
import { Sprite } from '../components/operator/Sprite';
import { Session, statusOf } from '../components/operator/Session';
import {
  opxy, machines, machineById, cellLabel, totals, KIND_LABELS,
} from '../opxy.js';

const projectFor = (route) => {
  const slug = route.split('/').filter(Boolean)[1];
  return content.projects.find((p) => p.slug === slug) || null;
};

function NotFound() {
  return <main id="main"><div className="container section"><h1>Not found</h1></div></main>;
}

function NoIndex({ project }) {
  return (
    <OperatorShell project={project} here="Demonstration">
      <div className="container section">
        <h1>Demonstration</h1>
        <p className="lead">The session records are assembled when the site is published; this copy was rendered without them.</p>
      </div>
    </OperatorShell>
  );
}

/** The frame that stands for a machine: its rest frame, else its pick, else its first variant. */
function faceOf(m) {
  const frames = m.cells.filter((c) => c.kind === 'frame');
  return frames.find((c) => c.name === 'rest') || m.cells.find((c) => c.picked) || m.cells[0];
}

function Chip({ as: Tag = 'a', active, children, ...rest }) {
  return (
    <Tag className={`filter-bar__btn${active ? ' is-active' : ''}`} aria-pressed={active ? 'true' : 'false'} {...rest}>
      {children}
    </Tag>
  );
}

/* ---------------------------------------------------------- the demo page */

export function Demo({ route }) {
  const project = projectFor(route);
  if (!project) return <NotFound />;
  if (!opxy) return <NoIndex project={project} />;

  const featured = (project.heroMachine && machineById(project.heroMachine)) || machines()[0];
  const t = totals();
  const cats = Object.keys(opxy.categories);
  const demoHref = (path = '') => `/projects/${project.slug}/demo/${path}`;

  return (
    <OperatorShell project={project} here="Demonstration">
      <div className="container section screens">
        <header className="page-header page-header--left">
          <span className="kicker">The demonstration</span>
          <h1>Watch it design a screen</h1>
          <p className="lead">
            This is {featured.name}&rsquo;s real session, replayed from the records the server wrote as it ran:
            the directions it handed out, the five drawings that came back, what the uniqueness check measured,
            and the decisions I made, in my words at the time. Below it, every other machine&rsquo;s session,
            and every screen they produced.
          </p>
        </header>

        <section className="featured" aria-labelledby="featured-title">
          <h2 id="featured-title" className="featured__title">
            <Link to={demoHref(`${featured.id}/`)}>{featured.name}</Link>
            <span className="kicker">{opxy.categories[featured.category]?.singular} &middot; {featured.kind}</span>
          </h2>
          {featured.description && <p className="featured__dek">{featured.description}</p>}
          <Session m={featured} manifest={opxy} />
        </section>

        <section className="sessions" aria-labelledby="sessions-title">
          <h2 id="sessions-title" className="screens-cat__title">
            Every session <span className="screens-count">{t.machines}</span>
          </h2>
          <p className="screens-cat__dek">
            One row per machine: how many passes it took, what was picked, how far it got. Each opens the full replay.
          </p>
          <ul className="session-list">
            {machines().map((m) => {
              const s = statusOf(m);
              const face = faceOf(m);
              const bits = [
                `${s.passes} ${s.passes === 1 ? 'pass' : 'passes'}`,
                s.picked ? `pick ${s.picked}` : s.open ? s.open.replace(/_/g, ' ') : 'no pick yet',
                s.frames > 1 ? `${s.frames} frames` : s.frames === 1 ? 'rest frame' : null,
                s.motion ? 'motion' : null,
              ].filter(Boolean);
              return (
                <li key={m.id} className={`session-row${m === featured ? ' session-row--featured' : ''}`}>
                  <Link className="session-row__link" to={demoHref(`${m.id}/`)}>
                    {face && <span className="session-row__face"><Sprite machine={m} cell={face} alt="" /></span>}
                    <span className="session-row__text">
                      <span className="session-row__name">{m.name}</span>
                      <span className="session-row__meta kicker">{opxy.categories[m.category]?.singular} &middot; {m.kind}</span>
                      <span className="session-row__bits">{bits.join(' · ')}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="archive" aria-labelledby="archive-title">
          <h2 id="archive-title" className="screens-cat__title">
            Every screen it produced <span className="screens-count">{t.screens}</span>
          </h2>
          <p className="screens-cat__dek">
            The finished frames, every variant of every pass, and the picks that were cleaned up or kept.
            Filter by category and kind, or search the text that produced each one. A screen opens the step of its session.
          </p>

          <div
            className="filter-row screens-filter"
            data-screens-filter=""
            data-search={relativeHref(route, '/opxy/search.json')}
          >
            <span id="screens-cat-label" className="filter-row__label">Category</span>
            <div className="filter-bar" role="group" aria-labelledby="screens-cat-label" data-cat-bar="">
              <Chip href="#screens" data-cat="all" active>All</Chip>
              {cats.map((c) => <Chip key={c} href={`#${c}`} data-cat={c}>{opxy.categories[c].label}</Chip>)}
            </div>
            {/* Kind chips and the search box only do anything with JavaScript, so
                the HTML hides them and the enhancer shows them. Without it the
                grid is simply complete, in order, with the category jump links. */}
            <div className="screens-filter__js" data-js="" hidden>
              <span id="screens-kind-label" className="filter-row__label">Kind</span>
              <div className="filter-bar" role="group" aria-labelledby="screens-kind-label" data-kind-bar="">
                <Chip as="button" type="button" data-kind="all" active>All</Chip>
                {Object.keys(KIND_LABELS).map((k) => <Chip as="button" type="button" key={k} data-kind={k}>{KIND_LABELS[k]}</Chip>)}
              </div>
              <label className="screens-search">
                <span className="filter-row__label">Search the text behind each screen</span>
                <input className="input" type="search" data-q="" autoComplete="off" spellCheck="false" placeholder="glaze, survey plan, P3, hidden-line…" />
              </label>
            </div>
            <p className="visually-hidden" aria-live="polite" aria-atomic="true" data-live="" />
          </div>

          <div id="screens">
            {cats.map((cat) => {
              const members = machines().filter((m) => m.category === cat);
              if (!members.length) return null;
              const info = opxy.categories[cat];
              const count = members.reduce((n, m) => n + m.cells.length, 0);
              return (
                <section className="screens-cat" id={cat} data-cat={cat} key={cat} aria-labelledby={`cat-${cat}`}>
                  <h3 id={`cat-${cat}`} className="screens-cat__title screens-cat__title--sub">
                    {info.label} <span className="screens-count">{count}</span>
                  </h3>
                  <p className="screens-cat__dek">{info.description}</p>
                  {members.map((m) => (
                    <section className="screens-machine" data-machine={m.id} key={m.id} aria-labelledby={`m-${m.id}`}>
                      <h4 id={`m-${m.id}`} className="screens-machine__title">
                        <Link to={demoHref(`${m.id}/`)}>{m.name}</Link>
                        <span className="kicker">{m.kind} &middot; {m.cells.length} screens</span>
                      </h4>
                      <ul className="screens-grid">
                        {m.cells.map((c) => (
                          <li key={c.i} data-cell="" data-kind={c.kind} data-m={m.id} data-i={c.i}>
                            <Link className="screens-cell" to={demoHref(`${m.id}/#cell-${c.i}`)}>
                              <Sprite machine={m} cell={c} />
                              <span className="screens-cell__label">{cellLabel(m, c)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </section>
              );
            })}
          </div>

          <p className="empty-state" data-empty="" hidden>
            Nothing matches. <button type="button" className="btn btn--link" data-reset="">Clear the filters</button>
          </p>
        </section>
      </div>
    </OperatorShell>
  );
}

/* --------------------------------------------------------- one machine */

export function Machine({ route }) {
  const project = projectFor(route);
  if (!project) return <NotFound />;
  if (!opxy) return <NoIndex project={project} />;

  const id = route.split('/').filter(Boolean)[3];
  const m = machineById(id);
  if (!m) return <NotFound />;

  const all = machines();
  const at = all.indexOf(m);
  const prev = at > 0 ? all[at - 1] : null;
  const next = at < all.length - 1 ? all[at + 1] : null;
  const cat = opxy.categories[m.category] || {};
  const demoHref = (path = '') => `/projects/${project.slug}/demo/${path}`;
  const s = statusOf(m);

  return (
    <OperatorShell project={project} trail={[{ label: 'Demonstration', to: demoHref() }]} here={m.name}>
      <article className="container section machine">
        <header className="machine__head">
          <span className="kicker">{cat.singular || m.category} &middot; {m.kind}</span>
          <h1>{m.name}</h1>
          {(m.description || m.concept) && <p className="lead">{m.description || m.concept}</p>}
          <p className="machine__status kicker">
            {s.passes} {s.passes === 1 ? 'pass' : 'passes'}
            {s.picked ? ` · pick ${s.picked}` : ''}
            {s.frames > 1 ? ` · ${s.frames} frames` : s.frames === 1 ? ' · rest frame' : ''}
            {s.motion ? ' · motion' : ''}
          </p>
        </header>

        <Session m={m} manifest={opxy} />

        <nav className="machine__pager" aria-label="Other machines">
          {prev ? <Link to={demoHref(`${prev.id}/`)} rel="prev">&larr; {prev.name}</Link> : <span />}
          {next ? <Link to={demoHref(`${next.id}/`)} rel="next">{next.name} &rarr;</Link> : <span />}
        </nav>
      </article>
    </OperatorShell>
  );
}
