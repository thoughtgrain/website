/**
 * minty-specs.js: what each Minty figure draws, for a given knob state.
 *
 * Each function takes the measured data (src/minty/data.json) and a state,
 * and returns a chart spec for lineChart() plus the sentence that goes under
 * it. Called by the server render with each figure's default state, and by
 * src/js/minty.js with whatever the reader has turned the knobs to. Pure.
 *
 * Specs are plain data (formats are named, not functions) so a figure can
 * carry its own spec in the page and the script can redraw it at the real
 * width without the measurements.
 */

import {
  curveAt, dynamicsZone, eqWords, hzLabel, locate, slopeAbove, slopeWords, thresholdFor, valueAt,
} from './minty-charts.js';

export const FORMATS = {
  db: (v) => `${Math.round(v)}`.replace('-', '−'),
  hz: hzLabel,
  s: (v) => `${Math.round(v * 10) / 10}s`,
  pct: (v) => `${Math.round(v * 100) / 100}%`,
  knob: (v) => `${Math.round(v * 100) / 100}`,
  slope: (v) => `${Math.round(v * 10) / 10}`.replace('-', '−'),
  amp: (v) => `${Math.round(v * 100) / 100}`,
  row: (v) => '',
};

/** Spec formats are names; give lineChart the functions. */
export function withFormats(spec) {
  return {
    ...spec,
    x: { ...spec.x, format: FORMATS[spec.x.fmt] },
    y: { ...spec.y, format: FORMATS[spec.y.fmt] },
  };
}

const range = (a, b, step) => {
  const out = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
};

