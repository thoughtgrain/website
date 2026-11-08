/**
 * Screens.jsx: /projects/:slug/screens/ and /projects/:slug/screens/:machine/
 *
 * The archive of every screen the OP-XY project produced. Two pages:
 *
 *   Screens   every frame as a thumbnail, grouped by category then machine,
 *             with filters. The grid is prerendered in full, so without
 *             JavaScript it is a long, complete page whose category chips are
 *             jump links. With it, src/js/opxy-filter.js turns the chips into
 *             live filters, reveals the kind chips and the search box, and
 *             fetches the text index the first time someone types.
 *
 *   Machine   one machine: its finished frames at the device's own size, every
 *             control at 0/50/100, then every design pass with the text that
 *             produced each variant, the sheets and the motion clips. Each
 *             cell has an id the grid links to, so a search hit lands on the
 *             frame and its words together.
 *
 * Both read the manifest, which is only present during the server render.
 * Should a page ever render without it, it says so instead of showing an
 * empty grid.
 */

import { content } from '../content.js';
import { relativeHref } from '../base.js';
import Link from '../Link';
import { OperatorShell } from '../components/operator/Shell';
import { Motion, Sheet, Sprite, Strip } from '../components/operator/Sprite';
import {
  opxy, machines, machineById, controlLabel, cellLabel, asList, totals, KIND_LABELS,
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
    <OperatorShell project={project} current="screens">
      <div className="container section">
        <h1>Screens</h1>
        <p className="lead">The screen archive is assembled when the site is published; this copy was rendered without it.</p>
      </div>
    </OperatorShell>
  );
}

/* ------------------------------------------------------------ the grid */

