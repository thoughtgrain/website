/**
 * figures.jsx: the Minty pages' figures.
 *
 * Every figure is drawn here, at the server, from Minty's own measurements
 * (src/minty/data.json, written by scripts/minty-data.mjs) at its default
 * setting. src/js/minty.js then makes it live: it fetches the same data,
 * redraws each chart at its real width, and redraws again as the knobs move.
 * Without the script, every figure is a complete chart at its default with
 * its numbers in a table underneath.
 *
 * The contract with the script:
 *
 *   figure[data-mfig="curve|map|chars|eq|swell|listen|thd|pedal"]
 *     data-state   the figure's state as JSON, updated as controls change
 *     data-spec    (static charts only) the spec, so they can redraw without data
 *     data-src     where /minty/data.json is, relative to this page
 *   [data-controls] hidden          inputs and buttons, shown by the script
 *   input[data-key]                 sets state[key] to the number
 *   button[data-key][data-value]    sets state[key] to the value
 *   [data-chart]                    the SVG, replaced on redraw
 *   [data-readout]                  the sentence under the chart
 *   [data-legend]                   the legend, rebuilt with the chart
 */

import Html from '../Html';
import { relativeHref, useRoute } from '../../base.js';
import { lineChart } from '../../lib/minty-charts.js';
import {
  CHARACTERS, CHAR_DEFAULT, CURVE_DEFAULT, EQ_DEFAULT, LED, LISTEN_DEFAULT, SWELL_DEFAULT,
  charSpec, curveSpec, eqSpec, listenSpec, mapSpec, swellSpec, thdSpec, withFormats,
} from '../../lib/minty-specs.js';
import { minty, mintyAsset } from '../../minty.js';
import { Pedal } from './pedal';

const SSR_WIDTH = 640;

function Missing() {
  return <p className="mfig__missing">The measurements behind this figure are added when the site is built.</p>;
}

function Legend({ items = [] }) {
  if (items.length < 2) return <div className="mfig__legend" data-legend="" />;
  return (
    <ul className="mfig__legend" data-legend="">
      {items.map((it) => (
        <li key={it.label}><span className={`mkey mkey--${it.mark || 'line'} mc-${it.role}`} aria-hidden="true" />{it.label}</li>
      ))}
    </ul>
  );
}

function Table({ table }) {
  if (!table) return null;
  return (
    <details className="mfig__table">
      <summary>The numbers</summary>
      <table>
        <thead><tr>{table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

function Range({ k, label, value, min = 0, max = 1, step = 0.01, out }) {
  return (
    <label className="mrange">
      <span className="mrange__label">{label}</span>
      <input type="range" min={min} max={max} step={step} defaultValue={value} data-key={k} />
      <output className="mrange__out" data-out={k}>{out != null ? out : value}</output>
    </label>
  );
}

function Seg({ k, label, value, options }) {
  return (
    <div className="mseg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" className="mseg__btn" data-key={k} data-value={v} aria-pressed={String(v) === String(value) ? 'true' : 'false'}>{text}</button>
      ))}
    </div>
  );
}

/** The common frame: controls, chart, legend, sentence, table, caption. */
function Figure({ kind, state, built, controls, caption, staticSpec, height, label }) {
  const route = useRoute();
  const spec = withFormats({ ...built.spec, width: SSR_WIDTH, height: height || built.spec.height });
  return (
    <figure
      className={`mfig mfig--${kind}`}
      data-mfig={kind}
      data-state={JSON.stringify(state)}
      data-src={relativeHref(route, '/minty/data.json')}
      {...(staticSpec ? { 'data-spec': JSON.stringify(built.spec) } : {})}
      {...(label ? { 'aria-label': label } : {})}
    >
      {controls && <div className="mfig__controls" data-controls="" hidden>{controls}</div>}
      <Html className="mfig__chart" data-chart="" html={lineChart(spec).svg} />
      <Legend items={built.spec.legend} />
      {built.readout && <p className="mfig__readout" data-readout="">{built.readout}</p>}
      <p className="visually-hidden" aria-live="polite" data-say="" />
      <Table table={built.table} />
      {caption && <figcaption className="mfig__cap">{caption}</figcaption>}
      <div className="mtip" data-tip-box="" hidden />
    </figure>
  );
}

/* ---------------------------------------------------------------- figures */

export function TransferCurve({ caption }) {
  if (!minty) return <Missing />;
  const st = CURVE_DEFAULT;
  return (
    <Figure
      kind="curve"
      state={st}
      built={curveSpec(minty, st)}
      caption={caption}
      controls={(
        <>
          <Range k="dyn" label="DYNAMICS" value={st.dyn} />
          <Range k="sens" label="SENSITIVITY" value={st.sens} />
          <Seg k="profile" label="Tuned for" value={st.profile} options={[['synth', 'Synth'], ['guitar', 'Guitar']]} />
        </>
      )}
    />
  );
}

export function DynamicsMap({ caption }) {
  if (!minty) return <Missing />;
  return <Figure kind="map" state={{}} built={mapSpec(minty)} caption={caption} staticSpec />;
}

export function Characters({ caption }) {
  if (!minty) return <Missing />;
  const st = CHAR_DEFAULT;
  return (
    <Figure
      kind="chars"
      state={st}
      built={charSpec(minty, st)}
      caption={caption}
      controls={<Seg k="character" label="Character" value={st.character} options={[['stable', 'Stable'], ['wobble', 'Wobble'], ['twitchy', 'Twitchy']]} />}
    />
  );
}

