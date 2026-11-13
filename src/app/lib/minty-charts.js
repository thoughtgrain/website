/**
 * minty-charts.js: line charts as SVG markup, for the Minty pages.
 *
 * One function, used twice. The server render calls it at a default width so
 * the page arrives with every chart already drawn; the same component calls
 * it again in the browser at the chart's real width, and whenever a knob
 * moves (components/minty/parts.jsx). Same code both times, so the static
 * chart and the live one can't disagree.
 *
 * Pure: a spec in, a string of SVG out, no DOM. Every label passes through
 * esc(), so nothing in a spec is ever interpreted as markup.
 *
 * Marks follow the site's chart rules: 2px lines with round ends, a 10% wash
 * under an area, hairline solid gridlines one step off the surface, at most
 * one accent series, everything else in the context grey, and direct labels
 * only where a line ends. Colour comes from CSS (.mc-accent / .mc-context),
 * so dark mode is the stylesheet's job, not this file's.
 */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A linear or log scale from a domain onto a pixel range. */
export function scale([d0, d1], [r0, r1], type = 'lin') {
  if (type === 'log') {
    const l0 = Math.log10(d0);
    const l1 = Math.log10(d1);
    const f = (v) => r0 + ((Math.log10(Math.max(v, 1e-9)) - l0) / (l1 - l0)) * (r1 - r0);
    f.invert = (p) => 10 ** (l0 + ((p - r0) / (r1 - r0)) * (l1 - l0));
    return f;
  }
  const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
  f.invert = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
  return f;
}

