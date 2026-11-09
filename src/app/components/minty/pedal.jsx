/**
 * pedal.jsx: the Endless running Minty, drawn to scale.
 *
 * Proportions are measured from a front-on photo of the pedal: the white
 * enclosure, the mint face (with a sprig of mint in place of the rings), three knobs, the LED top right,
 * and two footswitches. The left one (*) is the patch's: the SDK sends Minty
 * its press and its hold. The right one (On) is the Endless's own bypass.
 *
 * The drawing is only the picture. The controls are real HTML elements laid
 * over it, one per knob and switch, positioned in percentages of the same
 * viewBox so they track the drawing at any width:
 *
 *   knob    <input type="range">, made transparent; its focus ring is drawn
 *           on the grip beside it, which also takes the pointer for dragging
 *   switch  <button>, transparent, round, with its own focus ring
 *
 * Native elements mean the keyboard, screen readers (VoiceOver's swipe to
 * adjust included), forced colours and focus all behave as they do anywhere
 * else, with nothing reimplemented. The layer stays hidden until the pedal is
 * hydrated as an island, so without the script the drawing is a still image.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PEDAL_DEFAULT, pedalState } from '../../lib/minty-specs.js';
import { useAnnouncer, useLive, useMinty } from './hooks';
import { MintSprig } from './mint-sprig';
import { Range } from './parts';

// The viewBox leaves room for the jacks that stick out of each side.
const VB = { x: -10, y: -8, w: 306, h: 478 };
const BODY = { w: 286, h: 460, r: 22 };
const PANEL = { x: 10, y: 49, w: 266, h: 255, r: 12 };
const KNOB_Y = 94;
const KNOB_R = 26.5;
const KNOBS = [
  { k: 'sens', name: 'Sensitivity', cx: 55 },
  { k: 'dyn', name: 'Dynamics', cx: 143 },
  { k: 'eq', name: 'EQ', cx: 231 },
];
const SWITCH_Y = 393;
const SWITCHES = { left: { cx: 55, label: '*' }, on: { cx: 231, label: 'On' } };
const LED_AT = { cx: 231, cy: 24 };
const FACE = '#c6ece6';

/** A knob turns 270 degrees, from seven o'clock to five o'clock. */
const angle = (v) => -135 + 270 * v;
const pct = (n) => `${(n * 100).toFixed(3)}%`;
/** A square hit area of half-size `h`, centred on a point, in viewBox percentages. */
const box = (cx, cy, h) => ({
  left: pct((cx - h - VB.x) / VB.w), top: pct((cy - h - VB.y) / VB.h),
  width: pct((2 * h) / VB.w), height: pct((2 * h) / VB.h),
});

