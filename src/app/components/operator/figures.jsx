/**
 * figures.jsx: the screen figures the case study can place in its prose.
 *
 * Each takes a machine id and names what to show, and looks the rest up in the
 * manifest, so the MDX says `<ScreenPass machine="kiln" pass="01-subject" />`
 * and never a filename or a cell number. If the manifest is absent (the client
 * bundle, or a build without the generated index) they render nothing rather
 * than a broken image: the words around them still stand.
 */

import { machineById, controlLabel, opxy, totals } from '../../opxy.js';
import { Motion, Sheet, Sprite, Strip } from './Sprite';

function Figure({ caption, cols, children, className = '' }) {
  return (
    <figure className={`screen-figure${className ? ` ${className}` : ''}`}>
      <div className="screen-figure__row" style={cols ? { '--n': cols } : undefined}>{children}</div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Named finished frames side by side: `cells="rest,playing"`. */
export function ScreenCells({ machine: id, cells = 'rest', caption }) {
  const m = machineById(id);
  if (!m) return null;
  const names = cells.split(',').map((s) => s.trim());
  const found = names.map((n) => m.cells.find((c) => c.kind === 'frame' && c.name === n)).filter(Boolean);
  if (!found.length) return null;
  return (
    <Figure caption={caption} cols={found.length}>
      {found.map((c) => <Sprite key={c.i} machine={m} cell={c} />)}
    </Figure>
  );
}

/** One control at 0, 50 and 100. */
export function ScreenSweep({ machine: id, control, caption }) {
  const m = machineById(id);
  if (!m) return null;
  const cells = m.cells
    .filter((c) => c.kind === 'frame' && c.control === control)
    .sort((a, b) => a.value - b.value);
  if (!cells.length) return null;
  return (
    <Figure caption={caption || `${m.name}: ${controlLabel(m, control)} at 0, 50 and 100.`} cols={cells.length}>
      {cells.map((c) => <Sprite key={c.i} machine={m} cell={c} />)}
    </Figure>
  );
}

/** The five variants of one design pass. */
export function ScreenPass({ machine: id, pass, caption }) {
  const m = machineById(id);
  if (!m) return null;
  const cells = m.cells
    .filter((c) => c.kind === 'pass' && c.pass === pass)
    .sort((a, b) => a.variant.localeCompare(b.variant));
  if (!cells.length) return null;
  const p = m.passes[pass] || {};
  const fallback = `${m.name}, pass ${p.number || ''} (${p.kind || 'design'}): five variants${p.state ? `, ${p.state}` : ''}.`;
  return (
    <Figure caption={caption || fallback} cols={cells.length} className="screen-figure--pass">
      {cells.map((c) => (
        <span className="screen-figure__cell" key={c.i}>
          <Sprite machine={m} cell={c} />
          <span className="screen-figure__tag">{c.variant}</span>
        </span>
      ))}
    </Figure>
  );
}

/** A sheet by kind: `kind="contact"`, `kind="before-after"`, or a one-off's name. */
export function ScreenSheet({ machine: id, kind = 'contact', caption }) {
  const m = machineById(id);
  if (!m) return null;
  const s = m.sheets.find((x) => x.kind === kind);
  if (!s) return null;
  return (
    <Figure caption={caption || s.alt} className="screen-figure--sheet">
      {kind === 'before-after' ? <Strip sheet={s} /> : <Sheet sheet={s} />}
    </Figure>
  );
}

/** One motion clip by name, e.g. `name="motion"` or `name="v3-motion"`. */
export function ScreenMotion({ machine: id, name = 'motion', caption }) {
  const m = machineById(id);
  if (!m) return null;
  const clip = m.motion.find((c) => c.name === name) || m.motion[0];
  if (!clip) return null;
  return (
    <Figure caption={caption || `${clip.alt}. Silent; the drawing answers the sound.`} className="screen-figure--motion">
      <Motion clip={clip} />
    </Figure>
  );
}

/**
 * The link from the case study to the demonstration: a dark card the width
 * of the column with the featured machine's rest frame and a plain invitation.
 * `href` is relative to the case study's own directory, so "demo/" resolves
 * to its target without the component knowing the slug: the case study
 * passes `../operator-design-demo/`.
 */
export function SeeItWork({ href = 'demo/', machine: id, title = 'Watch it design a screen', text }) {
  const m = machineById(id);
  const rest = m && m.cells.find((c) => c.kind === 'frame' && c.name === 'rest');
  return (
    <a className="see-it" href={href}>
      {rest && <span className="see-it__frame"><Sprite machine={m} cell={rest} alt="" /></span>}
      <span className="see-it__text">
        <span className="see-it__kicker">The demonstration</span>
        <span className="see-it__title">{title}</span>
        <span className="see-it__dek">
          {text || `${m ? `${m.name}\u2019s` : 'One'} session, one step at a time: what the server did at each, why that step exists, and the records to poke at. Then every machine, and every screen they produced.`}
        </span>
        <span className="see-it__go" aria-hidden="true">&rarr;</span>
      </span>
    </a>
  );
}

/**
 * The device's eight greys with their contrast against black, as a strip.
 * Numbers from opxy/tokens.json; the floors are WCAG's 4.5:1 for text and
 * 3:1 for parts that carry meaning.
 */
const GREYS = [
  ['#323232', '1.6'], ['#4B4B4B', '2.4'], ['#646464', '3.6'], ['#7D7D7D', '5.1'],
  ['#969696', '7.1'], ['#AFAFAF', '9.6'], ['#CDCDCD', '13.2'],
];
export function GreyRamp({ caption }) {
  return (
    <figure className="screen-figure grey-ramp">
      <ul className="grey-ramp__strip">
        {GREYS.map(([hex, ratio]) => {
          const n = Number(ratio);
          const role = n >= 4.5 ? 'text' : n >= 3 ? 'parts' : 'ground';
          return (
            <li key={hex} className={`grey-ramp__step grey-ramp__step--${role}`} style={{ '--g': hex }}>
              <span className="grey-ramp__swatch" />
              <span className="grey-ramp__hex">{hex.toLowerCase()}</span>
              <span className="grey-ramp__ratio">{ratio}:1</span>
              <span className="grey-ramp__role">{role}</span>
            </li>
          );
        })}
      </ul>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/**
 * One sentence of totals, computed. The prose used to state counts and was
 * wrong about them within a week, so the archive counts itself.
 */
export function ScreensSummary() {
  if (!opxy) return null;
  const t = totals();
  return (
    <>
      {t.screens} screens for {t.machines} machines, {t.passes} of them pass variants, plus {t.sheets} sheets and {t.clips} motion clips
    </>
  );
}

export const screenFigures = {
  ScreenCells, ScreenSweep, ScreenPass, ScreenSheet, ScreenMotion, ScreensSummary, SeeItWork, GreyRamp,
};