export function ShiftyEq({ caption }) {
  if (!minty) return <Missing />;
  const st = EQ_DEFAULT;
  return (
    <Figure
      kind="eq"
      state={st}
      built={eqSpec(minty, st)}
      caption={caption}
      controls={(
        <>
          <Range k="knob" label="EQ knob" value={st.knob} step={0.025} />
          <Seg k="shift" label="How hard you're playing" value={st.shift} options={[[0, 'Under the threshold'], [1, 'At it'], [2, 'Digging in']]} />
        </>
      )}
    />
  );
}

export function SwellFigure({ caption }) {
  if (!minty) return <Missing />;
  const st = SWELL_DEFAULT;
  return (
    <Figure
      kind="swell"
      state={st}
      built={swellSpec(minty, st)}
      caption={caption}
      controls={<Seg k="profile" label="Tuned for" value={st.profile} options={[['synth', 'Synth'], ['guitar', 'Guitar']]} />}
    />
  );
}

export function BassDistortion({ caption }) {
  if (!minty) return <Missing />;
  const built = thdSpec(minty);
  const route = useRoute();
  const spec = withFormats({ ...built.spec, width: SSR_WIDTH });
  return (
    <figure className="mfig mfig--thd" data-mfig="thd" data-state="{}" data-spec={JSON.stringify(built.spec)} data-src={relativeHref(route, '/minty/data.json')}>
      <Html className="mfig__chart" data-chart="" html={lineChart(spec).svg} />
      <Legend items={built.spec.legend} />
      <p className="visually-hidden" aria-live="polite" data-say="" />
      <Table table={{ head: ['sine', 'guitar profile', 'synth profile'], rows: built.rows.map((r) => [`${r.hz} Hz`, `${r.guitar}%`, `${r.synth}%`]) }} />
      {caption && <figcaption className="mfig__cap">{caption}</figcaption>}
      <div className="mtip" data-tip-box="" hidden />
    </figure>
  );
}

export function Listen({ caption }) {
  if (!minty) return <Missing />;
  const st = LISTEN_DEFAULT;
  const renders = minty.renders.filter((r) => r.id !== '00_dry');
  const dry = minty.renders.find((r) => r.id === '00_dry');
  const sources = Object.fromEntries(minty.renders.map((r) => [r.id, mintyAsset(r.file)]));
  return (
    <figure className="mfig mfig--listen" data-mfig="listen" data-state={JSON.stringify({ ...st, ab: 'wet' })} data-src={relativeHref(useRoute(), '/minty/data.json')} data-sources={JSON.stringify(sources)}>
      <div className="mfig__controls" data-controls="" hidden>
        <Seg k="render" label="Setting" value={st.render} options={renders.map((r) => [r.id, r.label])} />
        <div className="mlisten__transport">
          <button type="button" className="mplay" data-play="" aria-pressed="false">Play</button>
          <Seg k="ab" label="Hear" value="wet" options={[['wet', 'Minty'], ['dry', 'Dry']]} />
          <span className="mlisten__time" data-time="">0.0s</span>
        </div>
      </div>
      <Html className="mfig__chart" data-chart="" html={lineChart(withFormats({ ...listenSpec(minty, st).spec, width: SSR_WIDTH })).svg} />
      <Legend items={listenSpec(minty, st).spec.legend} />
      <p className="mfig__readout" data-readout="">{listenSpec(minty, st).readout}</p>
      <p className="mfig__note" data-audio-note="" hidden />
      <p className="visually-hidden" aria-live="polite" data-say="" />
      {/* The renders, as plain links: the record without the script, and the
          way in for anyone who'd rather download than play here. */}
      <details className="mfig__table" data-static-list="">
        <summary>Every render, and its settings</summary>
        <table>
          <thead><tr><th scope="col">render</th><th scope="col">settings</th><th scope="col">level</th></tr></thead>
          <tbody>
            {minty.renders.map((r) => (
              <tr key={r.id}>
                <td><a href={mintyAsset(r.file)}>{r.label}</a></td>
                <td>{r.id === '00_dry' ? 'the synth test phrase, untouched' : `SENSITIVITY ${r.sens}, DYNAMICS ${r.dyn}, EQ ${r.eq}, ${r.character}${r.swell ? ', swell' : ''}`}</td>
                <td>{`${r.rmsDb} dB RMS`.replace('-', '−')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      {caption && <figcaption className="mfig__cap">{caption}</figcaption>}
      <audio data-audio="wet" preload="none" src={sources[st.render]} />
      <audio data-audio="dry" preload="none" src={sources[dry.id]} />
      <div className="mtip" data-tip-box="" hidden />
    </figure>
  );
}

/* ------------------------------------------------------------------ pedal */

// The Endless itself, drawn with its controls laid over it: see pedal.jsx.
export { Pedal };

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

/** The link from the case study to the hands-on page. */
export function TryMinty({ href, title = 'Turn Minty\u2019s knobs', text }) {
  return (
    <a className="mcard" href={href}>
      <span className="mcard__led" aria-hidden="true" />
      <span className="mcard__text">
        <span className="mcard__title">{title}</span>
        <span className="mcard__dek">{text || 'Every chart measured from Minty\u2019s own code: the curve under each knob, the EQ, the swell, and the renders to listen to.'}</span>
      </span>
      <span className="mcard__go" aria-hidden="true">&rarr;</span>
    </a>
  );
}

export const mintyFigures = {
  TransferCurve, DynamicsMap, Characters, ShiftyEq, SwellFigure, BassDistortion, Listen, Pedal, LedTable, SignalFlow, TryMinty,
};
