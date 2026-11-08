/* The figures in the OP-XY walk-through (/projects/<slug>/demo/…).
 *
 * Progressive enhancement over markup that is already the complete record
 * (src/app/components/operator/walk.jsx). Without this script every figure
 * shows everything it knows. With it, each becomes something to operate:
 *
 *   data-w="…"                   a figure to enhance
 *   [data-controls] hidden       its buttons, revealed here
 *   button[data-set][data-value] sets data-<set>="<value>" on the figure
 *   [data-show-<set>="a b"]      shown only while <set> is a or b
 *   [data-live-only] hidden      shown once enhanced
 *   [data-static-only]           hidden once enhanced
 *   button[data-say]             text for the figure's polite live region
 *
 * Two figures need more than show and hide, and get a hook each: the
 * decision cards reorder (animated unless motion is reduced), and the sweep
 * moves one screen through a control's frames as a slider is dragged.
 *
 * A figure that contains the element the URL's hash points at is left as
 * the static record, so a link from the grid lands on the frame it named.
 */
import { ready } from './ready.js';

(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  function say(fig, text) {
    var live = fig.querySelector('[data-say]:not(button)');
    if (live && text) live.textContent = text;
  }

  /* ---------------------------------------------------------- hooks */

  // Move the cards to a new order, sliding each from where it was (FLIP).
  function reorder(fig, mode) {
    var cards = fig.querySelectorAll('.wcard[data-order-submitted]');
    var before = [];
    each(cards, function (c) { before.push(c.getBoundingClientRect()); });
    each(cards, function (c) {
      var key = mode === 'ranking' ? 'data-order-ranking' : 'data-order-submitted';
      c.style.order = c.getAttribute(key);
    });
    if (reduce) return;
    each(cards, function (c, i) {
      var after = c.getBoundingClientRect();
      var dx = before[i].left - after.left;
      var dy = before[i].top - after.top;
      if (!dx && !dy) return;
      c.style.transition = 'none';
      c.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          c.style.transition = 'transform 320ms cubic-bezier(0.2, 0.7, 0.1, 1)';
          c.style.transform = '';
        });
      });
    });
  }

  // Point the one screen at the chosen control's frame for the slider value.
  function sweep(fig) {
    var screen = fig.querySelector('[data-frames]');
    var range = fig.querySelector('[data-range]');
    var out = fig.querySelector('[data-out]');
    if (!screen || !range) return;
    var data;
    try { data = JSON.parse(screen.getAttribute('data-frames')); } catch (e) { return; }
    var ctl = fig.getAttribute('data-ctl');
    var list = data[ctl] || [];
    if (!list.length) return;
    var playing = ctl === '__playing';
    range.disabled = playing || list.length < 2;
    range.max = String(Math.max(0, list.length - 1));
    var at = Math.min(Number(range.value) || 0, list.length - 1);
    var f = list[at];
    var sprite = screen.querySelector('.sprite');
    var img = sprite && sprite.querySelector('img');
    if (sprite) {
      sprite.style.setProperty('--col', f.col);
      sprite.style.setProperty('--row', f.row);
    }
    if (img) img.alt = f.alt;
    var label = playing ? 'a note playing' : ctl + ' at ' + f.value;
    if (out) out.textContent = label;
    range.setAttribute('aria-valuetext', playing ? 'not used while a note plays' : String(f.value));
    return label;
  }

  var HOOKS = {
    decision: function (fig, set, value) { if (set === 'mode') reorder(fig, value); },
    sweep: function (fig) { return sweep(fig); },
  };

  /* -------------------------------------------------------- engine */

  function apply(fig, set, value, btn) {
    fig.setAttribute('data-' + set, value);
    each(fig.querySelectorAll('button[data-set="' + set + '"]'), function (b) {
      var on = b.getAttribute('data-value') === value;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    each(fig.querySelectorAll('[data-show-' + set + ']'), function (el) {
      var allowed = el.getAttribute('data-show-' + set).split(/\s+/);
      el.hidden = allowed.indexOf(value) === -1;
    });
    var hook = HOOKS[fig.getAttribute('data-w')];
    var spoken = hook ? hook(fig, set, value) : null;
    if (btn) say(fig, btn.getAttribute('data-say') || spoken);
  }

  function enhance(fig) {
    var targetId = location.hash ? decodeURIComponent(location.hash.slice(1)) : '';
    var target = targetId && document.getElementById(targetId);
    if (target && fig.contains(target)) return;

    each(fig.querySelectorAll('[data-controls], [data-live-only]'), function (el) { el.hidden = false; });
    each(fig.querySelectorAll('[data-static-only]'), function (el) { el.hidden = true; });
    fig.classList.add('is-live');

    // Every group starts from the button the markup marked as pressed.
    var sets = {};
    each(fig.querySelectorAll('button[data-set]'), function (b) {
      var set = b.getAttribute('data-set');
      if (!sets[set] || b.getAttribute('aria-pressed') === 'true') sets[set] = b.getAttribute('data-value');
    });
    Object.keys(sets).forEach(function (set) { apply(fig, set, sets[set]); });

    fig.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-set]');
      if (!b || !fig.contains(b)) return;
      apply(fig, b.getAttribute('data-set'), b.getAttribute('data-value'), b);
    });

    var range = fig.querySelector('[data-range]');
    if (range) {
      range.addEventListener('input', function () {
        var label = HOOKS.sweep(fig);
        say(fig, label);
      });
    }
  }

  ready(function () {
    each(document.querySelectorAll('[data-w]'), enhance);
  });
})();
