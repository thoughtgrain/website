/**
 * live.jsx: Minty's interactive figures, as React components.
 *
 * Each is rendered on the server from Minty's measurements (src/minty/data.json,
 * written by scripts/minty-data.mjs) at its default setting, and hydrated in
 * the browser as an island (see src/app/islands/). The island group fetches
 * the same measurements first, so the first client render matches the
 * prerendered one exactly; from there, state changes redraw the chart with
 * the same spec builders and the same lineChart() the server used.
 *
 * Without JavaScript, every figure is a complete chart at its default with
 * its numbers in a table underneath, and the controls stay hidden.
 *
 * This module is what the browser loads, so it must not import anything that
 * reads the site's content. Values that need the content (the audio host, for
 * Listen) are worked out on the server and arrive as props; see figures.jsx.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  CHAR_DEFAULT, CURVE_DEFAULT, EQ_DEFAULT, LISTEN_DEFAULT, SWELL_DEFAULT,
  charSpec, curveSpec, eqSpec, listenSpec, swellSpec, withFormats,
} from '../../lib/minty-specs.js';
import { useAnnouncer, useLive, useMinty, useWidth } from './hooks';
import { Chart, Frame, Missing, Range, Seg } from './parts';
import { Pedal } from './pedal';

/**
 * One chart driven by one state object. `set(key, value, settle)` updates the
 * state; the readout under the chart is announced straight away for a button
 * press, and once a slider settles (`settle`) rather than at every step.
 */
function useChartFigure(build, initial) {
  const data = useMinty();
  const live = useLive();
  const [st, setSt] = useState(initial);
  const boxRef = useRef(null);
  const width = useWidth(boxRef);
  const { said, say, sayLater } = useAnnouncer();
  const built = useMemo(() => (data ? build(data, st) : null), [build, data, st]);
  const spec = useMemo(() => (built ? withFormats({ ...built.spec, width }) : null), [built, width]);

  const pending = useRef(null);
  useEffect(() => {
    if (!pending.current || !built) return;
    (pending.current === 'settle' ? sayLater : say)(built.readout);
    pending.current = null;
  }, [built, say, sayLater]);

  const set = (key, value, settle = false) => {
    pending.current = settle ? 'settle' : 'now';
    setSt((s) => ({ ...s, [key]: value }));
  };
  return { data, live, st, set, boxRef, built, spec, said, say };
}

const PROFILES = [['synth', 'Synth'], ['guitar', 'Guitar']];

export function TransferCurve({ caption }) {
  const f = useChartFigure(curveSpec, CURVE_DEFAULT);
  if (!f.data) return <Missing />;
  return (
    <Frame
      kind="curve" live={f.live} legend={f.built.spec.legend} readout={f.built.readout}
      said={f.said} table={f.built.table} caption={caption}
      controls={(
        <>
          <Range k="dyn" label="DYNAMICS" value={f.st.dyn} onChange={(v) => f.set('dyn', v, true)} />
          <Range k="sens" label="SENSITIVITY" value={f.st.sens} onChange={(v) => f.set('sens', v, true)} />
          <Seg k="profile" label="Tuned for" value={f.st.profile} options={PROFILES} onSelect={(v) => f.set('profile', v)} />
        </>
      )}
    >
      <Chart spec={f.spec} live={f.live} boxRef={f.boxRef} onSay={f.say} />
    </Frame>
  );
}

export function Characters({ caption }) {
  const f = useChartFigure(charSpec, CHAR_DEFAULT);
  if (!f.data) return <Missing />;
  return (
    <Frame
      kind="chars" live={f.live} legend={f.built.spec.legend} readout={f.built.readout}
      said={f.said} table={f.built.table} caption={caption}
      controls={(
        <Seg
          k="character" label="Character" value={f.st.character}
          options={[['stable', 'Stable'], ['wobble', 'Wobble'], ['twitchy', 'Twitchy']]}
          onSelect={(v) => f.set('character', v)}
        />
      )}
    >
      <Chart spec={f.spec} live={f.live} boxRef={f.boxRef} onSay={f.say} />
    </Frame>
  );
}

