/* The Minty figures, made live.
 *
 * Loaded only on pages that have one (see src/app/enhancers.js). Each figure
 * arrives fully drawn at its default setting, by the server, from Minty's
 * measurements. This script:
 *
 *   - redraws every chart at its real width, and again on resize
 *   - fetches the measurements once (minty/data.json, beside the page) and
 *     redraws as the knobs move, using the same spec builders and the same
 *     chart function the server used
 *   - adds the hover layer: a crosshair that snaps to the nearest measured
 *     point with every series' value in a tooltip, the same readout on the
 *     keyboard with the arrow keys, and tooltips on the THD markers
 *   - plays the renders, with a Minty/dry switch that keeps your place
 *
 * Everything inserted as text uses textContent. Charts come back from
 * lineChart() as markup it has already escaped.
 */
import { ready } from './ready.js';
import { lineChart, scale } from '../app/lib/minty-charts.js';
import {
  charSpec, curveSpec, eqSpec, listenSpec, pedalState, swellSpec, withFormats,
} from '../app/lib/minty-specs.js';

(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };
  var dataPromise = null;

  function loadData(src) {
    if (!dataPromise) {
      dataPromise = fetch(src)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(String(r.status))); })
        .catch(function () { return null; });
    }
    return dataPromise;
  }

  var BUILDERS = { curve: curveSpec, chars: charSpec, eq: eqSpec, swell: swellSpec, listen: listenSpec };

  function say(fig, text) {
    var live = fig.querySelector('[data-say]');
    if (live && text) live.textContent = text;
  }

  /* ------------------------------------------------------------- drawing */

  function buildLegend(fig, items) {
    var box = fig.querySelector('[data-legend]');
    if (!box) return;
    box.textContent = '';
    if (!items || items.length < 2) return;
    items.forEach(function (it) {
      var li = document.createElement('li');
      var key = document.createElement('span');
      key.className = 'mkey mkey--' + (it.mark || 'line') + ' mc-' + it.role;
      key.setAttribute('aria-hidden', 'true');
      li.appendChild(key);
      li.appendChild(document.createTextNode(it.label));
      box.appendChild(li);
    });
  }

  function draw(fig, built) {
    var box = fig.querySelector('[data-chart]');
    if (!box || !built) return;
    var w = box.clientWidth || 640;
    var spec = withFormats(Object.assign({}, built.spec, { width: w }));
    var res = lineChart(spec);
    box.innerHTML = res.svg;
    fig._chart = { spec: spec, frame: res.frame };
    buildLegend(fig, built.spec.legend);
    var readout = fig.querySelector('[data-readout]');
    if (readout && built.readout != null) readout.textContent = built.readout;
    if (fig.getAttribute('data-mfig') === 'listen') placePlayhead(fig);
  }

  function rebuild(fig) {
    var kind = fig.getAttribute('data-mfig');
    var spec = fig.getAttribute('data-spec');
    if (spec) { draw(fig, { spec: JSON.parse(spec) }); return; }
    if (!fig._data || !BUILDERS[kind]) return;
    draw(fig, BUILDERS[kind](fig._data, fig._state));
  }

  /* ---------------------------------------------------------- hover layer */

  function interpolate(points, xv) {
    if (xv <= points[0][0]) return points[0][1];
    for (var i = 1; i < points.length; i++) {
      if (points[i][0] >= xv) {
        var a = points[i - 1];
        var b = points[i];
        return b[0] === a[0] ? b[1] : a[1] + ((b[1] - a[1]) * (xv - a[0])) / (b[0] - a[0]);
      }
    }
    return points[points.length - 1][1];
  }

  // The series values at the measured x nearest to px, for the tooltip.
  function readAt(fig, px) {
    var c = fig._chart;
    if (!c) return null;
    var m = c.frame.m;
    var x = scale(c.spec.x.domain, [m.left, c.frame.W - m.right], c.spec.x.type);
    var y = scale(c.spec.y.domain, [c.frame.H - m.bottom, m.top], c.spec.y.type);
    var target = x.invert(px);
    var main = c.spec.series.filter(function (s) { return s.role === 'accent'; })[0] || c.spec.series[0];
    if (!main || !main.points.length) return null;
    var best = 0;
    main.points.forEach(function (p, i) {
      if (Math.abs(p[0] - target) < Math.abs(main.points[best][0] - target)) best = i;
    });
    var xv = main.points[best][0];
    // Every series is read at the same x, interpolated between its own
    // points: a straight reference line has only two of them.
    var rows = c.spec.series.filter(function (s) { return s.label && s.id.indexOf('link-') !== 0; }).map(function (s) {
      return { role: s.role, label: s.label, value: interpolate(s.points, xv) };
    });
    return { index: best, count: main.points.length, xv: xv, px: x(xv), py: y(Math.max(Math.min.apply(null, c.spec.y.domain), Math.min(Math.max.apply(null, c.spec.y.domain), main.points[best][1]))), rows: rows };
  }

  function showTip(fig, hit, clientX, clientY) {
    var tip = fig.querySelector('[data-tip-box]');
    var svg = fig.querySelector('svg.mchart');
    if (!tip || !svg || !hit) return;
    var cross = svg.querySelector('.mcross');
    if (cross) {
      cross.setAttribute('x1', hit.px.toFixed(1));
      cross.setAttribute('x2', hit.px.toFixed(1));
      cross.setAttribute('visibility', 'visible');
    }
    var c = fig._chart;
    tip.textContent = '';
    var head = document.createElement('p');
    head.className = 'mtip__head';
    head.textContent = c.spec.x.format(hit.xv) + (c.spec.x.label ? ' ' + c.spec.x.label.replace(/\s*\(.*\)/, '') : '');
    tip.appendChild(head);
    hit.rows.forEach(function (r) {
      var row = document.createElement('p');
      row.className = 'mtip__row';
      var key = document.createElement('span');
      key.className = 'mkey mkey--line mc-' + r.role;
      var val = document.createElement('b');
      val.textContent = c.spec.y.format(r.value);
      row.appendChild(key);
      row.appendChild(val);
      row.appendChild(document.createTextNode(' ' + r.label));
      tip.appendChild(row);
    });
    tip.hidden = false;
    var box = fig.getBoundingClientRect();
    var svgBox = svg.getBoundingClientRect();
    var left = (clientX != null ? clientX : svgBox.left + hit.px) - box.left + 14;
    var top = (clientY != null ? clientY : svgBox.top + hit.py) - box.top - 10;
    if (left + tip.offsetWidth > box.width) left -= tip.offsetWidth + 28;
    tip.style.left = Math.max(0, left) + 'px';
    tip.style.top = Math.max(0, top) + 'px';
  }

  function hideTip(fig) {
    var tip = fig.querySelector('[data-tip-box]');
    if (tip) tip.hidden = true;
    var cross = fig.querySelector('.mcross');
    if (cross) cross.setAttribute('visibility', 'hidden');
  }

  function hover(fig) {
    var box = fig.querySelector('[data-chart]');
    if (!box || fig.getAttribute('data-mfig') === 'listen') return;
    box.setAttribute('tabindex', '0');
    box.setAttribute('aria-label', 'Chart. Use the left and right arrow keys to read values.');
    var keyIndex = null;

    box.addEventListener('pointermove', function (e) {
      if (e.target.hasAttribute && e.target.hasAttribute('data-tip')) return;
      var svg = box.querySelector('svg');
      if (!svg) return;
      var r = svg.getBoundingClientRect();
      var px = (e.clientX - r.left) * (fig._chart.frame.W / r.width);
      var m = fig._chart.frame.m;
      if (px < m.left || px > fig._chart.frame.W - m.right) { hideTip(fig); return; }
      showTip(fig, readAt(fig, px), e.clientX, e.clientY);
    });
    box.addEventListener('pointerleave', function () { hideTip(fig); });

    box.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var c = fig._chart;
      if (!c) return;
      e.preventDefault();
      var main = c.spec.series.filter(function (s) { return s.role === 'accent'; })[0] || c.spec.series[0];
      if (!main) return;
      var n = main.points.length;
      var step = Math.max(1, Math.round(n / 40));
      keyIndex = keyIndex == null ? 0 : Math.max(0, Math.min(n - 1, keyIndex + (e.key === 'ArrowRight' ? step : -step)));
      var x = scale(c.spec.x.domain, [c.frame.m.left, c.frame.W - c.frame.m.right], c.spec.x.type);
      var hit = readAt(fig, x(main.points[keyIndex][0]));
      showTip(fig, hit);
      say(fig, c.spec.x.format(hit.xv) + ': ' + hit.rows.map(function (r) { return r.label + ' ' + c.spec.y.format(r.value); }).join(', '));
    });
    box.addEventListener('blur', function () { hideTip(fig); keyIndex = null; });

    // Markers that carry their own tooltip (the THD dumbbell).
    function markTip(e) {
      var t = e.target;
      if (!t.hasAttribute || !t.hasAttribute('data-tip')) return;
      var tip = fig.querySelector('[data-tip-box]');
      tip.textContent = t.getAttribute('data-tip');
      tip.hidden = false;
      var fb = fig.getBoundingClientRect();
      var tb = t.getBoundingClientRect();
      tip.style.left = Math.min(fb.width - tip.offsetWidth, tb.right - fb.left + 8) + 'px';
      tip.style.top = (tb.top - fb.top - 6) + 'px';
      if (e.type === 'focusin') say(fig, t.getAttribute('data-tip'));
    }
    box.addEventListener('pointerover', markTip);
    box.addEventListener('focusin', markTip);
    box.addEventListener('focusout', function () { hideTip(fig); });
  }

  /* ---------------------------------------------------------- controls */

  function setPressed(fig, key, value) {
    each(fig.querySelectorAll('button[data-key="' + key + '"]'), function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-value') === String(value) ? 'true' : 'false');
    });
  }

  function wireControls(fig, onChange) {
    var timer = null;
    each(fig.querySelectorAll('input[data-key]'), function (input) {
      input.addEventListener('input', function () {
        var key = input.getAttribute('data-key');
        fig._state[key] = Number(input.value);
        var out = fig.querySelector('[data-out="' + key + '"]');
        if (out) out.textContent = key === 'level' ? input.value + ' dBFS' : Number(input.value).toFixed(2);
        onChange(key);
        // The sentence under a chart is read out once the knob settles, not on
        // every step of a drag.
        clearTimeout(timer);
        timer = setTimeout(function () {
          var r = fig.querySelector('[data-readout]');
          if (r) say(fig, r.textContent);
        }, 400);
      });
    });
    fig.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-key]');
      if (!b || !fig.contains(b)) return;
      var key = b.getAttribute('data-key');
      var raw = b.getAttribute('data-value');
      fig._state[key] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
      setPressed(fig, key, raw);
      onChange(key);
      var r = fig.querySelector('[data-readout]');
      if (r) say(fig, r.textContent);
    });
  }

  /* -------------------------------------------------------------- pedal */

  var HOLD_MS = 600;
  var KNOB_KEYS = ['sens', 'dyn', 'eq'];

  function drawPedal(fig) {
    var st = fig._state;
    each(fig.querySelectorAll('[data-knob]'), function (g) {
      var k = g.getAttribute('data-knob');
      g.setAttribute('transform', 'rotate(' + (-135 + 270 * st[k]).toFixed(1) + ' ' + g.getAttribute('data-cx') + ' ' + g.getAttribute('data-cy') + ')');
    });
    if (!fig._data) return;
    var ps = pedalState(fig._data, st);
    var led = fig.querySelector('[data-led]');
    var glow = fig.querySelector('[data-led-glow]');
    if (led) led.setAttribute('fill', ps.led.hex);
    if (glow) {
      glow.setAttribute('fill', ps.led.hex);
      glow.setAttribute('opacity', ps.led.busy ? '0.55' : '0');
    }
    ps.lines.forEach(function (l) {
      var dd = fig.querySelector('[data-line="' + l[0] + '"]');
      if (dd) dd.textContent = l[1];
    });
    // A screen reader hears what a knob does, not just where it is.
    KNOB_KEYS.forEach(function (k, i) {
      var input = fig.querySelector('input[data-key="' + k + '"]');
      if (input) input.setAttribute('aria-valuetext', Number(st[k]).toFixed(2) + ': ' + ps.lines[i][1]);
    });
    var on = fig.querySelector('[data-switch="on"]');
    if (on) on.setAttribute('aria-pressed', st.on === false ? 'false' : 'true');
    return ps;
  }

  /** Set a knob's input as if it had been moved, so every listener agrees. */
  function setKnob(input, v) {
    var step = Number(input.step) || 0.01;
    var clamped = Math.max(Number(input.min), Math.min(Number(input.max), Math.round(v / step) * step));
    if (Number(input.value) === clamped) return;
    input.value = String(clamped);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Dragging a knob: up or right turns it clockwise, about 160 px for the
   * whole sweep, the way most plugin knobs behave. The grip sits over the
   * range input, so the input keeps the focus and the keyboard.
   */
  function wireKnob(fig, grip) {
    var input = fig.querySelector('input[data-key="' + grip.getAttribute('data-grip') + '"]');
    if (!input) return;
    var drag = null;
    grip.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      input.focus({ preventScroll: true });
      drag = { x: e.clientX, y: e.clientY, v: Number(input.value) };
      grip.setPointerCapture(e.pointerId);
      grip.classList.add('is-dragging');
    });
    grip.addEventListener('pointermove', function (e) {
      if (!drag) return;
      setKnob(input, drag.v + ((drag.y - e.clientY) + (e.clientX - drag.x)) / 160);
    });
    function end() { drag = null; grip.classList.remove('is-dragging'); }
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
    // Double-click returns a knob to noon, like a real pot's centre detent would.
    grip.addEventListener('dblclick', function () { setKnob(input, 0.5); });
  }

  /**
   * The left switch knows a press from a hold, as the Endless does. Pointer
   * and keyboard both time the hold; a click with neither (a screen reader
   * activating it) is a press, and the hold has its own button beside it.
   */
  function wireSwitch(btn, press, hold) {
    var fig = btn.closest('[data-mfig]');
    var cap = fig && fig.querySelector('[data-cap="left"]');
    var timer = null;
    var active = false;
    // The click a browser fires after a pointer or key release arrives in the
    // same task as the release, so a flag cleared on the next tick catches
    // exactly that click and never a later one from a screen reader.
    var swallow = false;
    function down() {
      if (active) return;
      active = true;
      if (cap) cap.classList.add('is-down');
      timer = setTimeout(function () { timer = null; hold(); }, HOLD_MS);
    }
    function up(cancel) {
      if (!active) return;
      active = false;
      if (cap) cap.classList.remove('is-down');
      swallow = true;
      setTimeout(function () { swallow = false; }, 0);
      if (timer) {
        clearTimeout(timer);
        timer = null;
        if (!cancel) press();
      }
    }
    btn.addEventListener('pointerdown', function (e) { if (e.button === 0) down(); });
    btn.addEventListener('pointerup', function () { up(false); });
    btn.addEventListener('pointercancel', function () { up(true); });
    btn.addEventListener('pointerleave', function () { up(true); });
    btn.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) down();
    });
    btn.addEventListener('keyup', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      up(false);
    });
    btn.addEventListener('blur', function () { up(true); });
    // A long press on a phone would otherwise open the context menu.
    btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    btn.addEventListener('click', function () {
      if (active || swallow) return;
      press();
    });
  }

  function wirePedal(fig) {
    wireControls(fig, function () { drawPedal(fig); });
    var press = function () {
      fig._state.swell = !fig._state.swell;
      var ps = drawPedal(fig);
      say(fig, 'Swell ' + (fig._state.swell ? 'on' : 'off') + '. LED ' + (ps ? ps.led.name : ''));
    };
    var hold = function () {
      fig._state.character = (fig._state.character + 1) % 4;
      var ps = drawPedal(fig);
      say(fig, (ps ? ps.lines[3][1] : '') + '. LED ' + (ps ? ps.led.name : ''));
    };
    each(fig.querySelectorAll('[data-grip]'), function (g) { wireKnob(fig, g); });
    var left = fig.querySelector('[data-switch="left"]');
    if (left) wireSwitch(left, press, hold);
    var h = fig.querySelector('[data-hold]');
    if (h) h.addEventListener('click', hold);
    var on = fig.querySelector('[data-switch="on"]');
    if (on) {
      on.addEventListener('click', function () {
        fig._state.on = fig._state.on === false;
        var ps = drawPedal(fig);
        say(fig, ps ? ps.lines[4][1] : '');
      });
      // The On switch dips too, though it's a plain toggle.
      var onCap = fig.querySelector('[data-cap="on"]');
      if (onCap) {
        on.addEventListener('pointerdown', function () { onCap.classList.add('is-down'); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) { on.addEventListener(t, function () { onCap.classList.remove('is-down'); }); });
      }
    }
  }

  /* ------------------------------------------------------------- listen */

  function placePlayhead(fig) {
    var svg = fig.querySelector('svg.mchart');
    var wet = fig.querySelector('audio[data-audio="wet"]');
    if (!svg || !wet || !fig._chart) return;
    var line = svg.querySelector('.mplayhead');
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('class', 'mplayhead');
      svg.appendChild(line);
    }
    var c = fig._chart;
    var x = scale(c.spec.x.domain, [c.frame.m.left, c.frame.W - c.frame.m.right]);
    var px = x(Math.min(c.spec.x.domain[1], wet.currentTime || 0)).toFixed(1);
    line.setAttribute('x1', px);
    line.setAttribute('x2', px);
    line.setAttribute('y1', c.frame.m.top);
    line.setAttribute('y2', c.frame.H - c.frame.m.bottom);
    var t = fig.querySelector('[data-time]');
    if (t) t.textContent = (wet.currentTime || 0).toFixed(1) + 's';
  }

  function wireListen(fig) {
    var sources = JSON.parse(fig.getAttribute('data-sources') || '{}');
    var wet = fig.querySelector('audio[data-audio="wet"]');
    var dry = fig.querySelector('audio[data-audio="dry"]');
    var play = fig.querySelector('[data-play]');
    var note = fig.querySelector('[data-audio-note]');
    if (!wet || !dry || !play) return;
    var playing = false;
    var raf = null;

    function audible() {
      var ab = fig._state.ab;
      wet.muted = ab !== 'wet';
      dry.muted = ab !== 'dry';
    }
    function tick() {
      placePlayhead(fig);
      if (playing) raf = requestAnimationFrame(tick);
    }
    function stop() {
      playing = false;
      wet.pause();
      dry.pause();
      play.textContent = 'Play';
      play.setAttribute('aria-pressed', 'false');
      cancelAnimationFrame(raf);
    }
    function fail() {
      stop();
      if (note) {
        note.hidden = false;
        note.textContent = 'The audio isn’t reachable from here yet. The waveforms above are drawn from the same renders.';
      }
    }
    [wet, dry].forEach(function (a) { a.addEventListener('error', fail); });
    wet.addEventListener('ended', function () { stop(); wet.currentTime = 0; dry.currentTime = 0; placePlayhead(fig); });

    play.addEventListener('click', function () {
      if (playing) { stop(); return; }
      audible();
      dry.currentTime = wet.currentTime;
      Promise.all([wet.play(), dry.play()]).then(function () {
        playing = true;
        play.textContent = 'Pause';
        play.setAttribute('aria-pressed', 'true');
        tick();
      }).catch(fail);
    });

    wireControls(fig, function (key) {
      if (key === 'render') {
        var t = wet.currentTime;
        var was = playing;
        if (was) stop();
        wet.src = sources[fig._state.render];
        wet.addEventListener('loadedmetadata', function once() {
          wet.removeEventListener('loadedmetadata', once);
          wet.currentTime = t;
          if (was) play.click();
        });
        if (!was) wet.load();
        rebuild(fig);
      }
      if (key === 'ab') {
        audible();
        // Keep the two in step at the moment of the switch.
        if (playing) dry.currentTime = wet.currentTime;
      }
    });

    // Click the waveform to jump there.
    var box = fig.querySelector('[data-chart]');
    box.addEventListener('click', function (e) {
      var svg = box.querySelector('svg');
      if (!svg || !fig._chart) return;
      var r = svg.getBoundingClientRect();
      var c = fig._chart;
      var px = (e.clientX - r.left) * (c.frame.W / r.width);
      var x = scale(c.spec.x.domain, [c.frame.m.left, c.frame.W - c.frame.m.right]);
      var t = Math.max(0, Math.min(c.spec.x.domain[1], x.invert(px)));
      wet.currentTime = t;
      dry.currentTime = t;
      placePlayhead(fig);
    });
  }

  /* --------------------------------------------------------------- setup */

  function enhance(fig) {
    var kind = fig.getAttribute('data-mfig');
    try { fig._state = JSON.parse(fig.getAttribute('data-state') || '{}'); } catch (e) { fig._state = {}; }
    fig.classList.add('is-live');

    // Static charts redraw at their real width straight away.
    if (fig.hasAttribute('data-spec')) rebuild(fig);
    hover(fig);

    var needsData = kind === 'pedal' || !!BUILDERS[kind];
    if (!needsData) return;
    loadData(fig.getAttribute('data-src')).then(function (data) {
      if (!data) return; // the static figure stays, which is the whole record
      fig._data = data;
      each(fig.querySelectorAll('[data-controls]'), function (el) { el.hidden = false; });
      if (kind === 'pedal') { wirePedal(fig); drawPedal(fig); return; }
      if (kind === 'listen') wireListen(fig);
      else wireControls(fig, function () { rebuild(fig); });
      rebuild(fig);
    });
  }

  ready(function () {
    var figs = document.querySelectorAll('[data-mfig]');
    each(figs, enhance);

    // Redraw at the new width when the column changes size.
    if (window.ResizeObserver) {
      var pending = null;
      var ro = new ResizeObserver(function () {
        clearTimeout(pending);
        pending = setTimeout(function () { each(figs, function (f) { if (f.getAttribute('data-mfig') !== 'pedal') rebuild(f); }); }, reduce ? 0 : 120);
      });
      each(figs, function (f) { var c = f.querySelector('[data-chart]'); if (c) ro.observe(c); });
    }
  });
})();
