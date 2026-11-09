/**
 * parts.jsx: the pieces every Minty figure is built from.
 *
 * Frame is the figure around a chart: controls, legend, the sentence under
 * it, a live region, the numbers, the caption. Chart is the chart itself,
 * drawn by lineChart() (the same function, server and browser) and given its
 * hover layer: a crosshair that snaps to the nearest measured point with
 * every series' value in a tooltip, the same reading from the keyboard with
 * the arrow keys, and tooltips on markers that carry their own (the THD
 * dumbbell).
 *
 * The chart arrives from lineChart() as an SVG string it has already escaped,
 * so it goes in through Html. Anything that moves on top of it (the
 * crosshair, Listen's playhead) is drawn in a second SVG laid over the first,
 * which React owns, so nothing reaches into the string's markup by hand.
 */

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import Html from '../Html';
import { lineChart, scale } from '../../lib/minty-charts.js';

export function Missing() {
  return <p className="mfig__missing">The measurements behind this figure are added when the site is built.</p>;
}

export function Legend({ items = [] }) {
  if (!items || items.length < 2) return <div className="mfig__legend" data-legend="" />;
  return (
    <ul className="mfig__legend" data-legend="">
      {items.map((it) => (
        <li key={it.label}><span className={`mkey mkey--${it.mark || 'line'} mc-${it.role}`} aria-hidden="true" />{it.label}</li>
      ))}
    </ul>
  );
}

