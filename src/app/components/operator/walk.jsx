/**
 * walk.jsx: one machine's design session, as a walk-through.
 *
 * The prose lives in src/content/walks/<project>.mdx and explains why each
 * step of the protocol exists. These components are what it places between
 * its paragraphs: one figure per step, built from the records the MCP server
 * wrote while the session ran (pass.json, brief.md, notes.md, motion.md, via
 * src/opxy/manifest.json). Nothing is invented to fill a gap. When a machine
 * never reached a step, <Reached> leaves the step and its prose out.
 *
 * The same MDX renders for every machine: the page sets the machine in
 * WalkContext and every component reads it from there, so the words are
 * written once and the evidence changes underneath them.
 *
 * Interaction is progressive. Each figure renders complete, readable markup
 * (the full record) and src/js/opxy-walk.js turns it into something you can
 * operate: a toggle, a slider, a matrix to click through. The contract
 * between the two is generic and small:
 *
 *   data-w="…"                   a figure the script enhances
 *   [data-controls] hidden       its buttons, shown only once the script runs
 *   button[data-set][data-value] sets data-<set>="<value>" on the figure
 *   [data-show-<set>="a b"]      shown only while <set> is a or b
 *   [data-live-only] hidden      shown once the script runs
 *   [data-static-only]           hidden once the script runs
 *
 * React never runs on these pages; the components only render HTML.
 */

import { createContext, useContext } from 'react';
import { Motion, Sheet, Sprite, Strip } from './Sprite';
import { asList, cellLabel } from '../../opxy.js';
import { markRuns, sharedWords } from '../../lib/opxy-words.js';

/* ------------------------------------------------------------ context */

export const WalkContext = createContext(null);
const useWalk = () => useContext(WalkContext) || {};

/** Area of the screen body that must change, by audible score (opxy/tokens.json → perceptibility.areaByScore). */
const AREA_BY_SCORE = { 1: 0.5, 2: 0.8, 3: 1.2, 4: 1.6, 5: 2.5 };
/** design_pass_submit's thresholds (opxy/catalog.json → iterations). */
const MAX_OVERLAP = 0.6;
const MIN_BODY_DIFF = 4;

/* ------------------------------------------------------------ helpers */

export function passList(m) {
  return Object.entries((m && m.passes) || {})
    .map(([step, p]) => ({ step, ...p }))
    .sort((a, b) => a.number - b.number);
}

function passFor(m, which = 'last') {
  const ps = passList(m);
  if (!ps.length) return null;
  if (which === 'first') return ps[0];
  if (which === 'last') return ps[ps.length - 1];
  return ps.find((p) => p.step === which) || null;
}

const passCells = (m, step) => m.cells
  .filter((c) => c.kind === 'pass' && c.pass === step)
  .sort((a, b) => a.variant.localeCompare(b.variant));

const frames = (m) => m.cells.filter((c) => c.kind === 'frame');
const restFrame = (m) => frames(m).find((c) => c.name === 'rest') || null;

/** The pick whose text describes what each control does: the last subject pass with a pick. */
function subjectPick(m) {
  const p = [...passList(m)].reverse().find((x) => x.kind === 'subject' && x.pick);
  return p ? m.cells.find((c) => c.kind === 'pass' && c.pass === p.step && c.variant === p.pick.variant) || null : null;
}

function sweeps(m) {
  return (m.controls || [])
    .map((ctl) => ({ ctl, cells: frames(m).filter((c) => c.control === ctl.id).sort((a, b) => a.value - b.value) }))
    .filter((s) => s.cells.length);
}

const scoreOf = (m, id) => (m.scores || []).find((s) => s.control.toLowerCase() === id.toLowerCase()) || null;

/** The line of a variant's control notes that is about one control ("glaze: position, the glaze line…"). */
function lineFor(cell, ctl) {
  const lines = asList(cell && cell.controls);
  const keys = [ctl.id, ctl.label].map((k) => String(k).toLowerCase());
  const hit = lines.find((l) => keys.some((k) => l.toLowerCase().startsWith(`${k}:`)));
  return hit ? hit.slice(hit.indexOf(':') + 1).trim() : null;
}

/** Where the machine stands, from what is in its folder. */
export function statusOf(m) {
  const ps = passList(m);
  const selected = ps.filter((p) => p.pick);
  const last = ps[ps.length - 1];
  const n = frames(m).length;
  return {
    passes: ps.length,
    picked: selected.length ? selected[selected.length - 1].pick.variant : null,
    open: last && !last.pick && !last.rejected ? last.state : null,
    frames: n,
    motion: Boolean((m.frames && m.frames.summary) || (m.motion || []).length),
  };
}