const dbSign = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}`.replace('-', '−');

/* ------------------------------------------------------------ the curve */

export const CURVE_DEFAULT = { profile: 'synth', sens: 0.5, dyn: 0.35 };

export function curveSpec(data, st = CURVE_DEFAULT) {
  const p = data.profiles[st.profile];
  const c = p.curves;
  const outs = curveAt(c, st.sens, st.dyn);
  const thr = thresholdFor(p, st.sens);
  const slope = slopeAbove(c, p, st.sens, st.dyn);
  return {
    spec: {
      title: `Output level against input level, DYNAMICS ${st.dyn.toFixed(2)}, SENSITIVITY ${st.sens.toFixed(2)}, ${st.profile} profile`,
      height: 320,
      x: { domain: [-60, 0], ticks: range(-60, 0, 12), ticksNarrow: range(-60, 0, 20), fmt: 'db', label: 'into Minty (dBFS, RMS)' },
      y: { domain: [-60, 0], ticks: range(-60, 0, 12), fmt: 'db', label: 'out of Minty' },
      rules: [{ x: thr, label: `threshold ${FORMATS.db(thr)}` }],
      series: [
        { id: 'dry', label: 'dry, 1:1', role: 'context', points: [[-60, -60], [0, 0]], end: true },
        { id: 'minty', label: 'Minty', role: 'accent', points: c.levels.map((lv, i) => [lv, outs[i]]), end: true },
      ],
      legend: [{ role: 'accent', label: 'Minty at this setting' }, { role: 'context', label: 'dry signal, 1:1' }],
    },
    readout: `Threshold ${FORMATS.db(thr)} dBFS. DYNAMICS ${st.dyn.toFixed(2)} is ${dynamicsZone(st.dyn)}: above the threshold, ${slopeWords(slope)}.`,
    table: { head: ['in (dBFS)', 'out (dBFS)'], rows: c.levels.filter((_, i) => i % 2 === 0).map((lv) => [FORMATS.db(lv), (Math.round(valueAt(c.levels, outs, lv) * 10) / 10).toString().replace('-', '−')]) },
  };
}

/* ------------------------------------------------------- the dynamics map */

// The caption explains the scale, so the readout carries the landmarks the
// prose leans on: where the knob starts, noon, where sag begins, the end.
function mapReadout(pts) {
  const at = (d) => {
    const hit = pts.find(([x]) => Math.abs(x - d) < 1e-6);
    return hit ? hit[1].toFixed(2).replace('-', '−') : null;
  };
  const marks = [[0, 'at zero'], [0.5, 'at noon'], [0.8, 'at 0.8'], [1, 'fully clockwise']]
    .map(([d, where]) => { const v = at(d); return v == null ? null : `${v} ${where}`; })
    .filter(Boolean);
  return marks.length ? `Measured slope: ${marks.join(', ')}.` : '';
}

export function mapSpec(data, st = { profile: 'synth', sens: 0.5 }) {
  const p = data.profiles[st.profile];
  const c = p.curves;
  const pts = c.dyn.map((d) => [d, slopeAbove(c, p, st.sens, d)]).filter(([, s]) => s != null);
  return {
    spec: {
      title: 'Slope above the threshold across the DYNAMICS knob',
      height: 280,
      x: { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], fmt: 'knob', label: 'DYNAMICS knob' },
      y: { domain: [-1.5, 1], ticks: [-1.5, -1, -0.5, 0, 0.5, 1], fmt: 'slope', label: 'dB out per dB in' },
      bands: [
        { x0: 0, x1: 0.5, label: 'compress' },
        { x0: 0.5, x1: 0.8, label: 'limit', strong: true },
        { x0: 0.8, x1: 1, label: 'sag' },
      ],
      rules: [{ y: 0, label: '' }],
      series: [{ id: 'slope', label: 'measured slope', role: 'accent', points: pts }],
    },
    readout: mapReadout(pts),
    table: { head: ['DYNAMICS', 'slope'], rows: pts.filter((_, i) => i % 2 === 0).map(([d, s]) => [d.toFixed(2), FORMATS.slope(s)]) },
  };
}

/* ----------------------------------------------------------- characters */

export const CHAR_DEFAULT = { profile: 'synth', character: 'wobble' };
const CHAR_LABEL = { stable: 'Stable', wobble: 'Wobble', twitchy: 'Twitchy' };

export function charSpec(data, st = CHAR_DEFAULT) {
  const ch = data.profiles[st.profile].characters;
  const t = (i) => ch.t0 + i * ch.hop;
  const pts = (arr) => arr.map((v, i) => [t(i), v]);
  const series = [{ id: 'stable', label: 'Stable', role: 'context', points: pts(ch.stable) }];
  if (st.character !== 'stable') series.push({ id: st.character, label: CHAR_LABEL[st.character], role: 'accent', points: pts(ch[st.character]) });
  else series[0].role = 'accent';
  const settled = ch[st.character].slice(Math.round((1.2 - ch.t0) / ch.hop), Math.round((1.5 - ch.t0) / ch.hop));
  const ripple = Math.max(...settled) - Math.min(...settled);
  return {
    spec: {
      title: `Gain reduction over time, ${CHAR_LABEL[st.character]} against Stable`,
      height: 280,
      x: { domain: [ch.t0, ch.t0 + (ch.stable.length - 1) * ch.hop], ticks: [0.5, 1, 1.5, 2], fmt: 's', label: 'time' },
      y: { domain: [0, 24], ticks: [0, 6, 12, 18, 24], fmt: 'db', label: 'gain reduction (dB)' },
      bands: [{ x0: ch.loudFrom, x1: ch.loudTo, label: 'loud note' }],
      series,
      legend: st.character === 'stable'
        ? [{ role: 'accent', label: 'Stable' }]
        : [{ role: 'accent', label: CHAR_LABEL[st.character] }, { role: 'context', label: 'Stable, for comparison' }],
    },
    readout: st.character === 'stable'
      ? 'Stable: the compressor alone. It clamps down when the loud note arrives, holds still, and lets go when it ends.'
      : `${CHAR_LABEL[st.character]}: while the note holds, the gain still moves by about ${Math.round(ripple * 10) / 10} dB.`,
  };
}

/* ------------------------------------------------------------------ EQ */

export const EQ_DEFAULT = { knob: 0.2, shift: 0 };
const SHIFT_WORDS = ['playing under the threshold', 'playing right at the threshold', 'digging in, well over the threshold'];

export function eqSpec(data, st = EQ_DEFAULT) {
  const e = data.eq;
  const [ki, kw] = locate(e.knob, st.knob);
  const pick = (k) => e.db[k][st.shift];
  const db = pick(ki).map((v, i) => v * (1 - kw) + pick(ki + 1)[i] * kw);
  return {
    spec: {
      title: `EQ response, knob ${st.knob.toFixed(2)}, ${SHIFT_WORDS[st.shift]}`,
      height: 280,
      x: { domain: [20, 20000], type: 'log', ticks: [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000], ticksNarrow: [20, 100, 1000, 10000], fmt: 'hz', label: 'frequency (Hz)' },
      y: { domain: [-24, 6], ticks: [-24, -18, -12, -6, 0, 6], fmt: 'db', label: 'level (dB)' },
      rules: [{ y: 0, label: '' }],
      series: [{ id: 'eq', label: 'response', role: 'accent', points: e.hz.map((h, i) => [h, db[i]]), area: 'below' }],
    },
    readout: `EQ knob ${st.knob.toFixed(2)}, ${SHIFT_WORDS[st.shift]}: ${eqWords(e.hz, db)}.`,
  };
}

/* ----------------------------------------------------------------- swell */

export const SWELL_DEFAULT = { profile: 'synth' };

export function swellSpec(data, st = SWELL_DEFAULT) {
  const sw = data.profiles[st.profile].swell;
  const t = (i) => i * sw.hop;
  const retrig = data.profiles[st.profile].swellRetrigger;
  return {
    spec: {
      title: `Swell on, ${st.profile} profile: input and output envelopes`,
      height: 260,
      x: { domain: [0, (sw.in.length - 1) * sw.hop], ticks: [0, 1, 2, 3, 4], fmt: 's', label: 'time' },
      y: { domain: [0, 0.6], ticks: [0, 0.2, 0.4, 0.6], fmt: 'amp', label: 'level' },
      series: [
        { id: 'in', label: 'into Minty', role: 'context', points: sw.in.map((v, i) => [t(i), v]), area: 'below' },
        { id: 'out', label: 'out, with the swell', role: 'accent', points: sw.out.map((v, i) => [t(i), v]) },
      ],
      legend: [{ role: 'accent', label: 'out of Minty, swell on' }, { role: 'context', label: 'into Minty' }],
    },
    readout: retrig
      ? 'Guitar profile: every fresh attack re-triggers the swell, so a fast line keeps ducking and never fully opens.'
      : 'Synth profile: the swell opens once for the phrase and stays open through the notes, then fades out across the rest.',
  };
}

/* ---------------------------------------------------------------- listen */

export const LISTEN_DEFAULT = { render: '02_squash_noon' };

export function listenSpec(data, st = LISTEN_DEFAULT) {
  const dry = data.renders.find((r) => r.id === '00_dry');
  const wet = data.renders.find((r) => r.id === st.render) || data.renders[1];
  const hop = 960 / 48000;
  const pts = (env) => env.map((v, i) => [i * hop, v]);
  return {
    spec: {
      title: `Waveform outline, dry against ${wet.label}`,
      height: 200,
      x: { domain: [0, dry.seconds], ticks: [0, 3, 6, 9], fmt: 's' },
      y: { domain: [-1, 1], ticks: [-1, 0, 1], fmt: 'amp' },
      series: [
        { id: 'dry', label: 'dry', role: 'context', points: pts(dry.envelope), area: 'mirror' },
        { id: 'wet', label: wet.label, role: 'accent', points: pts(wet.envelope), area: 'mirror' },
      ],
      legend: [{ role: 'accent', label: `${wet.label}` }, { role: 'context', label: 'dry' }],
    },
    readout: wet.id === '00_dry' ? '' : `${wet.label}: SENSITIVITY ${wet.sens}, DYNAMICS ${wet.dyn}, EQ ${wet.eq}, ${wet.character}${wet.swell ? ', swell on' : ''}. ${dbSign(wet.rmsDb - dry.rmsDb)} dB against dry.`,
  };
}

/* ------------------------------------------------------------ bass THD */

/** Guitar against synth tuning, harmonic distortion on low sines at DYNAMICS noon. */
export function thdSpec(data) {
  const col = (t) => t.dyns.findIndex((d) => Math.abs(d - 0.5) < 1e-6);
  const g = data.thd.guitar;
  const s = data.thd.synth;
  const rows = s.rows.map((r, i) => ({ hz: r.hz, synth: r.pct[col(s)], guitar: g.rows[i].pct[col(g)] }));
  const max = Math.max(...rows.map((r) => Math.max(r.synth, r.guitar)));
  const top = Math.ceil(max * 10) / 10;
  return {
    rows,
    spec: {
      title: 'Bass harmonic distortion at DYNAMICS noon, guitar profile against synth profile',
      height: 60 + rows.length * 44,
      x: { domain: [0, top], ticks: range(0, top, top > 0.2 ? 0.1 : 0.05), fmt: 'pct', label: 'harmonic distortion (%), lower is cleaner' },
      y: { domain: [rows.length - 0.4, -0.6], ticks: rows.map((_, i) => i), labels: rows.map((r) => `${r.hz} Hz`), fmt: 'row' },
      series: rows.map((r, i) => ({ id: `link-${r.hz}`, label: '', role: 'context', points: [[r.guitar, i], [r.synth, i]] })),
      dots: rows.flatMap((r, i) => [
        { x: r.guitar, y: i, role: 'context', tip: `${r.hz} Hz, guitar profile: ${r.guitar}%` },
        { x: r.synth, y: i, role: 'accent', tip: `${r.hz} Hz, synth profile: ${r.synth}%` },
      ]),
      legend: [{ role: 'accent', label: 'synth profile', mark: 'dot' }, { role: 'context', label: 'guitar profile', mark: 'dot' }],
    },
  };
}

/* ---------------------------------------------------------------- pedal */

export const PEDAL_DEFAULT = { sens: 0.5, dyn: 0.35, eq: 0.5, level: -12, character: 0, swell: false };
export const CHARACTERS = ['Stable', 'Wobble', 'Twitchy', 'Dusty'];

/**
 * The LED, as PatchImpl.cpp decides it: colour is the mode, brightness is
 * whether the meter reads more than 3 dB. The names are the SDK's colour
 * names; the swatches are my approximations of them.
 */
export const LED = {
  Stable: { idle: ['dim green', '#2f5d43'], busy: ['pastel green (mint)', '#9ef0c6'] },
  Wobble: { idle: ['dim cyan', '#245966'], busy: ['light blue', '#a6d8ff'] },
  Twitchy: { idle: ['dim yellow', '#5e5a22'], busy: ['light yellow', '#fff3a3'] },
  Dusty: { idle: ['dim white', '#6b6a66'], busy: ['beige', '#efdfbf'] },
  Swell: { idle: ['dark cobalt', '#1f2f63'], busy: ['blue', '#4d7dff'] },
};

export function pedalState(data, st = PEDAL_DEFAULT) {
  const p = data.profiles.synth;
  const c = p.curves;
  const meter = curveAt(c, st.sens, st.dyn, 'meter');
  const gr = valueAt(c.levels, meter, Math.max(-60, Math.min(0, st.level)));
  const busy = gr > 3;
  const mode = st.swell ? 'Swell' : CHARACTERS[st.character];
  const [name, hex] = LED[mode][busy ? 'busy' : 'idle'];
  const thr = thresholdFor(p, st.sens);
  const e = data.eq;
  const [ki, kw] = locate(e.knob, st.eq);
  const db = e.db[ki][0].map((v, i) => v * (1 - kw) + e.db[ki + 1][0][i] * kw);
  return {
    led: { name, hex, busy, mode },
    gr,
    lines: [
      ['SENSITIVITY', `threshold ${FORMATS.db(thr)} dBFS${CHARACTERS[st.character] === 'Dusty' ? ', and the Dusty drive' : ''}`],
      ['DYNAMICS', `${dynamicsZone(st.dyn)}, ${slopeWords(slopeAbove(c, p, st.sens, st.dyn))}`],
      ['EQ', eqWords(e.hz, db)],
      ['Footswitch', `${CHARACTERS[st.character]}, swell ${st.swell ? 'on' : 'off'}`],
      ['LED', `${name}: ${busy ? `compressing, about ${Math.round(gr)} dB` : `${gr > 0.5 ? `only ${Math.round(gr * 10) / 10} dB of` : 'no'} gain reduction`}`],
    ],
  };
}