export function Table({ table }) {
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

const twoPlaces = (v) => Number(v).toFixed(2);

export function Range({ k, label, value, min = 0, max = 1, step = 0.01, format = twoPlaces, onChange }) {
  return (
    <label className="mrange">
      <span className="mrange__label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} data-key={k} onChange={(e) => onChange(Number(e.target.value))} />
      <output className="mrange__out" data-out={k}>{format(value)}</output>
    </label>
  );
}

export function Seg({ k, label, value, options, onSelect }) {
  return (
    <div className="mseg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v} type="button" className="mseg__btn" data-key={k} data-value={v}
          aria-pressed={String(v) === String(value) ? 'true' : 'false'}
          onClick={() => onSelect(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/**
 * The figure around a chart. `controls` render hidden until the figure is
 * live, so a reader without JavaScript isn't shown knobs that do nothing.
 */
export function Frame({ kind, live, controls, legend, readout, said, table, caption, children, after }) {
  return (
    <figure className={`mfig mfig--${kind}${live ? ' is-live' : ''}`} data-mfig={kind}>
      {controls && <div className="mfig__controls" data-controls="" hidden={!live}>{controls}</div>}
      {children}
      <Legend items={legend} />
      {readout != null && readout !== '' && <p className="mfig__readout" data-readout="">{readout}</p>}
      <p className="visually-hidden" aria-live="polite" data-say="">{said}</p>
      <Table table={table} />
      {after}
      {caption && <figcaption className="mfig__cap">{caption}</figcaption>}
    </figure>
  );
}

/* ------------------------------------------------------------------ chart */

function interpolate(points, xv) {
  if (xv <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] >= xv) {
      const a = points[i - 1];
      const b = points[i];
      return b[0] === a[0] ? b[1] : a[1] + ((b[1] - a[1]) * (xv - a[0])) / (b[0] - a[0]);
    }
  }
  return points[points.length - 1][1];
}

const mainSeries = (spec) => spec.series.find((s) => s.role === 'accent') || spec.series[0];
const xScale = (spec, frame) => scale(spec.x.domain, [frame.m.left, frame.W - frame.m.right], spec.x.type);

/** Every series' value at the measured x nearest to px, for the tooltip. */
function readAt(spec, frame, px) {
  const main = mainSeries(spec);
  if (!main || !main.points.length) return null;
  const x = xScale(spec, frame);
  const y = scale(spec.y.domain, [frame.H - frame.m.bottom, frame.m.top], spec.y.type);
  const target = x.invert(px);
  let best = 0;
  main.points.forEach((p, i) => {
    if (Math.abs(p[0] - target) < Math.abs(main.points[best][0] - target)) best = i;
  });
  const xv = main.points[best][0];
  const yLo = Math.min(...spec.y.domain);
  const yHi = Math.max(...spec.y.domain);
  // Every series is read at the same x, interpolated between its own points:
  // a straight reference line has only two of them.
  const rows = spec.series
    .filter((s) => s.label && !s.id.startsWith('link-'))
    .map((s) => ({ role: s.role, label: s.label, value: interpolate(s.points, xv) }));
  return { index: best, xv, px: x(xv), py: y(Math.max(yLo, Math.min(yHi, main.points[best][1]))), rows };
}

const headOf = (spec, xv) => spec.x.format(xv) + (spec.x.label ? ` ${spec.x.label.replace(/\s*\(.*\)/, '')}` : '');

/**
 * A chart, with its hover and keyboard reading once live.
 *
 *   spec      a resolved spec (withFormats) at the width to draw
 *   hover     false for charts that are read another way (Listen's waveform)
 *   onSay     announce text in the figure's live region
 *   onSeek    optional: (x value) on click, for Listen
 *   overlay   optional: (frame, x scale) => SVG children drawn over the chart
 */
export function Chart({ spec, live, boxRef, hover = true, onSay, onSeek, overlay }) {
  const res = useMemo(() => lineChart(spec), [spec]);
  const tipRef = useRef(null);
  const keyIndex = useRef(null);
  const [tip, setTip] = useState(null);
  const { frame } = res;
  const reading = live && hover;

  // Place the tooltip once it has rendered and its width is known: beside
  // the pointer, flipped to the other side when it would run off the chart.
  useLayoutEffect(() => {
    const el = tipRef.current;
    const box = boxRef.current;
    if (!tip || !el || !box) return;
    const b = box.getBoundingClientRect();
    let left;
    let top;
    if (tip.kind === 'mark') {
      left = Math.min(b.width - el.offsetWidth, tip.rect.right - b.left + 8);
      top = tip.rect.top - b.top - 6;
    } else {
      left = (tip.clientX != null ? tip.clientX - b.left : tip.hit.px) + 14;
      top = (tip.clientY != null ? tip.clientY - b.top : tip.hit.py) - 10;
      if (left + el.offsetWidth > b.width) left -= el.offsetWidth + 28;
    }
    el.style.left = `${Math.max(0, left)}px`;
    el.style.top = `${Math.max(0, top)}px`;
  }, [tip, boxRef]);

  const pxFromEvent = (e) => {
    const r = boxRef.current.getBoundingClientRect();
    return (e.clientX - r.left) * (frame.W / r.width);
  };

  const handlers = !reading ? {} : {
    tabIndex: 0,
    role: 'group',
    'aria-label': 'Chart. Use the left and right arrow keys to read values.',
    onPointerMove: (e) => {
      if (e.target.hasAttribute && e.target.hasAttribute('data-tip')) return;
      const px = pxFromEvent(e);
      if (px < frame.m.left || px > frame.W - frame.m.right) { setTip(null); return; }
      const hit = readAt(spec, frame, px);
      setTip(hit ? { kind: 'hit', hit, clientX: e.clientX, clientY: e.clientY } : null);
    },
    onPointerLeave: () => setTip(null),
    onKeyDown: (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const main = mainSeries(spec);
      if (!main) return;
      e.preventDefault();
      const n = main.points.length;
      const step = Math.max(1, Math.round(n / 40));
      keyIndex.current = keyIndex.current == null
        ? 0
        : Math.max(0, Math.min(n - 1, keyIndex.current + (e.key === 'ArrowRight' ? step : -step)));
      const hit = readAt(spec, frame, xScale(spec, frame)(main.points[keyIndex.current][0]));
      if (!hit) return;
      setTip({ kind: 'hit', hit });
      if (onSay) onSay(`${spec.x.format(hit.xv)}: ${hit.rows.map((r) => `${r.label} ${spec.y.format(r.value)}`).join(', ')}`);
    },
    onBlur: () => { setTip(null); keyIndex.current = null; },
    // Markers that carry their own tooltip.
    onPointerOver: (e) => markTip(e, false),
    onFocus: (e) => markTip(e, true),
  };

  function markTip(e, focused) {
    const t = e.target;
    if (!t.hasAttribute || !t.hasAttribute('data-tip')) return;
    const text = t.getAttribute('data-tip');
    setTip({ kind: 'mark', text, rect: t.getBoundingClientRect() });
    if (focused && onSay) onSay(text);
  }

  const seek = live && onSeek ? {
    onClick: (e) => {
      const t = xScale(spec, frame).invert(pxFromEvent(e));
      onSeek(Math.max(spec.x.domain[0], Math.min(spec.x.domain[1], t)));
    },
  } : {};

  const drawn = overlay ? overlay(frame, xScale(spec, frame)) : null;
  const cross = tip && tip.kind === 'hit' ? tip.hit.px : null;

  return (
    <div className="mfig__chart" data-chart="" ref={boxRef} {...handlers} {...seek}>
      <Html className="mfig__svg" html={res.svg} />
      {(cross != null || drawn) && (
        <svg className="mfig__overlay" viewBox={`0 0 ${frame.W} ${frame.H}`} aria-hidden="true" focusable="false">
          {cross != null && <line className="mcross" x1={cross} x2={cross} y1={frame.m.top} y2={frame.H - frame.m.bottom} />}
          {drawn}
        </svg>
      )}
      {tip && (
        <div className="mtip" data-tip-box="" ref={tipRef}>
          {tip.kind === 'mark' ? tip.text : (
            <>
              <p className="mtip__head">{headOf(spec, tip.hit.xv)}</p>
              {tip.hit.rows.map((r) => (
                <p className="mtip__row" key={r.label}>
                  <span className={`mkey mkey--line mc-${r.role}`} />
                  <b>{spec.y.format(r.value)}</b>
                  {` ${r.label}`}
                </p>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
