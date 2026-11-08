/* Live filters for the OP-XY screens page (/projects/<slug>/screens/).
 *
 * Progressive enhancement over a grid that is already complete in the HTML.
 * Without this script the category chips are jump links to each category's
 * section and the kind chips and search box stay hidden. With it:
 *
 *   - category chips filter in place instead of jumping
 *   - the kind chips (finished frames, pass variants, cleaned, kept) appear
 *   - a search box matches against the text behind each screen, fetched once
 *     from /opxy/search.json the first time it is needed (see
 *     src/app/lib/opxy-search.js for the shape)
 *   - the current filter is kept in the query string, so a filtered view can
 *     be linked to and survives a reload
 *
 * Markup contract (rendered by src/app/pages/Screens.jsx):
 *
 *   <div data-screens-filter data-search="…/opxy/search.json">
 *     <div data-cat-bar>  <a data-cat="all|engines|…" aria-pressed>…</a>  </div>
 *     <div data-js hidden>
 *       <div data-kind-bar> <button data-kind="all|frame|pass|cleaned|kept" aria-pressed> </div>
 *       <input data-q type="search">
 *     </div>
 *     <p data-live aria-live="polite"></p>
 *   </div>
 *   <section data-cat="engines"> <section data-machine="kiln">
 *     <li data-cell data-kind="pass" data-m="kiln" data-i="14"> … <img alt> …
 *   <p data-empty hidden> … <button data-reset>
 */
import { ready } from './ready.js';

(function () {
  'use strict';

  ready(function () {
    var root = document.querySelector('[data-screens-filter]');
    if (!root) return;
    var page = root.closest('main') || document;

    var cells = Array.prototype.slice.call(page.querySelectorAll('[data-cell]'));
    var machineSections = Array.prototype.slice.call(page.querySelectorAll('[data-machine]'));
    var catSections = Array.prototype.slice.call(page.querySelectorAll('section[data-cat]'));
    var catBar = root.querySelector('[data-cat-bar]');
    var kindBar = root.querySelector('[data-kind-bar]');
    var q = root.querySelector('[data-q]');
    var live = root.querySelector('[data-live]');
    var empty = page.querySelector('[data-empty]');
    var reset = page.querySelector('[data-reset]');
    if (!cells.length || !catBar) return;

    Array.prototype.forEach.call(root.querySelectorAll('[data-js]'), function (el) { el.hidden = false; });

    var state = { cat: 'all', kind: 'all', q: '' };
    var index = null;
    var loading = null;

    // The text index is fetched once, the first time a query needs it (or when
    // the field is focused, to get ahead of typing). A failed fetch leaves an
    // empty index, so search still matches on what is in the page.
    function loadIndex() {
      if (loading) return loading;
      loading = fetch(root.getAttribute('data-search'))
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error(r.status)); })
        .then(function (j) { index = j; })
        .catch(function () { index = { machines: {}, cells: {} }; });
      return loading;
    }

    function terms() {
      return state.q.toLowerCase().split(/\s+/).filter(Boolean);
    }

    function textOf(cell) {
      var m = cell.getAttribute('data-m');
      var i = cell.getAttribute('data-i');
      var img = cell.querySelector('img');
      var own = (index && index.cells && index.cells[m] && index.cells[m][i]) || '';
      var machine = (index && index.machines && index.machines[m]) || '';
      return (machine + ' ' + own + ' ' + (img ? img.alt : '') + ' ' + cell.textContent).toLowerCase();
    }

    function matches(cell, words) {
      var section = cell.closest('[data-cat]');
      if (state.cat !== 'all' && (!section || section.getAttribute('data-cat') !== state.cat)) return false;
      if (state.kind !== 'all' && cell.getAttribute('data-kind') !== state.kind) return false;
      if (!words.length) return true;
      var hay = textOf(cell);
      for (var k = 0; k < words.length; k++) if (hay.indexOf(words[k]) === -1) return false;
      return true;
    }

    function setPressed(bar, attr, value) {
      if (!bar) return;
      Array.prototype.forEach.call(bar.querySelectorAll('[' + attr + ']'), function (chip) {
        var on = chip.getAttribute(attr) === value;
        chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        chip.classList.toggle('is-active', on);
      });
    }

    function apply() {
      var words = terms();
      var shown = 0;
      cells.forEach(function (cell) {
        var ok = matches(cell, words);
        cell.hidden = !ok;
        if (ok) shown++;
      });
      machineSections.forEach(function (s) {
        s.hidden = !s.querySelector('[data-cell]:not([hidden])');
      });
      catSections.forEach(function (s) {
        s.hidden = !s.querySelector('[data-machine]:not([hidden])');
      });

      setPressed(catBar, 'data-cat', state.cat);
      setPressed(kindBar, 'data-kind', state.kind);
      if (empty) empty.hidden = shown !== 0;

      if (live) {
        live.textContent = 'Showing ' + shown + ' of ' + cells.length + ' screens'
          + (state.q ? ' matching “' + state.q + '”' : '') + '.';
      }
      writeUrl();
    }

    // Query string, not hash: the hash is already used by the no-JS jump links
    // and by the per-cell anchors on the machine pages.
    function writeUrl() {
      if (!history.replaceState) return;
      var params = new URLSearchParams();
      if (state.cat !== 'all') params.set('cat', state.cat);
      if (state.kind !== 'all') params.set('kind', state.kind);
      if (state.q) params.set('q', state.q);
      var qs = params.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    }

    function readUrl() {
      var params = new URLSearchParams(location.search);
      state.cat = params.get('cat') || 'all';
      state.kind = params.get('kind') || 'all';
      state.q = params.get('q') || '';
      if (q) q.value = state.q;
    }

    function run() {
      if (terms().length && !index) loadIndex().then(apply);
      else apply();
    }

    catBar.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat]');
      if (!chip || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      state.cat = chip.getAttribute('data-cat');
      run();
    });

    if (kindBar) {
      kindBar.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-kind]');
        if (!chip) return;
        state.kind = chip.getAttribute('data-kind');
        run();
      });
    }

    if (q) {
      var timer = null;
      q.addEventListener('focus', loadIndex);
      q.addEventListener('input', function () {
        state.q = q.value.trim();
        clearTimeout(timer);
        timer = setTimeout(run, 120);
      });
      // The native clear button on type=search fires `search` rather than
      // `input` in some browsers.
      q.addEventListener('search', function () { state.q = q.value.trim(); run(); });
    }

    if (reset) {
      reset.addEventListener('click', function () {
        state = { cat: 'all', kind: 'all', q: '' };
        if (q) q.value = '';
        apply();
        var first = catBar.querySelector('[data-cat="all"]');
        if (first) first.focus();
      });
    }

    readUrl();
    if (state.cat !== 'all' || state.kind !== 'all' || state.q) run();
  });
})();