/** Frequencies the way people say them: 50, 500, 2k, 20k. */
export const hzLabel = (v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k`.replace('.0k', 'k') : `${Math.round(v)}`);
// Prose wants the unit spelled properly: "1.3 kHz", "600 Hz". Axis ticks keep the short form.
const hzWords = (v) => (v >= 1000 ? `${hzLabel(v).replace('k', '')} kHz` : `${Math.round(v)} Hz`);

const fmt = (v) => (Math.round(v * 100) / 100).toString().replace('-', '−');

/**
 * @param {object} spec
 *   width, height            pixels
 *   x, y                     { domain: [a, b], type?: 'lin'|'log', ticks: [], format?: fn, label?: string }
 *   series                   [{ id, label, role: 'accent'|'context', points: [[x, y]], area?: 'below'|'mirror', end?: bool }]
 *   bands?                   [{ x0, x1, label }]   shaded spans along x, labelled at the top
 *   rules?                   [{ x?, y?, label }]   a reference line, horizontal or vertical
 *   dots?                    [{ x, y, role }]      markers, 8px with a surface ring
 *   title                    accessible name for the SVG
 */
export function lineChart(spec) {
  const W = Math.max(240, Math.round(spec.width || 640));
  const H = Math.round(spec.height || 300);
  const narrow = W < 420;
  // Labels are set in the mono face, so their width is predictable from their
  // length. End labels get exactly the room they need instead of a guess that
  // clips "dry, 1:1" on a phone.
  const textW = (s, px) => String(s).length * px * 0.6;
  const ends = spec.series.filter((s) => s.end).map((s) => textW(s.label, 12));
  const m = { top: spec.bands ? 26 : 12, right: ends.length ? Math.ceil(Math.max(...ends) + 16) : 14, bottom: spec.x.label ? 44 : 28, left: spec.y.labels ? 64 : spec.y.label ? 52 : 40 };
  const x = scale(spec.x.domain, [m.left, W - m.right], spec.x.type);
  const y = scale(spec.y.domain, [H - m.bottom, m.top], spec.y.type);
  const fx = spec.x.format || fmt;
  // Category rows (the THD dumbbell) name their ticks instead of numbering them.
  const fy = spec.y.labels ? (t) => spec.y.labels[t] ?? '' : (spec.y.format || fmt);
  const xTicks = narrow && spec.x.ticksNarrow ? spec.x.ticksNarrow : spec.x.ticks;
  const out = [];

  out.push(`<svg class="mchart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.title || '')}">`);

  // Bands first, so everything else sits on top of them.
  for (const b of spec.bands || []) {
    const x0 = x(b.x0);
    const x1 = x(b.x1);
    out.push(`<rect class="mband${b.strong ? ' mband--strong' : ''}" x="${x0.toFixed(1)}" y="${m.top}" width="${Math.max(0, x1 - x0).toFixed(1)}" height="${H - m.top - m.bottom}"/>`);
    out.push(`<text class="mband__label" x="${((x0 + x1) / 2).toFixed(1)}" y="${m.top - 8}" text-anchor="middle">${esc(b.label)}</text>`);
  }

  // Grid and axes.
  for (const t of spec.y.ticks) {
    const py = y(t).toFixed(1);
    out.push(`<line class="mgrid" x1="${m.left}" x2="${W - m.right}" y1="${py}" y2="${py}"/>`);
    out.push(`<text class="mtick" x="${m.left - 8}" y="${py}" text-anchor="end" dominant-baseline="middle">${esc(fy(t))}</text>`);
  }
  for (const t of xTicks) {
    const px = x(t).toFixed(1);
    out.push(`<line class="mgrid" x1="${px}" x2="${px}" y1="${m.top}" y2="${H - m.bottom}"/>`);
    out.push(`<text class="mtick" x="${px}" y="${H - m.bottom + 16}" text-anchor="middle">${esc(fx(t))}</text>`);
  }
  if (spec.x.label) out.push(`<text class="maxis" x="${((m.left + W - m.right) / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(spec.x.label)}</text>`);
  if (spec.y.label) out.push(`<text class="maxis" x="12" y="${((m.top + H - m.bottom) / 2).toFixed(1)}" text-anchor="middle" transform="rotate(-90 12 ${((m.top + H - m.bottom) / 2).toFixed(1)})">${esc(spec.y.label)}</text>`);

  // Reference rules.
  for (const r of spec.rules || []) {
    if (r.x != null) {
      const px = x(r.x).toFixed(1);
      out.push(`<line class="mrule" x1="${px}" x2="${px}" y1="${m.top}" y2="${H - m.bottom}"/>`);
      if (r.label) {
        // Flip to the left of the line when the label would run off the plot.
        const flip = Number(px) + 6 + textW(r.label, 11) > W - m.right;
        out.push(`<text class="mrule__label" x="${(Number(px) + (flip ? -6 : 6)).toFixed(1)}" y="${m.top + 12}"${flip ? ' text-anchor="end"' : ''}>${esc(r.label)}</text>`);
      }
    } else if (r.y != null) {
      const py = y(r.y).toFixed(1);
      out.push(`<line class="mrule" x1="${m.left}" x2="${W - m.right}" y1="${py}" y2="${py}"/>`);
      if (r.label) out.push(`<text class="mrule__label" x="${m.left + 6}" y="${(Number(py) - 6).toFixed(1)}">${esc(r.label)}</text>`);
    }
  }

  // Context series first, then the accent, so the accent is never covered.
  const ordered = [...spec.series].sort((a, b) => (a.role === 'accent') - (b.role === 'accent'));
  const yLo = Math.min(...spec.y.domain);
  const yHi = Math.max(...spec.y.domain);
  const clampY = (v) => Math.max(yLo, Math.min(yHi, v));
  for (const s of ordered) {
    const pts = s.points.filter(([px, py]) => Number.isFinite(px) && Number.isFinite(py));
    if (!pts.length) continue;
    const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${x(px).toFixed(1)} ${y(clampY(py)).toFixed(1)}`).join('');
    const cls = `mc-${s.role || 'context'}`;
    if (s.area === 'below') {
      const base = y(spec.y.domain[0]).toFixed(1);
      out.push(`<path class="marea ${cls}" d="${line}L${x(pts[pts.length - 1][0]).toFixed(1)} ${base}L${x(pts[0][0]).toFixed(1)} ${base}Z"/>`);
    } else if (s.area === 'mirror') {
      const back = [...pts].reverse().map(([px, py]) => `L${x(px).toFixed(1)} ${y(clampY(-py)).toFixed(1)}`).join('');
      out.push(`<path class="marea marea--mirror ${cls}" d="${line}${back}Z"/>`);
      continue;
    }
    out.push(`<path class="mline ${cls}" d="${line}"/>`);
    if (s.end) {
      const [ex, ey] = pts[pts.length - 1];
      out.push(`<circle class="mdot ${cls}" cx="${x(ex).toFixed(1)}" cy="${y(clampY(ey)).toFixed(1)}" r="4"/>`);
      out.push(`<text class="mend" x="${(x(ex) + 8).toFixed(1)}" y="${y(clampY(ey)).toFixed(1)}" dominant-baseline="middle">${esc(s.label)}</text>`);
    }
  }
  for (const d of spec.dots || []) {
    const tip = d.tip ? ` tabindex="0" role="img" aria-label="${esc(d.tip)}" data-tip="${esc(d.tip)}"` : '';
    out.push(`<circle class="mdot mc-${d.role || 'accent'}" cx="${x(d.x).toFixed(1)}" cy="${y(clampY(d.y)).toFixed(1)}" r="5"${tip}/>`);
  }

  // A transparent plot-sized target, so the pointer is over the chart
  // anywhere inside the axes, not only on a line. The crosshair itself is
  // drawn by the component, in an overlay React owns.
  out.push(`<rect class="mhit" x="${m.left}" y="${m.top}" width="${W - m.left - m.right}" height="${H - m.top - m.bottom}" fill="transparent"/>`);
  out.push('</svg>');
  return { svg: out.join(''), frame: { W, H, m } };
}

/* -------------------------------------------------------------- helpers */

/** Linear interpolation into a sorted grid: index and weight for value v. */
export function locate(grid, v) {
  if (v <= grid[0]) return [0, 0];
  if (v >= grid[grid.length - 1]) return [grid.length - 2, 1];
  let i = 0;
  while (grid[i + 1] < v) i += 1;
  return [i, (v - grid[i]) / (grid[i + 1] - grid[i])];
}

/** A measured curve for any knob position, blended from the four nearest measured ones. */
export function curveAt(curves, sens, dyn, field = 'out') {
  const [si, sw] = locate(curves.sens, sens);
  const [di, dw] = locate(curves.dyn, dyn);
  const g = curves[field];
  return curves.levels.map((_, li) => {
    const a = g[si][di][li] * (1 - dw) + g[si][di + 1][li] * dw;
    const b = g[si + 1][di][li] * (1 - dw) + g[si + 1][di + 1][li] * dw;
    return a * (1 - sw) + b * sw;
  });
}

/** The value of a sampled series at x, interpolated. */
export function valueAt(xs, ys, v) {
  const [i, w] = locate(xs, v);
  return ys[i] * (1 - w) + ys[i + 1] * w;
}

/** Threshold for a SENSITIVITY setting on a profile, as Minty maps it. */
export const thresholdFor = (profile, sens) => profile.thresholdAtMinDb + (profile.thresholdAtMaxDb - profile.thresholdAtMinDb) * sens;

/** What DYNAMICS is doing at a setting, in Minty's own three regions. */
export function dynamicsZone(dyn) {
  if (dyn < 0.5) return 'compression';
  if (dyn < 0.8) return 'limiting';
  return 'sag';
}

/**
 * Slope of the measured curve above threshold, from 12 dB over it, the way
 * the test bench reports it (output change per dB of input).
 */
export function slopeAbove(curves, profile, sens, dyn) {
  const outs = curveAt(curves, sens, dyn);
  const thr = thresholdFor(profile, sens);
  const a = Math.min(0, thr + 6);
  const b = Math.min(0, thr + 18);
  if (b - a < 3) return null;
  return (valueAt(curves.levels, outs, b) - valueAt(curves.levels, outs, a)) / (b - a);
}

/** "about 3:1", "limiting", "louder gets quieter": a slope in words. */
export function slopeWords(slope) {
  if (slope == null) return 'threshold at the top of the range';
  if (slope < -0.05) return 'louder gets quieter';
  if (slope < 0.08) return 'flat: everything above lands at one level';
  if (slope > 0.95) return 'no compression, 1:1';
  const r = 1 / slope;
  return `about ${r < 10 ? Math.round(r * 10) / 10 : Math.round(r)}:1`;
}

/**
 * The two corners of a response: where it falls 3 dB below its own peak,
 * walking outward from the peak in each direction. Null when it never does
 * inside the measured range (an open filter).
 */
export function corners(hz, db) {
  let pk = 0;
  db.forEach((v, i) => { if (v > db[pk]) pk = i; });
  const ref = db[pk] - 3;
  const at = (i, j) => hz[i] + ((hz[j] - hz[i]) * (ref - db[i])) / (db[j] - db[i]);
  let lp = null;
  let hp = null;
  for (let i = pk; i < db.length - 1; i += 1) if (db[i + 1] < ref) { lp = at(i, i + 1); break; }
  for (let i = pk; i > 0; i -= 1) if (db[i - 1] < ref) { hp = at(i - 1, i); break; }
  return { lp, hp };
}

/** The EQ knob in words, from its measured response. */
export function eqWords(hz, db) {
  const { lp, hp } = corners(hz, db);
  if (lp && lp < 15000) return `darker: the highs roll off above about ${hzWords(lp)}`;
  if (hp && hp > 40) return `thinner: the lows roll off below about ${hzWords(hp)}`;
  return 'flat, full range';
}