export function ShiftyEq({ caption }) {
  const f = useChartFigure(eqSpec, EQ_DEFAULT);
  if (!f.data) return <Missing />;
  return (
    <Frame
      kind="eq" live={f.live} legend={f.built.spec.legend} readout={f.built.readout}
      said={f.said} table={f.built.table} caption={caption}
      controls={(
        <>
          <Range k="knob" label="EQ knob" value={f.st.knob} step={0.025} onChange={(v) => f.set('knob', v, true)} />
          <Seg
            k="shift" label="How hard you're playing" value={f.st.shift}
            options={[[0, 'Under the threshold'], [1, 'At it'], [2, 'Digging in']]}
            onSelect={(v) => f.set('shift', v)}
          />
        </>
      )}
    >
      <Chart spec={f.spec} live={f.live} boxRef={f.boxRef} onSay={f.say} />
    </Frame>
  );
}

export function SwellFigure({ caption }) {
  const f = useChartFigure(swellSpec, SWELL_DEFAULT);
  if (!f.data) return <Missing />;
  return (
    <Frame
      kind="swell" live={f.live} legend={f.built.spec.legend} readout={f.built.readout}
      said={f.said} table={f.built.table} caption={caption}
      controls={<Seg k="profile" label="Tuned for" value={f.st.profile} options={PROFILES} onSelect={(v) => f.set('profile', v)} />}
    >
      <Chart spec={f.spec} live={f.live} boxRef={f.boxRef} onSay={f.say} />
    </Frame>
  );
}

/**
 * A chart with nothing to turn: the case study's DynamicsMap and the THD
 * dumbbell. The server works the spec out and hands it over as props, so the
 * page doesn't have to fetch Minty's measurements just to hover a chart.
 */
export function StaticChart({ kind, spec: raw, readout, table, caption }) {
  const live = useLive();
  const boxRef = useRef(null);
  const width = useWidth(boxRef);
  const { said, say } = useAnnouncer();
  const spec = useMemo(() => (raw ? withFormats({ ...raw, width }) : null), [raw, width]);
  // No spec means no measurements to work one out from (`vite dev`, or a
  // build without src/minty/data.json), the same case as every other figure.
  if (!spec) return <Missing />;
  return (
    <Frame kind={kind} live={live} legend={raw.legend} readout={readout} said={said} table={table} caption={caption}>
      <Chart spec={spec} live={live} boxRef={boxRef} onSay={say} />
    </Frame>
  );
}

/* ----------------------------------------------------------------- listen */

const UNREACHABLE = 'The audio isn’t reachable from here yet. The waveforms above are drawn from the same renders.';

/**
 * The bench's renders, with a Minty/dry switch that keeps your place. Both
 * files play together, one muted, so switching is instant and in step.
 *
 *   sources  { render id: URL }, from the server (the audio host is read
 *            from the site's content, which the browser doesn't load)
 */