function Defs({ id }) {
  return (
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fbfbfa" />
        <stop offset="1" stopColor="#eceae6" />
      </linearGradient>
      <radialGradient id={`${id}-knob`} cx="0.42" cy="0.36" r="0.7">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.7" stopColor="#f3f4f2" />
        <stop offset="1" stopColor="#dfe3e1" />
      </radialGradient>
      {/* Chrome is reflection, not shading: hard bands of bright sky and
          dark horizon, mirrored on the far side of the collar so its two
          bevels catch the light from opposite edges. */}
      <linearGradient id={`${id}-collar`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fdfdfd" />
        <stop offset="0.18" stopColor="#c6cacf" />
        <stop offset="0.34" stopColor="#767b80" />
        <stop offset="0.48" stopColor="#eef0f2" />
        <stop offset="0.6" stopColor="#fafbfc" />
        <stop offset="0.76" stopColor="#666b70" />
        <stop offset="0.9" stopColor="#adb2b7" />
        <stop offset="1" stopColor="#e4e7ea" />
      </linearGradient>
      <linearGradient id={`${id}-bevel`} x1="1" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#fdfdfd" />
        <stop offset="0.22" stopColor="#9da2a7" />
        <stop offset="0.45" stopColor="#f3f5f6" />
        <stop offset="0.7" stopColor="#5f6469" />
        <stop offset="1" stopColor="#d9dde0" />
      </linearGradient>
      {/* The dome mirrors a room: sky above, a dark horizon just below the middle, floor light beneath. */}
      <linearGradient id={`${id}-chrome`} x1="0" y1="0" x2="0.25" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.2" stopColor="#eceff1" />
        <stop offset="0.42" stopColor="#aab0b5" />
        <stop offset="0.5" stopColor="#4d5257" />
        <stop offset="0.55" stopColor="#363a3e" />
        <stop offset="0.63" stopColor="#80868b" />
        <stop offset="0.82" stopColor="#d6dadd" />
        <stop offset="1" stopColor="#f7f8f9" />
      </linearGradient>
      <radialGradient id={`${id}-dome`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.62" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.38" />
      </radialGradient>
      <linearGradient id={`${id}-jack`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d7d7d4" />
        <stop offset="0.5" stopColor="#a3a3a0" />
        <stop offset="1" stopColor="#cfcfcc" />
      </linearGradient>
      <filter id={`${id}-lift`} x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.4" floodColor="#0c3d35" floodOpacity="0.32" />
      </filter>
      <filter id={`${id}-shadow`} x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.16" />
      </filter>
      <filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="3.5" />
      </filter>
      <clipPath id={`${id}-panel`}>
        <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={PANEL.r} />
      </clipPath>
    </defs>
  );
}

function Jack({ x, y, id, side }) {
  // Side jacks: a nut seen edge-on, poking out past the enclosure.
  const w = 7;
  return <rect className="mpedal__jack" x={side === 'left' ? x - w : x} y={y} width={w} height="26" rx="2" fill={`url(#${id}-jack)`} />;
}

function Footswitch({ id, cx, which, down }) {
  const cy = SWITCH_Y;
  return (
    <g>
      {/* A soft contact shadow, then the collar, its bevel, and the dark groove the cap sits in. */}
      <circle cx={cx} cy={cy + 1.5} r="28.5" fill="#000" opacity="0.12" />
      <circle cx={cx} cy={cy} r="27" fill={`url(#${id}-collar)`} stroke="#565b60" strokeWidth="0.6" />
      <circle cx={cx} cy={cy} r="23.4" fill={`url(#${id}-bevel)`} />
      <circle cx={cx} cy={cy} r="20.6" fill="#24272a" />
      <g className={`mpedal__cap${down ? ' is-down' : ''}`} data-cap={which}>
        <circle cx={cx} cy={cy} r="18.5" fill={`url(#${id}-chrome)`} />
        <circle cx={cx} cy={cy} r="18.5" fill={`url(#${id}-dome)`} />
        {/* The window it's reflecting: one crisp highlight, a smaller echo, and light from below catching the rim. */}
        <ellipse cx={cx - 6} cy={cy - 9.5} rx="6.5" ry="2.6" fill="#fff" opacity="0.95" transform={`rotate(-24 ${cx - 6} ${cy - 9.5})`} />
        <circle cx={cx + 7.5} cy={cy - 11} r="1.3" fill="#fff" opacity="0.8" />
        <path d={`M${cx - 12} ${cy + 11}A16 16 0 0 0 ${cx + 12} ${cy + 11}`} fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
        <circle cx={cx} cy={cy} r="18.5" fill="none" stroke="#45494d" strokeWidth="0.7" />
      </g>
      <text className={`mpedal__switchlabel${which === 'left' ? ' mpedal__switchlabel--star' : ''}`} x={cx} y={which === 'left' ? 436 : 432} textAnchor="middle">{SWITCHES[which].label}</text>
    </g>
  );
}

function Drawing({ id, st, ps, down = {} }) {
  return (
    <svg className="mpedal__art" viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="img" aria-label="Drawing of the Endless running Minty: three knobs on a pale mint face with a sprig of mint leaves, an LED at the top right, and two footswitches.">
      <Defs id={id} />
      <Jack id={id} side="left" x={0} y={296} />
      <Jack id={id} side="right" x={BODY.w} y={216} />
      <Jack id={id} side="right" x={BODY.w} y={296} />
      <rect className="mpedal__body" x="0" y="0" width={BODY.w} height={BODY.h} rx={BODY.r} fill={`url(#${id}-body)`} filter={`url(#${id}-shadow)`} />

      {/* The LED sits in a little bezel; the glow only shows when it's bright. */}
      <circle cx={LED_AT.cx} cy={LED_AT.cy} r="7" fill="#dad9d5" />
      <circle cx={LED_AT.cx} cy={LED_AT.cy} r="11" fill={ps.led.hex} opacity={ps.led.busy ? 0.55 : 0} filter={`url(#${id}-glow)`} data-led-glow="" />
      <circle className="mpedal__led" cx={LED_AT.cx} cy={LED_AT.cy} r="5" fill={ps.led.hex} data-led="" />

      {/* The face: pale mint, with a sprig of the real thing and the name. */}
      <rect x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={PANEL.r} fill={FACE} />
      <MintSprig face={FACE} clip={`url(#${id}-panel)`} />
      <text className="mpedal__title" x="22" y="293">Minty</text>

      {KNOBS.map(({ k, name, cx }) => (
        <g key={k}>
          <text className="mpedal__name" x={cx} y="138" textAnchor="middle">{name}</text>
          <circle cx={cx} cy={KNOB_Y} r={KNOB_R} fill={`url(#${id}-knob)`} className="mpedal__knob" filter={`url(#${id}-lift)`} />
          <g data-knob={k} data-cx={cx} data-cy={KNOB_Y} transform={`rotate(${angle(st[k]).toFixed(1)} ${cx} ${KNOB_Y})`}>
            <circle className="mpedal__dot" cx={cx} cy={KNOB_Y - 17} r="2.7" />
          </g>
        </g>
      ))}

      <Footswitch id={id} cx={SWITCHES.left.cx} which="left" down={down.left} />
      <Footswitch id={id} cx={SWITCHES.on.cx} which="on" down={down.on} />
    </svg>
  );
}

/* --------------------------------------------------------------- controls */

const HOLD_MS = 600;
const toKnob = (v) => Number(Math.max(0, Math.min(1, Math.round(v / 0.01) * 0.01)).toFixed(2));

/**
 * One knob: a range input for focus, keys and assistive tech, with a grip
 * over it for dragging. Up or right turns it clockwise, about 160 px for the
 * whole sweep, the way most plugin knobs behave; a double-click returns it to
 * noon, like a real pot's centre detent would.
 */
function Knob({ k, name, cx, value, valuetext, onValue }) {
  const input = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const end = () => { drag.current = null; setDragging(false); };
  return (
    <div className="mpedal__ctl mpedal__ctl--knob" style={box(cx, KNOB_Y, KNOB_R + 3)}>
      <input
        ref={input} type="range" className="mpedal__input" min="0" max="1" step="0.01"
        value={value} data-key={k} aria-label={name} aria-valuetext={valuetext}
        onChange={(e) => onValue(Number(e.target.value))}
      />
      <span
        className={`mpedal__grip${dragging ? ' is-dragging' : ''}`} data-grip={k} aria-hidden="true"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          if (input.current) input.current.focus({ preventScroll: true });
          drag.current = { x: e.clientX, y: e.clientY, v: value };
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) onValue(toKnob(d.v + ((d.y - e.clientY) + (e.clientX - d.x)) / 160));
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => onValue(0.5)}
      />
    </div>
  );
}

/**
 * The left switch knows a press from a hold, as the Endless does. Pointer and
 * keyboard both time the hold; a click with neither (a screen reader
 * activating it) is a press, and the hold has its own button beside it.
 *
 * The click a browser fires after a pointer or key release arrives in the
 * same task as the release, so a flag cleared on the next tick catches
 * exactly that click and never a later one from a screen reader.
 */
function usePressHold(press, hold) {
  const [down, setDown] = useState(false);
  const timer = useRef(null);
  const active = useRef(false);
  const swallow = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  const start = () => {
    if (active.current) return;
    active.current = true;
    setDown(true);
    timer.current = setTimeout(() => { timer.current = null; hold(); }, HOLD_MS);
  };
  const finish = (cancel) => {
    if (!active.current) return;
    active.current = false;
    setDown(false);
    swallow.current = true;
    setTimeout(() => { swallow.current = false; }, 0);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      if (!cancel) press();
    }
  };
  const isKey = (e) => e.key === ' ' || e.key === 'Enter';

  return {
    down,
    handlers: {
      onPointerDown: (e) => { if (e.button === 0) start(); },
      onPointerUp: () => finish(false),
      onPointerCancel: () => finish(true),
      onPointerLeave: () => finish(true),
      onKeyDown: (e) => {
        if (!isKey(e)) return;
        e.preventDefault();
        if (!e.repeat) start();
      },
      onKeyUp: (e) => {
        if (!isKey(e)) return;
        e.preventDefault();
        finish(false);
      },
      onBlur: () => finish(true),
      // A long press on a phone would otherwise open the context menu.
      onContextMenu: (e) => e.preventDefault(),
      onClick: () => { if (!active.current && !swallow.current) press(); },
    },
  };
}