function Chip({ as: Tag = 'a', active, children, ...rest }) {
  return (
    <Tag
      className={`filter-bar__btn${active ? ' is-active' : ''}`}
      aria-pressed={active ? 'true' : 'false'}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Screens({ route }) {
  const project = projectFor(route);
  if (!project) return <NotFound />;
  if (!opxy) return <NoIndex project={project} />;

  const t = totals();
  const cats = Object.keys(opxy.categories);
  const screensHref = (path) => `/projects/${project.slug}/screens/${path}`;

  return (
    <OperatorShell project={project} current="screens">
      <div className="container section screens">
        <header className="page-header page-header--left">
          <span className="kicker">The archive</span>
          <h1>Every screen</h1>
          <p className="lead">
            {t.screens} screens for {t.machines} machines: the finished frames, every variant of every
            design pass, and the picks that were cleaned up or kept for reference. Each one links to the
            words that produced it.
          </p>
        </header>

        <div
          className="filter-row screens-filter"
          data-screens-filter=""
          data-search={relativeHref(route, '/opxy/search.json')}
        >
          <span id="screens-cat-label" className="filter-row__label">Category</span>
          <div className="filter-bar" role="group" aria-labelledby="screens-cat-label" data-cat-bar="">
            <Chip href="#screens" data-cat="all" active>All</Chip>
            {cats.map((c) => (
              <Chip key={c} href={`#${c}`} data-cat={c}>{opxy.categories[c].label}</Chip>
            ))}
          </div>

          {/* Kind chips and the search box only do anything with JavaScript, so
              the HTML hides them and the enhancer shows them. Without it the
              page is simply the whole archive, in order. */}
          <div className="screens-filter__js" data-js="" hidden>
            <span id="screens-kind-label" className="filter-row__label">Kind</span>
            <div className="filter-bar" role="group" aria-labelledby="screens-kind-label" data-kind-bar="">
              <Chip as="button" type="button" data-kind="all" active>All</Chip>
              {Object.keys(KIND_LABELS).map((k) => (
                <Chip as="button" type="button" key={k} data-kind={k}>{KIND_LABELS[k]}</Chip>
              ))}
            </div>
            <label className="screens-search">
              <span className="filter-row__label">Search the text behind each screen</span>
              <input
                className="input"
                type="search"
                data-q=""
                autoComplete="off"
                spellCheck="false"
                placeholder="glaze, survey plan, P3, hidden-line…"
              />
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
                <h2 id={`cat-${cat}`} className="screens-cat__title">
                  {info.label} <span className="screens-count">{count}</span>
                </h2>
                <p className="screens-cat__dek">{info.description}</p>

                {members.map((m) => (
                  <section className="screens-machine" data-machine={m.id} key={m.id} aria-labelledby={`m-${m.id}`}>
                    <h3 id={`m-${m.id}`} className="screens-machine__title">
                      <Link to={screensHref(`${m.id}/`)}>{m.name}</Link>
                      <span className="kicker">{m.kind} &middot; {m.cells.length} screens</span>
                    </h3>
                    {m.description && <p className="screens-machine__dek">{m.description}</p>}
                    <ul className="screens-grid">
                      {m.cells.map((c) => (
                        <li key={c.i} data-cell="" data-kind={c.kind} data-m={m.id} data-i={c.i}>
                          <Link className="screens-cell" to={screensHref(`${m.id}/#cell-${c.i}`)}>
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
      </div>
    </OperatorShell>
  );
}

/* --------------------------------------------------------- one machine */

function Variant({ m, cell }) {
  const n = cell.variant ? cell.variant.slice(1) : '';
  const tags = [
    cell.pattern && cell.patternName ? `${cell.pattern} ${cell.patternName}` : cell.pattern || cell.patternName,
    cell.drawingLanguage,
    cell.angle,
    cell.reason && `kept as ${cell.reason}`,
    cell.fromPass && cell.kind !== 'pass' && `from pass ${cell.fromPass.split('-')[0]}`,
  ].filter(Boolean);
  const controls = asList(cell.controls);
  const risks = asList(cell.risks);

  return (
    <li id={`cell-${cell.i}`} className={`variant${cell.picked ? ' variant--picked' : ''}`}>
      <figure>
        <Sprite machine={m} cell={cell} alt={`${m.name}, ${cellLabel(m, cell)}: rest frame`} />
        <figcaption>
          <p className="variant__subject">
            <span className="variant__n">{cell.variant || cellLabel(m, cell)}</span>
            {cell.picked && <span className="variant__picked">picked</span>}
            {cell.subject ? ` ${cell.subject}` : ''}
          </p>
          {tags.length > 0 && <p className="variant__tags">{tags.join(' · ')}</p>}
          {controls.length > 0 && (
            <ul className="variant__controls">
              {controls.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          )}
          {risks.length > 0 && (
            <details className="variant__risks">
              <summary>Risks the pass recorded</summary>
              <ul>{risks.map((line, i) => <li key={i}>{line}</li>)}</ul>
            </details>
          )}
        </figcaption>
      </figure>
    </li>
  );
}

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
  const screensHref = (path = '') => `/projects/${project.slug}/screens/${path}`;

  const frames = m.cells.filter((c) => c.kind === 'frame');
  const rest = frames.find((c) => c.name === 'rest');
  const playing = frames.find((c) => c.name === 'playing');
  const sweeps = (m.controls || [])
    .map((ctl) => [ctl, frames.filter((c) => c.control === ctl.id).sort((a, b) => a.value - b.value)])
    .filter(([, cells]) => cells.length);
  const sweptIds = new Set(sweeps.flatMap(([, cells]) => cells.map((c) => c.i)));
  const otherFrames = frames.filter((c) => c !== rest && c !== playing && !sweptIds.has(c.i));

  const passes = Object.entries(m.passes || {}).sort((a, b) => a[1].number - b[1].number);
  const cleaned = m.cells.filter((c) => c.kind === 'cleaned');
  const kept = m.cells.filter((c) => c.kind === 'kept');
  const sheets = m.sheets || [];

  return (
    <OperatorShell project={project} current="screens" trail={m.name}>
      <article className="container section machine">
        <Link className="btn btn--link reader__back" to={screensHref()}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" /></svg>
          <span className="reader__back-label">All screens</span>
        </Link>

        <header className="machine__head">
          <span className="kicker">{cat.singular || m.category} &middot; {m.kind}</span>
          <h1>{m.name}</h1>
          {(m.description || m.concept) && <p className="lead">{m.description || m.concept}</p>}
        </header>

        {rest && (
          <figure className="machine__hero">
            <Sprite machine={m} cell={rest} lazy={false} />
            <figcaption>At rest, shown at the screen&rsquo;s own 480 by 220 where the page allows.</figcaption>
          </figure>
        )}

        <dl className="machine__facts">
          {m.soundsLike && <><dt>Sounds like</dt><dd>{m.soundsLike}</dd></>}
          {m.concept && m.concept !== m.description && <><dt>Concept</dt><dd>{m.concept}</dd></>}
          {m.controls.length > 0 && (
            <><dt>Controls</dt><dd>{m.controls.map((c) => c.label).join(', ')}</dd></>
          )}
        </dl>

        {(playing || sweeps.length > 0 || otherFrames.length > 0) && (
          <section className="machine__section" aria-labelledby="frames">
            <h2 id="frames">Finished frames</h2>
            <p>
              The frame set the protocol asks for: playing, then each control at 0, 50 and 100 with the
              others at their defaults. These are what the perceptibility check measures.
            </p>
            {playing && (
              <figure className="sweep sweep--one">
                <Sprite machine={m} cell={playing} />
                <figcaption>Playing: notes held, mid-animation.</figcaption>
              </figure>
            )}
            {sweeps.map(([ctl, cells]) => (
              <figure className="sweep" key={ctl.id}>
                <div className="sweep__row" style={{ '--n': cells.length }}>
                  {cells.map((c) => <Sprite key={c.i} machine={m} cell={c} />)}
                </div>
                <figcaption>{ctl.label} at {cells.map((c) => c.value).join(', ')}.</figcaption>
              </figure>
            ))}
            {otherFrames.length > 0 && (
              <figure className="sweep">
                <div className="sweep__row" style={{ '--n': Math.min(otherFrames.length, 3) }}>
                  {otherFrames.map((c) => <Sprite key={c.i} machine={m} cell={c} />)}
                </div>
                <figcaption>{otherFrames.map((c) => c.name.replace(/-/g, ' ')).join(', ')}.</figcaption>
              </figure>
            )}
          </section>
        )}

        {passes.map(([step, p]) => {
          const cells = m.cells
            .filter((c) => c.kind === 'pass' && c.pass === step)
            .sort((a, b) => a.variant.localeCompare(b.variant));
          if (!cells.length) return null;
          return (
            <section className="machine__section pass" key={step} aria-labelledby={`pass-${step}`}>
              <h2 id={`pass-${step}`}>
                Pass {p.number} &middot; {p.kind}
                {p.state && <span className={`pass__state pass__state--${p.state}`}>{p.state}</span>}
              </h2>
              {p.focus && <p className="pass__focus">Brief for this pass: {p.focus}</p>}
              {p.pick && (
                <p className="pass__decision">
                  Picked <strong>{p.pick.variant}</strong>{p.pick.reason ? `: ${p.pick.reason}` : '.'}
                </p>
              )}
              {p.rejected && (
                <p className="pass__decision">Rejected: {p.rejected}</p>
              )}
              <ol className="variants">
                {cells.map((c) => <Variant key={c.i} m={m} cell={c} />)}
              </ol>
            </section>
          );
        })}

        {cleaned.length > 0 && (
          <section className="machine__section" aria-labelledby="cleaned">
            <h2 id="cleaned">Cleaned picks</h2>
            <p>A pick, tidied: a label removed, a clip fixed, spacing settled. Not a generative pass, so not five.</p>
            <ol className="variants">{cleaned.map((c) => <Variant key={c.i} m={m} cell={c} />)}</ol>
          </section>
        )}

        {kept.length > 0 && (
          <section className="machine__section" aria-labelledby="kept">
            <h2 id="kept">Kept</h2>
            <p>Variants that were not picked but were worth holding on to, with the reason.</p>
            <ol className="variants">{kept.map((c) => <Variant key={c.i} m={m} cell={c} />)}</ol>
          </section>
        )}

        {sheets.length > 0 && (
          <section className="machine__section" aria-labelledby="sheets">
            <h2 id="sheets">Sheets</h2>
            {sheets.map((s) => (
              <figure className="machine__sheet" key={s.file + (s.row ?? '')}>
                {s.kind === 'before-after' ? <Strip sheet={s} /> : <Sheet sheet={s} />}
                <figcaption>{s.alt}</figcaption>
              </figure>
            ))}
          </section>
        )}

        {m.motion.length > 0 && (
          <section className="machine__section" aria-labelledby="motion">
            <h2 id="motion">Motion</h2>
            <p>Silent clips of the drawing answering the sound. Nothing moves at rest; every ease settles.</p>
            {m.motion.map((clip) => (
              <figure className="machine__motion" key={clip.name}>
                <Motion clip={clip} />
                <figcaption>{clip.alt}</figcaption>
              </figure>
            ))}
          </section>
        )}

        <nav className="machine__pager" aria-label="Other machines">
          {prev ? <Link to={screensHref(`${prev.id}/`)} rel="prev">&larr; {prev.name}</Link> : <span />}
          {next ? <Link to={screensHref(`${next.id}/`)} rel="next">{next.name} &rarr;</Link> : <span />}
        </nav>
      </article>
    </OperatorShell>
  );
}