export function Listen({ caption, sources = {} }) {
  const f = useChartFigure(listenSpec, LISTEN_DEFAULT);
  const [ab, setAb] = useState('wet');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [note, setNote] = useState('');
  const wet = useRef(null);
  const dry = useRef(null);
  const raf = useRef(null);
  const switching = useRef(null);

  // `muted` is a property React doesn't keep in sync, so it's set here.
  useEffect(() => {
    if (!wet.current || !dry.current) return;
    wet.current.muted = ab !== 'wet';
    dry.current.muted = ab !== 'dry';
  }, [ab, f.live]);

  // The playhead follows the wet file while it plays.
  useEffect(() => {
    if (!playing) return undefined;
    const tick = () => {
      if (wet.current) setTime(wet.current.currentTime || 0);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const stop = () => {
    setPlaying(false);
    if (wet.current) wet.current.pause();
    if (dry.current) dry.current.pause();
  };
  const fail = () => { stop(); setNote(UNREACHABLE); };

  const play = () => {
    const w = wet.current;
    const d = dry.current;
    if (!w || !d) return;
    w.muted = ab !== 'wet';
    d.muted = ab !== 'dry';
    d.currentTime = w.currentTime;
    Promise.all([w.play(), d.play()]).then(() => setPlaying(true)).catch(fail);
  };

  // A new render keeps your place: remember where the old one was and
  // whether it was playing, let React swap the source, then go back there.
  // Setting currentTime before the new file has loaded is allowed: the
  // element holds it as the position to start from once it has.
  useEffect(() => {
    const w = wet.current;
    const was = switching.current;
    if (!w || !was) return;
    switching.current = null;
    w.currentTime = was.t;
    if (was.playing) play();
    // `play` reads the current refs and `ab`, which is what it should use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.st.render]);

  const pickRender = (id) => {
    switching.current = { t: wet.current ? wet.current.currentTime : 0, playing };
    if (playing) stop();
    f.set('render', id);
  };

  const pickAb = (v) => {
    setAb(v);
    // Keep the two in step at the moment of the switch.
    if (playing && wet.current && dry.current) dry.current.currentTime = wet.current.currentTime;
    f.say(v === 'wet' ? 'Hearing Minty' : 'Hearing the dry signal');
  };

  const seek = (t) => {
    if (wet.current) wet.current.currentTime = t;
    if (dry.current) dry.current.currentTime = t;
    setTime(t);
  };

  if (!f.data) return <Missing />;
  const renders = f.data.renders.filter((r) => r.id !== '00_dry');
  const dryRender = f.data.renders.find((r) => r.id === '00_dry');

  return (
    <Frame
      kind="listen" live={f.live} legend={f.built.spec.legend} readout={f.built.readout}
      said={f.said} caption={caption}
      controls={(
        <>
          <Seg k="render" label="Setting" value={f.st.render} options={renders.map((r) => [r.id, r.label])} onSelect={pickRender} />
          <div className="mlisten__transport">
            <button type="button" className="mplay" data-play="" aria-pressed={playing ? 'true' : 'false'} onClick={() => (playing ? stop() : play())}>
              {playing ? 'Pause' : 'Play'}
            </button>
            <Seg k="ab" label="Hear" value={ab} options={[['wet', 'Minty'], ['dry', 'Dry']]} onSelect={pickAb} />
            <span className="mlisten__time" data-time="">{`${time.toFixed(1)}s`}</span>
          </div>
        </>
      )}
      after={(
        <>
          {note && <p className="mfig__note" data-audio-note="">{note}</p>}
          {/* The renders, as plain links: the record without the script, and
              the way in for anyone who'd rather download than play here. */}
          <details className="mfig__table" data-static-list="">
            <summary>Every render, and its settings</summary>
            <table>
              <thead><tr><th scope="col">render</th><th scope="col">settings</th><th scope="col">level</th></tr></thead>
              <tbody>
                {f.data.renders.map((r) => (
                  <tr key={r.id}>
                    <td><a href={sources[r.id]}>{r.label}</a></td>
                    <td>{r.id === '00_dry' ? 'the synth test phrase, untouched' : `SENSITIVITY ${r.sens}, DYNAMICS ${r.dyn}, EQ ${r.eq}, ${r.character}${r.swell ? ', swell' : ''}`}</td>
                    <td>{`${r.rmsDb} dB RMS`.replace('-', '−')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <audio
            ref={wet} data-audio="wet" preload="none" src={sources[f.st.render]}
            onError={fail}
            onEnded={() => { stop(); seek(0); }}
          />
          <audio ref={dry} data-audio="dry" preload="none" src={dryRender ? sources[dryRender.id] : undefined} onError={fail} />
        </>
      )}
    >
      <Chart
        spec={f.spec} live={f.live} boxRef={f.boxRef} hover={false} onSeek={seek}
        overlay={f.live ? (frame, x) => {
          const px = x(Math.min(f.spec.x.domain[1], time));
          return <line className="mplayhead" x1={px} x2={px} y1={frame.m.top} y2={frame.H - frame.m.bottom} />;
        } : null}
      />
    </Frame>
  );
}

/* ---------------------------------------------------------------- islands */

/** What islands/client.jsx hydrates for the `minty/…` islands. */
export const islands = { TransferCurve, Characters, ShiftyEq, SwellFigure, Listen, Pedal, StaticChart };

/** Every island but the static charts needs the measurements to hydrate. */
export const needsData = (name) => name !== 'StaticChart';

/** Fetch the measurements once for the page, from beside the site root. */
export function prepare(elements) {
  const base = (elements[0] && elements[0].getAttribute('data-base')) || './';
  return fetch(`${base}minty/data.json`).then((r) => (r.ok ? r.json() : null));
}
