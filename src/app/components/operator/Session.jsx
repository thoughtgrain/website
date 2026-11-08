/**
 * Session.jsx: one machine's design session, replayed as a transcript.
 *
 * Everything shown here is read back from the records the MCP server wrote
 * while the session ran: pass.json (the directions it handed out, what the
 * uniqueness check measured, who picked what and why, with timestamps),
 * brief.md (the subject sentence, the scores), notes.md (the reviewer's
 * ranking) and motion.md. Nothing is invented to fill a gap: where a machine
 * never reached a phase, the transcript stops and the status says so.
 *
 * The markup is a complete, static transcript. src/js/opxy-session.js turns
 * it into a player: it hides the steps and reveals them in order at the pace
 * each step's `data-dur` suggests. Without JavaScript the whole record is on
 * the page, which is also what a search hit from the grid lands on.
 *
 * Tool names, argument names and the `next` strings are the server's own
 * (mcp/opxy_mcp/passes.py, screens.py), so the replay reads the way a real
 * client log would.
 */

import { Motion, Sheet, Sprite, Strip } from './Sprite';
import { asList, cellLabel, controlLabel } from '../../opxy.js';

/* ------------------------------------------------------------ primitives */

function Step({ who, kind, dur = 900, id, picked, children }) {
  // Who is speaking styles the row (the person's decisions stand out), so the
  // first word of the label becomes a class: agent, server, you, reviewer,
  // designer.
  const by = who ? ` step--by-${who.split(' ')[0]}` : '';
  return (
    <li
      className={`step step--${kind}${by}${picked ? ' step--picked' : ''}`}
      data-step=""
      data-dur={dur}
      {...(id ? { id } : {})}
    >
      {who && <span className="step__who">{who}</span>}
      <div className="step__body">{children}</div>
    </li>
  );
}

function Phase({ label, when, dur = 500 }) {
  return (
    <li className="step step--phase" data-step="" data-dur={dur}>
      <span className="step__phase">{label}</span>
      {when && <time className="step__when" dateTime={when}>{stamp(when)}</time>}
    </li>
  );
}

/** `2026-11-06T08:11:59` as `6 Nov 2026, 08:11`. */
function stamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = iso.slice(11, 16);
  return `${date}, ${time}`;
}

/** `{ machine_id: "kiln", kind: "subject" }` as the server would see it. */
function Args({ args }) {
  const entries = Object.entries(args).filter(([, v]) => v != null && v !== '');
  return (
    <span className="call__args">
      {'('}
      {entries.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && ', '}
          <span className="call__key">{k}</span>
          {': '}
          <span className="call__val">{typeof v === 'string' ? `"${v}"` : String(v)}</span>
        </span>
      ))}
      {')'}
    </span>
  );
}

function Call({ who = 'agent', tool, args = {}, dur = 900, children }) {
  return (
    <Step who={who} kind="call" dur={dur}>
      <code className="call">
        <span className="call__tool">{tool}</span>
        <Args args={args} />
      </code>
      {children && <div className="call__result">{children}</div>}
    </Step>
  );
}

function Doc({ file, section, dur = 1100, children }) {
  return (
    <Step who="agent" kind="doc" dur={dur}>
      <div className="doc">
        <div className="doc__file">{file}{section ? <span className="doc__section"> · {section}</span> : null}</div>
        {children}
      </div>
    </Step>
  );
}

