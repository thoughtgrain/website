/**
 * figures.jsx: the Minty figures content can use, as the server sees them.
 *
 * The interactive ones live in live.jsx and pedal.jsx, as React components the
 * browser hydrates as islands (src/app/islands/). This module wraps each one
 * as an island and works out anything only the server should: the audio
 * URLs, which come from the site's content, and the finished specs of the two
 * charts that have nothing to turn, so their pages don't have to fetch
 * Minty's measurements just to hover them.
 *
 * Without the measurements (src/minty/data.json, written by
 * scripts/minty-data.mjs) every figure renders a note saying so, in place,
 * and nothing is hydrated.
 *
 * The rest render once and stay put: the LED table, the signal flow and the
 * link to the essay that puts the knobs in your hands.
 */

import Link from '../../Link';
import { island } from '../../islands/island';
import { CHARACTERS, LED, mapSpec, thdSpec } from '../../lib/minty-specs.js';
import { minty, mintyAsset } from '../../minty.js';
import { Characters, Listen, ShiftyEq, StaticChart, SwellFigure, TransferCurve } from './live';
import { Pedal as PedalFigure } from './pedal';

const measured = () => Boolean(minty);

export const TransferCurveIsland = island('minty/TransferCurve', TransferCurve, { when: measured });
export const CharactersIsland = island('minty/Characters', Characters, { when: measured });
export const ShiftyEqIsland = island('minty/ShiftyEq', ShiftyEq, { when: measured });
export const SwellIsland = island('minty/SwellFigure', SwellFigure, { when: measured });
export const PedalIsland = island('minty/Pedal', PedalFigure, { when: measured });

export const ListenIsland = island('minty/Listen', Listen, {
  when: measured,
  props: ({ caption }) => ({
    caption,
    sources: Object.fromEntries(minty.renders.map((r) => [r.id, mintyAsset(r.file)])),
  }),
});

export const DynamicsMap = island('minty/StaticChart', StaticChart, {
  when: measured,
  props: ({ caption }) => {
    const built = mapSpec(minty);
    return { kind: 'map', spec: built.spec, readout: built.readout, table: built.table, caption };
  },
});

export const BassDistortion = island('minty/StaticChart', StaticChart, {
  when: measured,
  props: ({ caption }) => {
    const built = thdSpec(minty);
    return {
      kind: 'thd',
      spec: built.spec,
      table: { head: ['sine', 'guitar profile', 'synth profile'], rows: built.rows.map((r) => [`${r.hz} Hz`, `${r.guitar}%`, `${r.synth}%`]) },
      caption,
    };
  },
});

/** The LED's colours, as a table of swatches: mode by state. */
export function LedTable() {
  return (
    <table className="mledtable">
      <thead><tr><th scope="col">Mode</th><th scope="col">Idle</th><th scope="col">Compressing</th></tr></thead>
      <tbody>
        {[...CHARACTERS, 'Swell'].map((mode) => (
          <tr key={mode}>
            <th scope="row">{mode === 'Swell' ? 'Swell on (overrides)' : mode}</th>
            {['idle', 'busy'].map((k) => (
              <td key={k}><span className="mledtable__dot" style={{ background: LED[mode][k][1] }} aria-hidden="true" />{LED[mode][k][0]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The signal path as two rows: what the audio goes through, and what steers it. */
export function SignalFlow() {
  const audio = ['in', '1.5 ms lookahead', '× gain × swell', 'dynamic EQ', 'limiter or Dusty', 'out'];
  const control = ['detector (30 Hz highpass, stereo-linked)', 'compressor', 'swell', 'level + threshold steer the EQ'];
  return (
    <figure className="mflow">
      <div className="mflow__row">
        <span className="mflow__label">audio</span>
        <ol className="mflow__steps">{audio.map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
      <div className="mflow__row mflow__row--control">
        <span className="mflow__label">control</span>
        <ol className="mflow__steps">{control.map((s) => <li key={s}>{s}</li>)}</ol>
      </div>
      <figcaption className="mfig__cap">The detector hears the input 1.5 ms before the audio path does, so the compressor and the swell can act before an attack arrives instead of just after it.</figcaption>
    </figure>
  );
}

/**
 * The link from the project page to the essay with the figures in it.
 * `to` is a site path ("/essays/…/"); Link makes it relative to this page.
 */
export function TryMinty({ to, title = 'Turn Minty’s knobs', text }) {
  return (
    <Link className="mcard" to={to}>
      <span className="mcard__led" aria-hidden="true" />
      <span className="mcard__text">
        <span className="mcard__title">{title}</span>
        <span className="mcard__dek">{text || 'An essay with every chart measured from Minty’s own code: the curve under each knob, the EQ, the swell, and the renders to listen to.'}</span>
      </span>
      <span className="mcard__go" aria-hidden="true">&rarr;</span>
    </Link>
  );
}

/** The names content uses for them. */
export const mintyFigures = {
  TransferCurve: TransferCurveIsland,
  DynamicsMap,
  Characters: CharactersIsland,
  ShiftyEq: ShiftyEqIsland,
  SwellFigure: SwellIsland,
  BassDistortion,
  Listen: ListenIsland,
  Pedal: PedalIsland,
  LedTable,
  SignalFlow,
  TryMinty,
};
