/* The session player for the OP-XY demonstration pages.
 *
 * Progressive enhancement over a transcript that is complete in the HTML
 * (src/app/components/operator/Session.jsx). Without this script every step
 * of the session is on the page, in order, as a record. With it the steps are
 * hidden and revealed one at a time, at the pace each step's `data-dur`
 * suggests, inside a console that scrolls to keep the newest step in view:
 * the server's work, replayed at reading speed.
 *
 *   Play / Pause   run the session from where it stands
 *   Step           reveal one more step
 *   Show everything  the static record, as without JavaScript
 *   Restart        back to the first step
 *
 * `prefers-reduced-motion` turns off the scrolling and the fade (the fade is
 * CSS, keyed on `.is-new`); the steps still appear in order. Several players
 * on one page are independent.
 *
 * Markup contract:
 *   <div data-session>
 *     <div data-session-bar hidden>
 *       <button data-play> <button data-step-btn> <button data-all> <button data-restart>
 *       <span data-pos></span> <span data-live aria-live="polite"></span>
 *     </div>
 *     <ol data-steps> <li data-step data-dur="900">…</li> … </ol>
 *   </div>
 */
import { ready } from './ready.js';

(function () {
  'use strict';

  var OPENING = 2; // steps shown before anything is pressed, so the console is never blank

  function init(root) {
    var list = root.querySelector('[data-steps]');
    var bar = root.querySelector('[data-session-bar]');
    if (!list || !bar) return;
    var steps = Array.prototype.slice.call(list.querySelectorAll('[data-step]'));
    if (steps.length < 3) return;

    var playBtn = bar.querySelector('[data-play]');
    var stepBtn = bar.querySelector('[data-step-btn]');
    var allBtn = bar.querySelector('[data-all]');
    var restartBtn = bar.querySelector('[data-restart]');
    var pos = bar.querySelector('[data-pos]');
    var live = bar.querySelector('[data-live]');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var shown = 0;
    var playing = false;
    var timer = null;

    // A hash that names a step inside this transcript (a hit from the grid)
    // means the visitor came for that step, so the record is shown in full
    // and the browser's own jump to it is left alone.
    var targetId = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
    var target = targetId && document.getElementById(targetId);
    if (target && list.contains(target)) return;

    bar.hidden = false;
    list.classList.add('console--live');
    list.setAttribute('tabindex', '0');

    function render() {
      steps.forEach(function (s, i) { s.hidden = i >= shown; });
      var done = shown >= steps.length;
      pos.textContent = 'Step ' + Math.min(shown, steps.length) + ' of ' + steps.length;
      playBtn.textContent = playing ? 'Pause' : done ? 'Play again' : shown <= OPENING ? 'Play the session' : 'Resume';
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      stepBtn.disabled = done || playing;
      allBtn.disabled = done;
      list.classList.toggle('console--done', done);
    }

    function follow(el) {
      if (reduce) return;
      var top = el.offsetTop - list.offsetTop;
      var bottom = top + el.offsetHeight;
      var viewBottom = list.scrollTop + list.clientHeight;
      if (bottom > viewBottom - 12) list.scrollTop = Math.max(0, bottom - list.clientHeight + 12);
    }

    function reveal() {
      if (shown >= steps.length) return null;
      var s = steps[shown++];
      s.hidden = false;
      s.classList.add('is-new');
      render();
      follow(s);
      return s;
    }

    function stop(announce) {
      playing = false;
      clearTimeout(timer);
      render();
      if (announce && live) live.textContent = announce;
    }

    function tick() {
      var s = reveal();
      if (!s || shown >= steps.length) { stop('Session finished, ' + steps.length + ' steps.'); return; }
      var dur = Number(s.getAttribute('data-dur')) || 900;
      timer = setTimeout(tick, reduce ? Math.min(dur, 700) : dur);
    }

    playBtn.addEventListener('click', function () {
      if (playing) { stop('Paused at step ' + shown + '.'); return; }
      if (shown >= steps.length) { shown = 0; list.scrollTop = 0; }
      playing = true;
      if (live) live.textContent = 'Playing.';
      render();
      tick();
    });

    stepBtn.addEventListener('click', function () {
      stop();
      reveal();
    });

    allBtn.addEventListener('click', function () {
      stop();
      shown = steps.length;
      render();
      if (live) live.textContent = 'Showing all ' + steps.length + ' steps.';
    });

    restartBtn.addEventListener('click', function () {
      stop();
      shown = OPENING;
      list.scrollTop = 0;
      render();
      if (live) live.textContent = 'Back to the start.';
    });

    // Keyboard on the console itself: space plays and pauses, right arrow steps.
    list.addEventListener('keydown', function (e) {
      if (e.target !== list) return;
      if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); stepBtn.click(); }
    });

    shown = OPENING;
    render();
  }

  ready(function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-session]'), init);
  });
})();