/**
 * The Endless running Minty. Interactive by default: knobs and switches over
 * the drawing, the readout beside it, and how hard you're playing below.
 * `interactive={false}` is the still drawing the case study opens with.
 */
export function Pedal({ interactive = true, caption }) {
  const data = useMinty();
  const live = useLive();
  const [st, setSt] = useState(PEDAL_DEFAULT);
  const { said, say } = useAnnouncer();
  const ps = useMemo(() => (data ? pedalState(data, st) : null), [data, st]);

  // What to say once a switch's change has rendered, from the new state.
  const pending = useRef(null);
  useEffect(() => {
    const what = pending.current;
    if (!what || !ps) return;
    pending.current = null;
    if (what === 'swell') say(`Swell ${st.swell ? 'on' : 'off'}. LED ${ps.led.name}`);
    if (what === 'character') say(`${ps.lines[3][1]}. LED ${ps.led.name}`);
    if (what === 'on') say(ps.lines[4][1]);
  }, [ps, st, say]);

  const press = useCallback(() => { pending.current = 'swell'; setSt((s) => ({ ...s, swell: !s.swell })); }, []);
  const hold = useCallback(() => { pending.current = 'character'; setSt((s) => ({ ...s, character: (s.character + 1) % 4 })); }, []);
  const toggleOn = () => { pending.current = 'on'; setSt((s) => ({ ...s, on: s.on === false })); };
  const set = (key) => (v) => setSt((s) => ({ ...s, [key]: v }));
  const left = usePressHold(press, hold);
  const [onDown, setOnDown] = useState(false);

  if (!ps) return null;
  const id = interactive ? 'mped' : 'mped-still';
  const hintId = `${id}-hint`;

  return (
    <figure className={`mfig mfig--pedal${interactive ? '' : ' mfig--still'}${live && interactive ? ' is-live' : ''}`} data-mfig={interactive ? 'pedal' : undefined}>
      <div className="mpedal">
        <div className="mpedal__stage">
          <Drawing id={id} st={st} ps={ps} down={{ left: left.down, on: onDown }} />
          {interactive && (
            <div className="mpedal__layer" data-controls="" hidden={!live}>
              {KNOBS.map(({ k, name, cx }, i) => (
                <Knob
                  key={k} k={k} name={name} cx={cx} value={st[k]} onValue={set(k)}
                  valuetext={`${st[k].toFixed(2)}: ${ps.lines[i][1]}`}
                />
              ))}
              <button
                type="button" className="mpedal__ctl mpedal__switch" style={box(SWITCHES.left.cx, SWITCH_Y, 27)}
                data-switch="left" aria-label="Left footswitch" aria-describedby={hintId}
                {...left.handlers}
              />
              <button
                type="button" className="mpedal__ctl mpedal__switch" style={box(SWITCHES.on.cx, SWITCH_Y, 27)}
                data-switch="on" aria-label="On" aria-pressed={st.on === false ? 'false' : 'true'}
                onClick={toggleOn}
                // The On switch dips too, though it's a plain toggle.
                onPointerDown={() => setOnDown(true)}
                onPointerUp={() => setOnDown(false)}
                onPointerCancel={() => setOnDown(false)}
                onPointerLeave={() => setOnDown(false)}
              />
            </div>
          )}
        </div>
        {interactive && (
          <dl className="mpedal__read" data-pedal-read="">
            {ps.lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd data-line={k}>{v}</dd></div>)}
          </dl>
        )}
      </div>
      {interactive && (
        <div className="mfig__controls mpedal__extra" data-controls="" hidden={!live}>
          <Range k="level" label="You're playing at" value={st.level} min={-48} max={0} step={1} format={(v) => `${v} dBFS`} onChange={set('level')} />
          <p className="mpedal__hint" id={hintId}>
            Drag a knob, or focus it and use the arrow keys. Tap the left switch to toggle the swell; hold it for half a second to change character.
          </p>
          {/* Holding is a timed gesture, and a screen reader can only click,
              so the hold gets a plain button too. */}
          <button type="button" className="mplay" data-hold="" onClick={hold}>Hold the left switch</button>
        </div>
      )}
      {interactive && <p className="visually-hidden" aria-live="polite" data-say="">{said}</p>}
      {caption && <figcaption className="mfig__cap">{caption}</figcaption>}
    </figure>
  );
}