function Table({ head, rows }) {
  return (
    <table className="ctable">
      <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={j} className={c && c.ok !== undefined ? (c.ok ? 'ok' : 'bad') : undefined}>{c && c.ok !== undefined ? c.text : c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

/* -------------------------------------------------------------- content */

const PASS_LABEL = { subject: 'Subject', frames: 'Frames', revision: 'Revision' };
const PHASE_OF = { subject: 'Phase 3', frames: 'Phase 5', revision: 'Revision' };

function directionText(d) {
  if (d.angle) return d.angle;
  if (d.pattern) return `${d.pattern}${d.patternName ? ` ${d.patternName}` : ''}`;
  return [d.composition, d.camera, d.emphasis].filter(Boolean).join('; ');
}

function VariantCard({ m, cell, direction }) {
  const tags = [
    cell.pattern && cell.pattern !== 'none' && (cell.patternName ? `${cell.pattern} ${cell.patternName}` : cell.pattern),
    cell.drawingLanguage,
    cell.angle,
    !cell.subject && direction ? directionText(direction) : null,
  ].filter(Boolean);
  const controls = asList(cell.controls);
  const risks = asList(cell.risks);

  return (
    <Step who={`designer ${cell.variant}`} kind="variant" dur={700} id={`cell-${cell.i}`} picked={cell.picked}>
      <div className="vcard">
        <Sprite machine={m} cell={cell} alt={`${m.name}, ${cellLabel(m, cell)}: the rest frame`} />
        <div className="vcard__text">
          <p className="vcard__subject">
            <span className="vcard__n">{cell.variant}</span>
            {cell.picked && <span className="vcard__badge">picked</span>}
            {cell.subject ? ` ${cell.subject}` : ''}
          </p>
          {tags.length > 0 && <p className="vcard__tags">{tags.join(' · ')}</p>}
          {controls.length > 0 && (
            <ul className="vcard__controls">{controls.map((line, i) => <li key={i}>{line}</li>)}</ul>
          )}
          {risks.length > 0 && (
            <details className="vcard__risks">
              <summary>Risks the designer recorded</summary>
              <ul>{risks.map((line, i) => <li key={i}>{line}</li>)}</ul>
            </details>
          )}
        </div>
      </div>
    </Step>
  );
}

function PassSteps({ m, step, pass }) {
  const cells = m.cells
    .filter((c) => c.kind === 'pass' && c.pass === step)
    .sort((a, b) => a.variant.localeCompare(b.variant));
  const dirs = pass.directions || [];
  const uniq = pass.uniqueness;
  const subjectPass = pass.kind === 'subject';
  const pairHead = subjectPass
    ? ['pair', 'same angle', 'same language', 'subject overlap', 'ok']
    : ['pair', 'body differs', 'ok'];
  const pairRows = (uniq?.pairs || []).filter((p) => p.pair).map((p) => (subjectPass
    ? [p.pair, (p.sameAngle ?? p.samePattern) ? 'yes' : 'no', p.sameLanguage ? 'yes' : 'no',
      p.subjectOverlap != null ? p.subjectOverlap.toFixed(2) : '', { ok: p.ok, text: p.ok ? 'ok' : 'too alike' }]
    : [p.pair, p.bodyDiffPct != null ? `${p.bodyDiffPct.toFixed(1)}%` : '', { ok: p.ok, text: p.ok ? 'ok' : 'too alike' }]));
  const problems = uniq?.problems || [];
  const decision = pass.pick || pass.rejected;
  const picked = pass.pick;

  return (
    <>
      <Phase label={`${PHASE_OF[pass.kind] || 'Pass'} · ${PASS_LABEL[pass.kind] || pass.kind} pass ${pass.number}`} when={pass.created} />

      <Call tool="design_pass_start" args={{ machine_id: m.id, kind: pass.kind, focus: pass.focus }} dur={1300}>
        {dirs.length > 0 ? (
          <>
            <p className="call__line">pass: screens/{m.id}/passes/{step} · {dirs.length} directions, assigned before anything is drawn</p>
            <Table
              head={subjectPass ? ['variant', dirs.some((d) => d.angle) ? 'angle on the idea' : 'pattern', 'way of drawing'] : ['variant', 'composition', 'camera', 'emphasis']}
              rows={dirs.map((d) => (subjectPass
                ? [d.variant, `${directionText(d)}${d.stretch ? ' (outside the category’s column)' : ''}`, d.drawingLanguage || '']
                : [d.variant, d.composition || '', d.camera || '', d.emphasis || '']))}
            />
            <p className="call__line call__line--next">fanOut: run five designer agents in parallel, one per direction. Each variant is drawn, not proposed.</p>
          </>
        ) : <p className="call__line">pass: screens/{m.id}/passes/{step}</p>}
      </Call>

      {cells.map((c) => (
        <VariantCard key={c.i} m={m} cell={c} direction={dirs.find((d) => d.variant === c.variant)} />
      ))}

      <Call tool="design_pass_submit" args={{ machine_id: m.id, pass_name: step }} dur={1400}>
        <p className="call__line">state: <b>{problems.length ? 'needs_revision' : 'ready_for_pick'}</b>{uniq?.checked ? ` · checked ${stamp(uniq.checked)}` : ''}</p>
        {pairRows.length > 0 && <Table head={pairHead} rows={pairRows} />}
        {problems.length > 0 && <ul className="call__problems">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
        <p className="call__line call__line--next">
          next: {problems.length
            ? 'Revise the weakest duplicate into a new direction and submit again; never drop below five.'
            : 'Show the five to the person side by side at 1:1 and ask them to pick. Then design_pass_select.'}
        </p>
      </Call>

      {pass.ranking?.length > 0 && (
        <Step who="reviewer" kind="note" dur={1200}>
          <p className="note__title">Ranking, for the person to weigh. The pick is theirs.</p>
          <ol className="note__ranking">
            {pass.ranking.map((r) => <li key={r.variant}><b>{r.variant}</b> {r.note}</li>)}
          </ol>
        </Step>
      )}

      {picked && (
        <Call who="you" tool="design_pass_select" args={{ machine_id: m.id, variant: picked.variant, reason: picked.reason, chosen_by: picked.chosenBy }} dur={1600}>
          <p className="call__line">selected: <b>{picked.variant}</b>{picked.at ? ` · ${stamp(picked.at)}` : ''}</p>
          <p className="call__line call__line--next">
            next: {subjectPass
              ? 'Fill brief.md section 3 with the five candidates and the pick, then phase 4 (map and budget).'
              : 'Draw the full frame set from the picked rest frame (phase 5), then lint, perceptibility and contact sheet.'}
          </p>
        </Call>
      )}

      {!picked && decision && (
        <Call who="you" tool="design_pass_reject" args={{ machine_id: m.id, reason: decision.reason, chosen_by: decision.chosenBy }} dur={1600}>
          <p className="call__line">state: <b>rejected</b>{decision.at ? ` · ${stamp(decision.at)}` : ''}</p>
          <p className="call__line call__line--next">next: Start a new pass with design_pass_start; put the reason in focus so the five new directions answer it.</p>
        </Call>
      )}

      {!decision && (
        <Step who="server" kind="note" dur={900}>
          <p className="note__title">Pass still open: {pass.state || 'awaiting a pick'}.</p>
        </Step>
      )}
    </>
  );
}

function CleanSteps({ m, step }) {
  const cleaned = m.cells.filter((c) => c.kind === 'cleaned' && c.fromPass === step);
  if (!cleaned.length) return null;
  return (
    <>
      <Step who="agent" kind="note" dur={900}>
        <p className="note__title">Cleaning up the pick: a label removed, a clip fixed, spacing settled. Not a generative pass, so not five.</p>
      </Step>
      {cleaned.map((c) => (
        <Step who="agent" kind="variant" dur={800} id={`cell-${c.i}`} key={c.i}>
          <div className="vcard">
            <Sprite machine={m} cell={c} alt={`${m.name}, ${cellLabel(m, c)}`} />
            <div className="vcard__text">
              <p className="vcard__subject"><span className="vcard__n">cleaned {c.variant}</span>{c.subject ? ` ${c.subject}` : ''}</p>
              {c.cleanNote && <p className="vcard__note">{c.cleanNote}</p>}
            </div>
          </div>
        </Step>
      ))}
    </>
  );
}

function FramesSteps({ m }) {
  const frames = m.cells.filter((c) => c.kind === 'frame');
  if (!frames.length) return null;
  const rest = frames.find((c) => c.name === 'rest');
  const playing = frames.find((c) => c.name === 'playing');
  const sweeps = (m.controls || [])
    .map((ctl) => [ctl, frames.filter((c) => c.control === ctl.id).sort((a, b) => a.value - b.value)])
    .filter(([, cells]) => cells.length);
  const swept = new Set(sweeps.flatMap(([, cells]) => cells.map((c) => c.i)));
  const others = frames.filter((c) => c !== rest && c !== playing && !swept.has(c.i));
  const contact = m.sheets.find((s) => s.kind === 'contact');
  const beforeAfter = m.sheets.find((s) => s.kind === 'before-after');
  const oneOffs = m.sheets.filter((s) => s !== contact && s !== beforeAfter && s.kind !== 'motion-sheet');
  const motionSheet = m.sheets.find((s) => s.kind === 'motion-sheet');
  const single = frames.length === 1;

  return (
    <>
      <Phase label={single ? 'Phase 5 · The picked frame, refined' : 'Phase 5 · Frames'} />

      {m.frames?.lint && (
        <Call tool="lint_frames" args={{ paths: `screens/${m.id}/frames/*.svg`, definition: `screens/${m.id}/definition.json` }} dur={1000}>
          <p className="call__line">{m.frames.lint}</p>
        </Call>
      )}

      <Step who="agent" kind="frames" dur={1400}>
        <p className="note__title">
          {single
            ? 'The chosen rest frame, cleaned and linted, in frames/rest.svg.'
            : 'The frame set the protocol asks for: rest, playing, and every control at 0, 50 and 100 with the others at their defaults.'}
        </p>
        <div className="fgrid">
          {rest && <div className="fgrid__row"><span className="fgrid__label">rest</span><span className="fgrid__cells fgrid__cells--one" id={`cell-${rest.i}`}><Sprite machine={m} cell={rest} /></span></div>}
          {playing && <div className="fgrid__row"><span className="fgrid__label">playing</span><span className="fgrid__cells fgrid__cells--one" id={`cell-${playing.i}`}><Sprite machine={m} cell={playing} /></span></div>}
          {sweeps.map(([ctl, cells]) => (
            <div className="fgrid__row" key={ctl.id}>
              <span className="fgrid__label">{ctl.label} {cells.map((c) => c.value).join(' / ')}</span>
              <span className="fgrid__cells" style={{ '--n': cells.length }}>
                {cells.map((c) => <span key={c.i} id={`cell-${c.i}`}><Sprite machine={m} cell={c} /></span>)}
              </span>
            </div>
          ))}
          {others.length > 0 && (
            <div className="fgrid__row">
              <span className="fgrid__label">{others.map((c) => c.name.replace(/-/g, ' ')).join(', ')}</span>
              <span className="fgrid__cells" style={{ '--n': Math.min(others.length, 3) }}>
                {others.map((c) => <span key={c.i} id={`cell-${c.i}`}><Sprite machine={m} cell={c} /></span>)}
              </span>
            </div>
          )}
        </div>
      </Step>

      {contact && (
        <Call tool="contact_sheet" args={{ frames: `screens/${m.id}/frames`, out: `screens/${m.id}/frames/contact.svg`, png: true }} dur={1500}>
          <p className="call__line">Tiled rest, playing and every control at 0, 50 and 100 at 1:1. Look at the extremes: parts that move must keep clear of each other through their whole range.</p>
          <Sheet sheet={contact} />
        </Call>
      )}

      {beforeAfter && (
        <Step who="agent" kind="sheet" dur={1300}>
          <p className="note__title">Phase 7 · the craft review, side by side at 1:1: the pass that was picked, and the refined rest frame.</p>
          <Strip sheet={beforeAfter} />
        </Step>
      )}

      {oneOffs.map((s) => (
        <Step who="agent" kind="sheet" dur={1200} key={s.file}>
          <p className="note__title">{s.alt}</p>
          <Sheet sheet={s} />
        </Step>
      ))}

      {(m.frames?.summary || m.motion.length > 0 || motionSheet) && (
        <>
          <Phase label="Phase 6 · Motion" />
          {m.frames?.summary && (
            <Doc file={`screens/${m.id}/frames/motion.md`}>
              <p className="doc__text">{m.frames.summary}</p>
            </Doc>
          )}
          {motionSheet && (
            <Step who="agent" kind="sheet" dur={1200}>
              <p className="note__title">{motionSheet.alt}: the key moments of one note, with the time and what the drawing is doing.</p>
              <Sheet sheet={motionSheet} />
            </Step>
          )}
          {m.motion.map((clip) => (
            <Step who="agent" kind="motion" dur={1200} key={clip.name}>
              <p className="note__title">{clip.alt}. Silent: the drawing answers the sound.</p>
              <Motion clip={clip} />
            </Step>
          ))}
        </>
      )}
    </>
  );
}

function KeptSteps({ m }) {
  const kept = m.cells.filter((c) => c.kind === 'kept');
  if (!kept.length) return null;
  return (
    <>
      <Step who="you" kind="note" dur={900}>
        <p className="note__title">Kept on purpose, outside the pass: {kept.map((c) => `${c.variant} as ${c.reason}`).join(', ')}.</p>
      </Step>
      {kept.map((c) => (
        <Step who="agent" kind="variant" dur={800} id={`cell-${c.i}`} key={c.i}>
          <div className="vcard">
            <Sprite machine={m} cell={c} alt={`${m.name}, ${cellLabel(m, c)}`} />
            <div className="vcard__text">
              <p className="vcard__subject"><span className="vcard__n">{c.variant} · {c.reason}</span>{c.subject ? ` ${c.subject}` : ''}</p>
            </div>
          </div>
        </Step>
      ))}
    </>
  );
}

/** Where the machine stands, from what is in its folder. */
export function statusOf(m) {
  const passes = Object.entries(m.passes || {}).sort((a, b) => a[1].number - b[1].number);
  const frames = m.cells.filter((c) => c.kind === 'frame').length;
  const selected = passes.filter(([, p]) => p.state === 'selected');
  const last = passes[passes.length - 1]?.[1];
  return {
    passes: passes.length,
    picked: selected.length ? selected[selected.length - 1][1].pick?.variant : null,
    open: last && last.state !== 'selected' && last.state !== 'rejected' ? last.state : null,
    frames,
    motion: Boolean(m.frames?.summary || m.motion.length),
    next: frames > 1 ? 'phase 7 (review.md)' : selected.length ? 'phase 4 (map and budget), then frames' : 'a subject pass that lands',
  };
}

/* --------------------------------------------------------------- export */

export function Session({ m, manifest }) {
  const cat = manifest.categories[m.category] || {};
  const passes = Object.entries(m.passes || {}).sort((a, b) => a[1].number - b[1].number);
  const status = statusOf(m);
  const stepCount = 0; // the player counts the rendered steps itself

  return (
    <div className="session" data-session="">
      <div className="session__bar" data-session-bar="" hidden>
        <button type="button" className="btn btn--primary btn--sm" data-play="">Play the session</button>
        <button type="button" className="btn btn--sm" data-step-btn="">Step</button>
        <button type="button" className="btn btn--sm" data-all="">Show everything</button>
        <button type="button" className="btn btn--sm" data-restart="">Restart</button>
        <span className="session__pos" data-pos="" data-count={stepCount} />
        <span className="visually-hidden" aria-live="polite" data-live="" />
      </div>

      <ol className="console" data-steps="" aria-label={`${m.name} design session`}>
        <Phase label="Phase 0 · Does it earn a screen?" />
        <Call tool="screen_init" args={{ machine_id: m.id, category: cat.singular || m.category, kind: m.kind }} dur={1100}>
          <p className="call__line">created: screens/{m.id}/brief.md, screens/{m.id}/frames/rest.svg</p>
          <p className="call__line call__line--next">next: Phase 0 (screen or stock page), then intake in brief.md. The subject pass is design_pass_start(kind=&apos;subject&apos;).</p>
        </Call>
        {m.intake?.subject && (
          <Doc file={`screens/${m.id}/brief.md`} section="0 · Screen or stock page?">
            <p className="doc__text"><b>Subject in one sentence:</b> {m.intake.subject}</p>
            <p className="doc__text doc__text--dim">Gate: the subject can be named in one sentence, so it earns a screen.</p>
          </Doc>
        )}

        <Phase label="Phase 1 · Intake" />
        <Doc file={`screens/${m.id}/brief.md`} section="1 · Intake">
          <dl className="doc__rows">
            {m.concept && <><dt>Concept</dt><dd>{m.concept}</dd></>}
            {m.soundsLike && <><dt>Sounds like</dt><dd>{m.soundsLike}</dd></>}
            {m.controls.length > 0 && <><dt>Controls</dt><dd>{m.controls.map((c) => c.label.toLowerCase()).join(', ')}</dd></>}
            {m.intake?.controlSource && <><dt>Control source</dt><dd>{m.intake.controlSource}</dd></>}
          </dl>
        </Doc>
        {m.intake?.lintDefinition && (
          <Call tool="lint_definition" args={{ path: `screens/${m.id}/definition.json` }} dur={1000}>
            <p className="call__line">{m.intake.lintDefinition}</p>
          </Call>
        )}

        {m.scores.length > 0 && (
          <>
            <Phase label="Phase 2 · Listen and rank" />
            <Doc file={`screens/${m.id}/brief.md`} section="2 · Listen and rank" dur={1300}>
              <p className="doc__text doc__text--dim">Each control&apos;s audible effect across 0 to 100, scored 1 to 5. The score sizes how far it moves on screen.</p>
              <Table head={['control', 'audible effect', 'score']} rows={m.scores.map((s) => [s.control, s.effect, String(s.score)])} />
            </Doc>
          </>
        )}

        {passes.map(([step, pass]) => (
          <PassSteps key={step} m={m} step={step} pass={pass} />
        ))}
        {passes.map(([step]) => <CleanSteps key={`clean-${step}`} m={m} step={step} />)}

        <FramesSteps m={m} />
        <KeptSteps m={m} />

        <Phase label="Where it stands" />
        <Call who="agent" tool="screen_status" args={{ machine_id: m.id }} dur={1200}>
          <ul className="call__status">
            <li>brief.md: present</li>
            <li>passes: {status.passes}{status.picked ? `, pick ${status.picked}` : ''}{status.open ? `, last pass ${status.open}` : ''}</li>
            <li>frames: {status.frames ? `${status.frames} present` : 'none yet'}</li>
            <li>motion.md: {status.motion ? 'present' : 'pending'}</li>
            <li>review.md, handoff.md: pending</li>
            <li>device checks: pending until photographed on an OP-XY</li>
          </ul>
          <p className="call__line call__line--next">next: {status.next}</p>
        </Call>
      </ol>
    </div>
  );
}

export { controlLabel };
