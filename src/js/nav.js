/* Drawer dialog, full-screen menu */
import { ready } from './ready.js';

(function () {
  'use strict';

  ready(function () {
    var openBtn = document.getElementById('menu-open');
    var closeBtn = document.getElementById('menu-close');
    var dialog = document.getElementById('site-menu-dialog');
    var heading = document.getElementById('site-menu-dialog-heading');
    if (!openBtn || !dialog) return;

    var inertEls = [];

    // Everything beside the drawer gets `inert` while it's open, so the page
    // behind can't be tabbed into or read by a screen reader.
    //
    // Walk the dialog's OWN siblings, not document.body's children: the shell
    // is a React tree under #root now, so the dialog's siblings are the nav,
    // the page and the footer, while body's only child is #root, which
    // contains the dialog, is skipped by the guard below, and would leave
    // nothing marked at all.
    function markBackgroundInert() {
      inertEls = [];
      var siblings = dialog.parentElement ? dialog.parentElement.children : [];
      Array.prototype.forEach.call(siblings, function (el) {
        if (el === dialog) return;
        if (el.contains(dialog)) return;
        el.setAttribute('inert', '');
        el.setAttribute('aria-hidden', 'true');
        inertEls.push(el);
      });
    }

    function clearBackgroundInert() {
      inertEls.forEach(function (el) {
        el.removeAttribute('inert');
        el.removeAttribute('aria-hidden');
      });
      inertEls = [];
    }

    function open() {
      dialog.hidden = false;
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      markBackgroundInert();
      requestAnimationFrame(function () {
        if (heading && typeof heading.focus === 'function') heading.focus();
      });
      document.addEventListener('keydown', onKey);
    }

    function close() {
      dialog.hidden = true;
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      clearBackgroundInert();
      document.removeEventListener('keydown', onKey);
      if (typeof openBtn.focus === 'function') openBtn.focus();
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      var focusables = dialog.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea'
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    openBtn.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);
  });
})();
