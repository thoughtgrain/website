/* Theme toggle, warm light / warm dark */
import { ready } from './ready.js';

(function () {
  'use strict';

  var STORAGE_KEY = 'dwt-theme';
  var root = document.documentElement;

  function applyTheme(theme, persist) {
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    // Sun/moon visibility is driven by CSS based on the data-theme attribute
    // (.theme-toggle__sun / .theme-toggle__moon rules in site.css).
    //
    // Only an explicit click is remembered. Writing the system preference
    // into storage on first visit would freeze it there, and a reader who
    // later flips their OS to dark would keep getting light from us.
    if (persist) { try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {} }
  }

  function currentTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (e) {}
    // No choice made: follow the system. The inline script in <head> makes the
    // same decision before first paint; this keeps the toggle in agreement.
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  ready(function () {
    applyTheme(currentTheme());
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  });

  // Apply immediately (before DOMContentLoaded) to avoid flash
  applyTheme(currentTheme());
})();