function holds(m, cond, which) {
  const ps = passList(m);
  const p = passFor(m, which);
  const ranking = (p && p.ranking) || [];
  switch (cond) {
    case 'second': return ps.length > 1;
    case 'middle': return ps.length > 2;
    case 'picked': return Boolean(p && p.pick);
    case 'rejected': return Boolean(p && p.rejected);
    case 'open': return Boolean(p && !p.pick && !p.rejected);
    case 'ranked': return ranking.length > 0;
    case 'agreed': return Boolean(p && p.pick && ranking.length && ranking[0].variant === p.pick.variant);
    case 'disagreed': return Boolean(p && p.pick && ranking.length && ranking[0].variant !== p.pick.variant);
    case 'subjectPass': return Boolean(p && p.kind === 'subject');
    case 'framesPass': return Boolean(p && p.kind !== 'subject');
    case 'scores': return (m.scores || []).length > 0;
    case 'frames': return frames(m).length > 1;
    case 'restOnly': return frames(m).length === 1;
    case 'noFrames': return frames(m).length === 0;
    case 'contact': return m.sheets.some((s) => s.kind === 'contact');
    case 'beforeAfter': return m.sheets.some((s) => s.kind === 'before-after');
    case 'motion': return Boolean((m.frames && m.frames.summary) || (m.motion || []).length);
    case 'cleaned': return m.cells.some((c) => c.kind === 'cleaned');
    case 'kept': return m.cells.some((c) => c.kind === 'kept');
    case 'extras': return m.cells.some((c) => c.kind === 'cleaned' || c.kind === 'kept');
    default: return false;
  }
}

/* ------------------------------------------------------------ prose helpers */

/**
 * Render children only when the machine reached a step.
 * `when` is a space-separated list, all of which must hold; prefix `!` to
 * negate. `pass` is "first", "last" (the default) or a pass folder name.
 */
export function Reached({ when = '', pass = 'last', children }) {
  const { m } = useWalk();
  if (!m) return null;
  const ok = when.split(/\s+/).filter(Boolean).every((c) => (c[0] === '!' ? !holds(m, c.slice(1), pass) : holds(m, c, pass)));
  return ok ? <>{children}</> : null;
}

/** One fact about the machine, inline in a sentence. */
export function Field({ name, pass = 'last' }) {
  const { m, manifest } = useWalk();
  if (!m) return null;
  const p = passFor(m, pass);
  const cat = (manifest && manifest.categories[m.category]) || {};
  const loudest = [...(m.scores || [])].sort((a, b) => b.score - a.score)[0];
  const value = {
    name: m.name,
    kind: m.kind,
    category: cat.singular || m.category,
    description: m.description,
    concept: m.concept,
    soundsLike: m.soundsLike,
    subject: m.intake && m.intake.subject,
    controls: (m.controls || []).map((c) => c.label.toLowerCase()).join(', '),
    controlCount: String((m.controls || []).length),
    loudest: loudest && loudest.control,
    loudestScore: loudest && String(loudest.score),
    passCount: String(passList(m).length),
    frameCount: String(frames(m).length),
    focus: p && p.focus,
    pick: p && p.pick && p.pick.variant,
    pickReason: p && p.pick && p.pick.reason,
    rejectReason: p && p.rejected && p.rejected.reason,
    rankTop: p && p.ranking && p.ranking[0] && p.ranking[0].variant,
    rankTopNote: p && p.ranking && p.ranking[0] && p.ranking[0].note,
  }[name];
  return value ? <span className="wfield">{String(value).replace(/\.$/, '')}</span> : null;
}

/** The machine's name, inline. */
export const Name = () => <Field name="name" />;

/* ------------------------------------------------------------ panel parts */

function Call({ tool, args = {} }) {
  const entries = Object.entries(args).filter(([, v]) => v != null && v !== '');
  return (
    <code className="wcall">
      <span className="wcall__tool">{tool}</span>
      <span className="wcall__args">
        {'('}
        {entries.map(([k, v], i) => (
          <span key={k}>
            {i > 0 && ', '}
            {k}: <span className="wcall__val">{typeof v === 'string' ? `"${v}"` : String(v)}</span>
          </span>
        ))}
        {')'}
      </span>
    </code>
  );
}

function Panel({ w, call, controls, caption, label, init = {}, className = '', children }) {
  const data = Object.fromEntries(Object.entries(init).map(([k, v]) => [`data-${k}`, v]));
  return (
    <figure className={`wpanel${className ? ` ${className}` : ''}`} data-w={w} {...data} {...(label ? { 'aria-label': label } : {})}>
      {call && <div className="wpanel__call">{call}</div>}
      {controls && <div className="wpanel__controls" data-controls="" hidden>{controls}</div>}
      <div className="wpanel__body">{children}</div>
      {caption && <figcaption className="wpanel__cap">{caption}</figcaption>}
      <p className="visually-hidden" aria-live="polite" data-say="" />
    </figure>
  );
}

