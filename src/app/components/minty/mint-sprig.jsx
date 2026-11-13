/**
 * mint-sprig.jsx: the artwork on Minty's face, a sprig of three mint leaves.
 *
 * Flat green leaves with saw-toothed edges, the veins cut out in the face
 * colour, and a thin gap of face colour wherever one leaf overlaps another.
 * Each leaf comes from one function, so all three share a shape and the
 * markup stays small. Everything is computed at render time into plain path
 * strings; nothing here runs in the browser.
 *
 * A leaf is built in its own coordinates: base at the origin, tip at (0, -L),
 * half-width W at its widest. Then it's moved, turned and stacked.
 */

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Half-width along the leaf, t^a (1 - t)^b: a < 1 rounds the base, b > 1
 * draws the tip out to a point, and the widest part lands at a / (a + b),
 * about a third of the way up, which is where a mint leaf is widest.
 */
const SHAPE_A = 0.66;
const SHAPE_B = 1.1;
const SHAPE_AT = SHAPE_A / (SHAPE_A + SHAPE_B);
const SHAPE_PEAK = SHAPE_AT ** SHAPE_A * (1 - SHAPE_AT) ** SHAPE_B;
const halfWidth = (W, t) => (W * t ** SHAPE_A * (1 - t) ** SHAPE_B) / SHAPE_PEAK;

/**
 * The right-hand edge from base to tip as [x, t] pairs, where t runs 0 to 1
 * up the leaf. Each tooth bows outward from a notch and hooks forward
 * toward the tip, which is what makes it read as mint rather than holly.
 */
function edge(W, teeth) {
  const t0 = 0.08;
  // The teeth stop short of the tip; the last stretch is a clean point.
  const t1 = 0.82;
  const pts = [[halfWidth(W, t0) * 0.84, t0]];
  for (let i = 0; i < teeth; i++) {
    const a = t0 + ((t1 - t0) * i) / teeth;
    const b = t0 + ((t1 - t0) * (i + 1)) / teeth;
    for (const f of [0.3, 0.6, 0.85]) {
      const t = a + (b - a) * f;
      pts.push([halfWidth(W, t) * (0.84 + 0.22 * Math.sqrt(f)), t]);
    }
    pts.push([halfWidth(W, b) * 1.09, b + (b - a) * 0.28]); // the tooth's point, pushed forward
    pts.push([halfWidth(W, b) * 0.84, b]); // the notch
  }
  for (const t of [0.86, 0.9, 0.94, 0.97]) pts.push([halfWidth(W, t) * 0.9, t]);
  return pts;
}

function leafOutline(L, W, teeth) {
  const right = edge(W, teeth);
  const p = ([x, t]) => `${r1(x)} ${r1(-t * L)}`;
  const up = right.map(p).join('L');
  const down = [...right].reverse().map(([x, t]) => p([-x, t])).join('L');
  return `M0 0L${up}L0 ${-L}L${down}Z`;
}

/** The midrib and side veins, as strokes in the face colour. */
function leafVeins(L, W) {
  const veins = [`M0 ${r1(-0.03 * L)}Q${r1(W * 0.1)} ${r1(-0.45 * L)} 0 ${r1(-0.86 * L)}`];
  // Side veins leave the midrib at a shallow angle and sweep up toward the
  // tip, running nearly parallel to the edge by the time they fade.
  [0.14, 0.29, 0.44, 0.59].forEach((t) => {
    const end = t + 0.27;
    const ex = halfWidth(W, end) * 0.72;
    for (const s of [1, -1]) {
      veins.push(`M${r1(W * 0.04 * (1 - t))} ${r1(-t * L)}Q${r1(s * ex * 0.95)} ${r1(-(t + 0.07) * L)} ${r1(s * ex)} ${r1(-end * L)}`);
    }
  });
  return veins;
}

// Back to front. The front leaf is the largest and sits lowest, with the
// stem running out of it, as it does on a real sprig. The other two grow
// from behind it.
const LEAVES = [
  { x: 156, y: 264, angle: 22, L: 140, W: 42, teeth: 13 },
  { x: 148, y: 270, angle: -47, L: 128, W: 40, teeth: 13 },
  { x: 140, y: 290, angle: 45, L: 150, W: 46, teeth: 14 },
];

/**
 * The sprig, drawn into the face. `face` is the face colour, used for the
 * veins and the gaps between leaves so they read as cut out of the green.
 */
export function MintSprig({ face, leaf = '#4f9a58', clip }) {
  return (
    <g clipPath={clip} className="mpedal__sprig">
      {/* The stem the leaves grow from, running off the bottom of the face. */}
      <path d="M142 288C137 296 132 304 125 316" fill="none" stroke={leaf} strokeWidth="5" strokeLinecap="round" />
      {LEAVES.map((l) => (
        <g key={l.angle} transform={`translate(${l.x} ${l.y}) rotate(${l.angle})`}>
          <path d={leafOutline(l.L, l.W, l.teeth)} fill={leaf} stroke={face} strokeWidth="3.2" strokeLinejoin="round" paintOrder="stroke" />
          <g fill="none" stroke={face} strokeLinecap="round">
            {leafVeins(l.L, l.W).map((d, i) => <path key={i} d={d} strokeWidth={i === 0 ? 3 : 1.8} />)}
          </g>
        </g>
      ))}
    </g>
  );
}