/** A row of mutually exclusive buttons that set one value on the panel. */
function Seg({ set, label, options, value }) {
  return (
    <div className="wseg" role="group" aria-label={label}>
      {options.map(([v, text, say]) => (
        <button
          key={v}
          type="button"
          className="wseg__btn"
          data-set={set}
          data-value={v}
          aria-pressed={v === value ? 'true' : 'false'}
          {...(say ? { 'data-say': say } : {})}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** An empty device screen: where a drawing will be, before anything is drawn. */
const Slot = ({ text = 'not drawn yet' }) => (
  <span className="wslot" aria-hidden="true"><span>{text}</span></span>
);

/* ------------------------------------------------------------ the steps */

/** Phase 0: the stock page against the machine's own screen. */
export function StockOrScreen() {
  const { m } = useWalk();
  if (!m) return null;
  const rest = restFrame(m);
  const cell = rest || m.cells.find((c) => c.picked) || m.cells[0];
  if (!cell) return null;
  return (
    <Panel
      w="stock"
      init={{ view: 'screen' }}
      call={<Call tool="screen_init" args={{ machine_id: m.id, category: m.category.replace(/s$/, ''), kind: m.kind }} />}
      controls={<Seg set="view" label="Show" value="stock" options={[
        ['stock', 'A stock page', 'Showing a stock page: the header and nothing else.'],
        ['screen', `${m.name}’s screen`, `Showing ${m.name}’s own screen.`],
      ]} />}
      caption={(
        <>
          <span data-show-view="stock" hidden>A stock page keeps the header&rsquo;s four names and values and draws nothing the sound acts on.</span>
          <span data-show-view="screen">{m.name}&rsquo;s screen{rest ? ', at rest' : ', as picked'}: the same header, and a drawing every knob moves.</span>
        </>
      )}
    >
      <span className="wstock" {...(rest ? { id: `cell-${rest.i}` } : {})}>
        <Sprite machine={m} cell={cell} lazy={false} />
        <span className="wstock__cover" aria-hidden="true" />
      </span>
    </Panel>
  );
}

/** Phase 1: what the brief says, and what lint_definition said. */
export function Intake() {
  const { m } = useWalk();
  if (!m) return null;
  const rows = [
    ['Concept', m.concept],
    ['Sounds like', m.soundsLike],
    ['Controls', (m.controls || []).map((c) => c.label.toLowerCase()).join(', ')],
    ['Control source', m.intake && m.intake.controlSource],
  ].filter(([, v]) => v);
  return (
    <Panel
      w="intake"
      call={<Call tool="lint_definition" args={{ path: `screens/${m.id}/definition.json` }} />}
      caption={m.intake && m.intake.lintDefinition ? <>The checker&rsquo;s answer: {m.intake.lintDefinition}</> : null}
    >
      <p className="wdoc__file">screens/{m.id}/brief.md &middot; 1 &middot; Intake</p>
      <dl className="wdoc">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </Panel>
  );
}

/** Phase 2: each control's score, as a bar you can select. */
export function Scores() {
  const { m } = useWalk();
  if (!m || !(m.scores || []).length) return null;
  const items = m.scores.map((s) => {
    const ctl = (m.controls || []).find((c) => c.id.toLowerCase() === s.control.toLowerCase()) || { id: s.control, label: s.control };
    const cells = frames(m).filter((c) => c.control === ctl.id).sort((a, b) => a.value - b.value);
    return { s, ctl, ends: cells.length ? [cells[0], cells[cells.length - 1]] : [] };
  });
  const first = [...items].sort((a, b) => b.s.score - a.s.score)[0];
  return (
    <Panel
      w="scores"
      init={{ ctl: first.ctl.id }}
      call={<code className="wcall"><span className="wcall__tool">brief.md</span><span className="wcall__args"> &middot; 2 &middot; Listen and rank</span></code>}
      controls={(
        <div className="wbars" role="group" aria-label="Controls by score">
          {items.map(({ s, ctl }) => (
            <button
              key={ctl.id}
              type="button"
              className="wbar"
              data-set="ctl"
              data-value={ctl.id}
              aria-pressed={ctl.id === first.ctl.id ? 'true' : 'false'}
              data-say={`${ctl.label}, scored ${s.score} of 5.`}
            >
              <span className="wbar__name">{ctl.label.toLowerCase()}</span>
              <span className="wbar__track"><span className="wbar__fill" style={{ '--s': s.score }} /></span>
              <span className="wbar__n">{s.score}</span>
            </button>
          ))}
        </div>
      )}
    >
      {items.map(({ s, ctl, ends }) => (
        <div className="wscore" data-show-ctl={ctl.id} key={ctl.id}>
          <p className="wscore__head">
            <span className="wscore__name">{ctl.label.toLowerCase()}</span>
            <span className="wscore__pips" aria-label={`score ${s.score} of 5`}>
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= s.score ? 'on' : ''} />)}
            </span>
          </p>
          <p className="wscore__effect">{s.effect}</p>
          <p className="wscore__floor">
            Score {s.score}, so between 0 and 100 at least <b>{AREA_BY_SCORE[s.score] || '?'}%</b> of the screen&rsquo;s body has to visibly change.
          </p>
          {ends.length === 2 && (
            <div className="wscore__ends">
              {ends.map((c) => (
                <span key={c.i} className="wscore__end">
                  <Sprite machine={m} cell={c} />
                  <span className="wscore__lab">{ctl.label.toLowerCase()} {c.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}

function directionLines(d) {
  if (!d) return [];
  if (d.composition || d.camera || d.emphasis) return [d.composition, d.camera, d.emphasis].filter(Boolean);
  const angle = d.angle || (d.pattern ? `${d.pattern}${d.patternName ? ` ${d.patternName}` : ''}` : null);
  return [angle, d.drawingLanguage, d.stretch ? 'outside the category’s usual patterns: say why, or say it doesn’t fit' : null].filter(Boolean);
}

/** A design pass's five directions, flipping from brief to drawing. Owns the pass cells' anchors. */
export function Directions({ pass = 'last' }) {
  const { m } = useWalk();
  if (!m) return null;
  const p = passFor(m, pass);
  if (!p) return null;
  const cells = passCells(m, p.step);
  if (!cells.length) return null;
  const dirs = p.directions || [];
  return (
    <Panel
      w="directions"
      className="wpanel--directions"
      init={{ face: 'drawn' }}
      call={<Call tool="design_pass_start" args={{ machine_id: m.id, kind: p.kind, focus: p.focus }} />}
      controls={<Seg set="face" label="Show" value="brief" options={[
        ['brief', 'The briefs', 'Showing the five briefs, before anything was drawn.'],
        ['drawn', 'What came back', 'Showing the five drawings that came back.'],
      ]} />}
      caption={<>Pass {p.number}, {p.kind}. Five briefs written before any drawing existed; five designers, one per brief, none of them seeing the others.</>}
    >
      <ol className="wdirs">
        {cells.map((c) => {
          const lines = directionLines(dirs.find((d) => d.variant === c.variant));
          const risks = asList(c.risks);
          return (
            <li className="wdir" key={c.i} id={`cell-${c.i}`}>
              <span className="wdir__frame">
                <span data-show-face="brief" hidden><Slot /></span>
                <span data-show-face="drawn"><Sprite machine={m} cell={c} /></span>
              </span>
              <span className="wdir__text">
                <span className="wdir__v">{c.variant}</span>
                {lines.length > 0 && <span className="wdir__brief">{lines.join(' · ')}</span>}
                {c.subject && <span className="wdir__subject" data-show-face="drawn">{c.subject}</span>}
                {(asList(c.controls).length > 0 || risks.length > 0) && (
                  <details className="wdir__more" data-show-face="drawn">
                    <summary>What each knob would do{risks.length ? ', and the risks' : ''}</summary>
                    {asList(c.controls).length > 0 && <ul>{asList(c.controls).map((l, i) => <li key={i}>{l}</li>)}</ul>}
                    {risks.length > 0 && <ul className="wdir__risks">{risks.map((l, i) => <li key={i}>{l}</li>)}</ul>}
                  </details>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function Marked({ text, shared }) {
  return markRuns(text, shared).map((r, i) => (r.hit ? <mark key={i}>{r.text}</mark> : <span key={i}>{r.text}</span>));
}

/** design_pass_submit's pairwise check, as a matrix you click through. */
export function Uniqueness({ pass = 'last' }) {
  const { m } = useWalk();
  if (!m) return null;
  const p = passFor(m, pass);
  if (!p || !p.uniqueness) return null;
  const cells = passCells(m, p.step);
  const by = Object.fromEntries(cells.map((c) => [c.variant, c]));
  const pairs = (p.uniqueness.pairs || []).filter((x) => x.pair).map((x) => {
    const [a, b] = x.pair.split('–');
    return { ...x, a, b, key: `${a}-${b}` };
  }).filter((x) => by[x.a] && by[x.b]);
  if (!pairs.length) return null;
  const subject = pairs.some((x) => x.subjectOverlap != null);
  const vs = cells.map((c) => c.variant);
  const at = (a, b) => pairs.find((x) => x.a === a && x.b === b);
  const value = (x) => (subject ? x.subjectOverlap.toFixed(2) : `${x.bodyDiffPct.toFixed(1)}%`);
  // How close a pair came to failing, 0 (far) to 1 (at the line), for shading.
  const closeness = (x) => (subject ? Math.min(1, x.subjectOverlap / MAX_OVERLAP) : Math.min(1, MIN_BODY_DIFF / Math.max(x.bodyDiffPct, 0.01)));
  const tightest = [...pairs].sort((x, y) => closeness(y) - closeness(x))[0];
  const problems = p.uniqueness.problems || [];

  return (
    <Panel
      w="pairs"
      init={{ pair: tightest.key }}
      call={<Call tool="design_pass_submit" args={{ machine_id: m.id, pass_name: p.step }} />}
      caption={(
        <>
          state: <b>{problems.length ? 'needs_revision' : 'ready_for_pick'}</b>.{' '}
          {subject
            ? `Every pair has to differ in at least two of angle, way of drawing and wording, and wording counts as the same once the shared words pass ${MAX_OVERLAP} of all of them.`
            : `Every pair of rest frames has to differ on at least ${MIN_BODY_DIFF}% of the screen's body.`}
          {' '}The darker the square, the further apart the pair; it opens on the closest call.
        </>
      )}
    >
      <div className="wpairs">
        <table className="wmatrix">
          <caption className="visually-hidden">{subject ? 'Word overlap between each pair of subjects' : 'Share of the body that differs between each pair'}</caption>
          <thead><tr><td />{vs.slice(1).map((v) => <th key={v} scope="col">{v}</th>)}</tr></thead>
          <tbody>
            {vs.slice(0, -1).map((a, i) => (
              <tr key={a}>
                <th scope="row">{a}</th>
                {vs.slice(1).map((b, j) => {
                  if (j < i) return <td key={b} className="wmatrix__off" />;
                  const x = at(a, b);
                  if (!x) return <td key={b} className="wmatrix__off" />;
                  return (
                    <td key={b}>
                      <button
                        type="button"
                        className={`wmatrix__cell${x.ok ? '' : ' is-bad'}`}
                        style={{ '--t': closeness(x).toFixed(2) }}
                        data-set="pair"
                        data-value={x.key}
                        aria-pressed={x.key === tightest.key ? 'true' : 'false'}
                        aria-label={`${a} and ${b}: ${value(x)}${x.ok ? ', different enough' : ', too alike'}`}
                        data-say={`${a} and ${b}: ${value(x)}.`}
                      >
                        {value(x)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {pairs.map((x) => {
          const ca = by[x.a];
          const cb = by[x.b];
          const shared = subject ? sharedWords(ca.subject, cb.subject) : new Set();
          const differs = subject ? 3 - ((x.sameAngle ?? x.samePattern) ? 1 : 0) - (x.sameLanguage ? 1 : 0) - (x.subjectOverlap >= MAX_OVERLAP ? 1 : 0) : null;
          return (
            <div className="wpair" key={x.key} data-show-pair={x.key} {...(x.key === tightest.key ? {} : { hidden: true })}>
              <div className="wpair__frames">
                {[ca, cb].map((c) => (
                  <span key={c.i} className="wpair__one">
                    <Sprite machine={m} cell={c} />
                    <span className="wpair__v">{c.variant}</span>
                    {subject && c.subject && <span className="wpair__subject"><Marked text={c.subject} shared={shared} /></span>}
                  </span>
                ))}
              </div>
              <dl className="wpair__facts">
                {subject ? (
                  <>
                    <div><dt>same angle</dt><dd>{(x.sameAngle ?? x.samePattern) ? 'yes' : 'no'}</dd></div>
                    <div><dt>same way of drawing</dt><dd>{x.sameLanguage ? 'yes' : 'no'}</dd></div>
                    <div>
                      <dt>shared words</dt>
                      <dd>
                        {x.subjectOverlap.toFixed(2)} of a {MAX_OVERLAP} limit
                        <span className="wmeter" style={{ '--v': Math.min(1, x.subjectOverlap), '--line': MAX_OVERLAP }} aria-hidden="true"><span /></span>
                        <span className="wpair__words">{shared.size ? [...shared].join(', ') : 'none'}</span>
                      </dd>
                    </div>
                    <div><dt>verdict</dt><dd><b>{x.ok ? 'different enough' : 'too alike'}</b>: differs in {differs} of 3, needs 2</dd></div>
                  </>
                ) : (
                  <>
                    <div>
                      <dt>body that differs</dt>
                      <dd>
                        {x.bodyDiffPct.toFixed(1)}%, needs at least {MIN_BODY_DIFF}%
                        <span className="wmeter" style={{ '--v': Math.min(1, x.bodyDiffPct / 25), '--line': MIN_BODY_DIFF / 25 }} aria-hidden="true"><span /></span>
                      </dd>
                    </div>
                    <div><dt>verdict</dt><dd><b>{x.ok ? 'different enough' : 'too alike'}</b></dd></div>
                  </>
                )}
              </dl>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** The ranking a reviewer wrote, against the decision the person made. */
export function Decision({ pass = 'last' }) {
  const { m } = useWalk();
  if (!m) return null;
  const p = passFor(m, pass);
  if (!p) return null;
  const cells = passCells(m, p.step);
  if (!cells.length) return null;
  const rank = Object.fromEntries((p.ranking || []).map((r, i) => [r.variant, i + 1]));
  const ranked = (p.ranking || []).length > 0;
  const options = [
    ['submitted', 'As submitted', 'The five in the order they were submitted.'],
    ...(ranked ? [['ranking', 'The reviewer’s ranking', 'Reordered by the reviewer’s ranking.']] : []),
    ['decision', 'The decision', p.pick ? `${p.pick.variant} picked.` : p.rejected ? 'All five rejected.' : 'No decision yet.'],
  ];

  return (
    <Panel
      w="decision"
      className={`wpanel--decision${p.rejected ? ' is-rejected' : ''}`}
      init={{ mode: 'decision' }}
      call={p.pick
        ? <Call tool="design_pass_select" args={{ machine_id: m.id, variant: p.pick.variant, reason: p.pick.reason, chosen_by: p.pick.chosenBy }} />
        : p.rejected
          ? <Call tool="design_pass_reject" args={{ machine_id: m.id, reason: p.rejected.reason, chosen_by: p.rejected.chosenBy }} />
          : <Call tool="design_pass_get" args={{ machine_id: m.id, pass_name: p.step }} />}
      controls={<Seg set="mode" label="Order" value="submitted" options={options} />}
    >
      <ol className="wcards">
        {cells.map((c, i) => (
          <li
            key={c.i}
            className={`wcard${c.picked ? ' is-picked' : ''}`}
            data-order-submitted={i}
            data-order-ranking={rank[c.variant] || 9}
          >
            <Sprite machine={m} cell={c} />
            <span className="wcard__v">
              {c.variant}
              {rank[c.variant] && <span className="wcard__rank" data-show-mode="ranking" hidden>#{rank[c.variant]}</span>}
              {c.picked && <span className="wcard__badge" data-show-mode="decision">picked</span>}
            </span>
          </li>
        ))}
      </ol>

      {ranked && (
        <div className="wnote" data-show-mode="ranking">
          <p className="wnote__head">The reviewer&rsquo;s ranking, from notes.md. The notes say outright that the pick is the owner&rsquo;s.</p>
          <ol className="wnote__list">
            {p.ranking.map((r) => <li key={r.variant}><b>{r.variant}</b> {r.note}</li>)}
          </ol>
        </div>
      )}

      <div className="wnote" data-show-mode="decision">
        {p.pick && (
          <p className="wnote__decision">
            <b>{p.pick.variant}</b>, picked by {p.pick.chosenBy || 'the owner'}: &ldquo;{p.pick.reason}&rdquo;
          </p>
        )}
        {p.rejected && (
          <p className="wnote__decision">
            <b>None of the five</b>, said {p.rejected.chosenBy || 'the owner'}: &ldquo;{p.rejected.reason}&rdquo;
          </p>
        )}
        {!p.pick && !p.rejected && <p className="wnote__decision">Still open: waiting for a person to pick.</p>}
      </div>
    </Panel>
  );
}

/** Passes between the first and the last, compactly. Owns their cells' anchors. */
export function OtherPasses() {
  const { m } = useWalk();
  if (!m) return null;
  const ps = passList(m).slice(1, -1);
  if (!ps.length) return null;
  return (
    <Panel w="others" call={<Call tool="design_pass_get" args={{ machine_id: m.id }} />}>
      {ps.map((p) => (
        <div className="wother" key={p.step}>
          <p className="wother__head">
            Pass {p.number}, {p.kind}{p.focus ? <>: <i>{p.focus}</i></> : null}
          </p>
          <ol className="wcards wcards--small">
            {passCells(m, p.step).map((c) => (
              <li key={c.i} id={`cell-${c.i}`} className={`wcard${c.picked ? ' is-picked' : ''}`}>
                <Sprite machine={m} cell={c} />
                <span className="wcard__v">{c.variant}{c.picked && <span className="wcard__badge">picked</span>}</span>
              </li>
            ))}
          </ol>
          <p className="wother__end">
            {p.pick ? <>Picked {p.pick.variant}: &ldquo;{p.pick.reason}&rdquo;</> : p.rejected ? <>Rejected: &ldquo;{p.rejected.reason}&rdquo;</> : 'Still open.'}
          </p>
        </div>
      ))}
    </Panel>
  );
}

/** Phase 5: every control at 0, 50 and 100, on a slider. Owns the frame anchors (all but rest). */
export function Sweep() {
  const { m } = useWalk();
  if (!m) return null;
  const sw = sweeps(m);
  const playing = frames(m).find((c) => c.name === 'playing');
  if (!sw.length && !playing) return null;
  const rest = restFrame(m);
  const pick = subjectPick(m);
  const shown = new Set([...sw.flatMap((s) => s.cells.map((c) => c.i)), playing && playing.i, rest && rest.i].filter((x) => x != null));
  const others = frames(m).filter((c) => !shown.has(c.i));
  const { cols } = m.atlas;
  const pos = (c) => ({ col: c.i % cols, row: Math.floor(c.i / cols), alt: c.alt, value: c.value });
  const data = Object.fromEntries(sw.map((s) => [s.ctl.id, s.cells.map(pos)]));
  if (playing) data.__playing = [pos(playing)];
  const first = sw[0] || null;
  const start = first ? first.cells[Math.floor(first.cells.length / 2)] : playing;

  return (
    <Panel
      w="sweep"
      init={{ ctl: first ? first.ctl.id : '__playing' }}
      call={<Call tool="check_perceptibility" args={{ frames: `screens/${m.id}/frames`, scores: (m.scores || []).map((s) => s.score).join(',') || null }} />}
      controls={(
        <div className="wseg" role="group" aria-label="Control">
          {sw.map((s) => (
            <button key={s.ctl.id} type="button" className="wseg__btn" data-set="ctl" data-value={s.ctl.id} aria-pressed={s === first ? 'true' : 'false'}>
              {s.ctl.label.toLowerCase()}
            </button>
          ))}
          {playing && (
            <button type="button" className="wseg__btn" data-set="ctl" data-value="__playing" aria-pressed={first ? 'false' : 'true'}>a note playing</button>
          )}
        </div>
      )}
      caption={<>Each frame has every other control at its default. The protocol measures the change between them; your eye does the same thing as you drag.</>}
    >
      {/* The record, as rows. Shown without the script, and when a link
          points at one of these frames. */}
      <div className="wsweep__rows" data-static-only="">
        {playing && (
          <div className="wsweep__row">
            <span className="wsweep__lab">playing</span>
            <span className="wsweep__cells wsweep__cells--one" id={`cell-${playing.i}`}><Sprite machine={m} cell={playing} /></span>
          </div>
        )}
        {sw.map((s) => (
          <div className="wsweep__row" key={s.ctl.id}>
            <span className="wsweep__lab">{s.ctl.label.toLowerCase()} {s.cells.map((c) => c.value).join(' / ')}</span>
            <span className="wsweep__cells" style={{ '--n': s.cells.length }}>
              {s.cells.map((c) => <span key={c.i} id={`cell-${c.i}`}><Sprite machine={m} cell={c} /></span>)}
            </span>
          </div>
        ))}
      </div>

      {/* The instrument: one screen, a control, a slider. */}
      <div className="wsweep" data-live-only="" hidden>
        <div className="wsweep__screen" data-frames={JSON.stringify(data)}>
          {start && <Sprite machine={m} cell={start} />}
        </div>
        <div className="wsweep__dial">
          <label className="wsweep__range">
            <span className="visually-hidden">Value</span>
            <input type="range" min="0" max="2" step="1" defaultValue="1" data-range="" />
          </label>
          <span className="wsweep__ticks" aria-hidden="true"><span>0</span><span>50</span><span>100</span></span>
          <output className="wsweep__out" data-out="" />
        </div>
      </div>

      {sw.map((s) => {
        const sc = scoreOf(m, s.ctl.id);
        const plan = lineFor(pick, s.ctl);
        return (
          <div className="wsweep__note" data-show-ctl={s.ctl.id} key={s.ctl.id}>
            <p>
              <b>{s.ctl.label.toLowerCase()}</b>
              {sc && <> &middot; score {sc.score}, so at least {AREA_BY_SCORE[sc.score]}% of the body must change</>}
            </p>
            {plan && <p className="wsweep__plan">At the pick, the plan was: {plan}</p>}
          </div>
        );
      })}
      {playing && (
        <div className="wsweep__note" data-show-ctl="__playing">
          <p><b>a note playing</b> &middot; the subject answers first; nothing else should move more than it does.</p>
        </div>
      )}

      {others.length > 0 && (
        <div className="wsweep__row wsweep__row--others">
          <span className="wsweep__lab">also in the set: {others.map((c) => c.name.replace(/-/g, ' ')).join(', ')}</span>
          <span className="wsweep__cells" style={{ '--n': Math.min(others.length, 3) }}>
            {others.map((c) => <span key={c.i} id={`cell-${c.i}`}><Sprite machine={m} cell={c} /></span>)}
          </span>
        </div>
      )}
    </Panel>
  );
}

/** The contact sheet, fitted or at 1:1. */
export function Contact() {
  const { m } = useWalk();
  if (!m) return null;
  const s = m.sheets.find((x) => x.kind === 'contact');
  if (!s) return null;
  return (
    <Panel
      w="contact"
      init={{ zoom: 'fit' }}
      call={<Call tool="contact_sheet" args={{ frames: `screens/${m.id}/frames`, png: true }} />}
      controls={<Seg set="zoom" label="Size" value="fit" options={[
        ['fit', 'Fit the page', 'Fitted to the page.'],
        ['one', '1:1, as the device draws it', 'At 1:1. Scroll sideways to see it all.'],
      ]} />}
      caption={<>At 1:1 a 480 pixel screen is 480 pixels here. That is how it is judged, because that is the only size it will ever be.</>}
    >
      <div className="wzoom" tabIndex={0} role="region" aria-label={`${m.name} contact sheet`}>
        <Sheet sheet={s} />
      </div>
    </Panel>
  );
}

/** The craft review's side by side, when the machine has one. */
export function BeforeAfter() {
  const { m } = useWalk();
  if (!m) return null;
  const s = m.sheets.find((x) => x.kind === 'before-after');
  if (!s) return null;
  return (
    <Panel w="before-after" caption={<>Left, the pass that was picked. Right, the frame after the craft review. Same subject, same controls.</>}>
      <Strip sheet={s} />
    </Panel>
  );
}

/** Cleaned and kept variants, with what was done to them. Owns their anchors. */
export function Extras() {
  const { m } = useWalk();
  if (!m) return null;
  const xs = m.cells.filter((c) => c.kind === 'cleaned' || c.kind === 'kept');
  if (!xs.length) return null;
  return (
    <Panel w="extras">
      <ol className="wdirs">
        {xs.map((c) => (
          <li className="wdir" key={c.i} id={`cell-${c.i}`}>
            <span className="wdir__frame"><Sprite machine={m} cell={c} /></span>
            <span className="wdir__text">
              <span className="wdir__v">{cellLabel(m, c)}</span>
              {c.subject && <span className="wdir__subject">{c.subject}</span>}
              {c.cleanNote && <span className="wdir__brief">{c.cleanNote}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** Phase 6: the motion spec's opening, the clips, and the key moments. */
export function MotionStep() {
  const { m } = useWalk();
  if (!m) return null;
  const sheet = m.sheets.find((s) => s.kind === 'motion-sheet');
  if (!(m.frames && m.frames.summary) && !(m.motion || []).length) return null;
  return (
    <Panel w="motion" call={<code className="wcall"><span className="wcall__tool">frames/motion.md</span></code>}>
      {m.frames && m.frames.summary && <p className="wmotion__summary">{m.frames.summary}</p>}
      {(m.motion || []).map((clip) => (
        <figure className="wmotion__clip" key={clip.name}>
          <Motion clip={clip} />
          <figcaption>{clip.alt}. Silent; the drawing answers the sound.</figcaption>
        </figure>
      ))}
      {sheet && (
        <details className="wmotion__sheet">
          <summary>The key moments of one note, frame by frame</summary>
          <Sheet sheet={sheet} />
        </details>
      )}
    </Panel>
  );
}

/** Where the machine stands now. */
export function Status() {
  const { m } = useWalk();
  if (!m) return null;
  const s = statusOf(m);
  const rows = [
    ['brief.md', true, 'intake, scores'],
    ['a subject', Boolean(s.picked), s.picked ? `${s.passes} ${s.passes === 1 ? 'pass' : 'passes'}, pick ${s.picked}` : s.open ? `${s.passes} ${s.passes === 1 ? 'pass' : 'passes'}, last one ${s.open.replace(/_/g, ' ')}` : `${s.passes} ${s.passes === 1 ? 'pass' : 'passes'}, none picked`],
    ['frames', s.frames > 1, s.frames > 1 ? `${s.frames} frames` : s.frames === 1 ? 'the rest frame only' : 'not yet'],
    ['motion.md', s.motion, s.motion ? 'written, with clips' : 'not yet'],
    ['review.md, handoff.md', false, 'not yet'],
    ['device photographs', false, 'pending until it runs on an OP-XY'],
  ];
  return (
    <Panel w="status" call={<Call tool="screen_status" args={{ machine_id: m.id }} />}>
      <ul className="wstatus">
        {rows.map(([k, done, v]) => (
          <li key={k} className={done ? 'is-done' : ''}>
            <span className="wstatus__mark" aria-hidden="true">{done ? '●' : '○'}</span>
            <span className="wstatus__k">{k}</span>
            <span className="wstatus__v">{done ? '' : 'pending: '}{v}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export const walkComponents = {
  Reached, Field, Name,
  StockOrScreen, Intake, Scores, Directions, Uniqueness, Decision, OtherPasses,
  Sweep, Contact, BeforeAfter, Extras, MotionStep, Status,
};
