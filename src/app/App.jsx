/**
 * App.jsx — the page shell every route renders inside.
 *
 * This is base.html from the old generator, as a component. The markup is kept
 * deliberately identical because 112 KB of CSS is keyed to these class names and
 * this structure — `site-nav__inner`, `drawer__body`, `site-footer__groups` and
 * the rest. Changing the shape here means changing the stylesheet, so don't,
 * unless that's the job.
 *
 * The inline SVGs stay inline rather than becoming an icon sprite: they're two
 * icons used once each, and a sprite would be indirection for its own sake.
 */

import { BaseContext } from './base.js';
import { site, nav } from './content.js';
import Link from './Link.jsx';
import { pageFor } from './routes.jsx';

/** The drawer menu: grouped sections, each with a label and a note. */
function DrawerNav() {
  return nav.groups.map((group) => {
    const items = (group.items || []).filter((it) => it.enabled);
    // An entirely disabled group renders nothing — no orphan heading.
    if (!items.length) return null;

    const titleId = `drawer-grp-${group.id}`;
    return (
      <section key={group.id} aria-labelledby={titleId}>
        <h3 id={titleId} className="drawer__group-title">{group.label}</h3>
        <ul className="drawer__list">
          {items.map((it) => (
            <li key={it.href}>
              <Link className="drawer__item" to={`/${it.href.replace(/^\//, '')}`}>
                <span className="drawer__item-label">{it.label}</span>
                <span className="drawer__item-note">{it.note || ''}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  });
}

/** The footer menu: same groups, flatter, plus the RSS and email links. */
function FooterNav() {
  return nav.groups.map((group) => {
    const items = (group.items || []).filter((it) => it.enabled);
    if (!items.length) return null;

    const titleId = `footer-grp-${group.id}`;
    // RSS and Email hang off the About group rather than getting a column of
    // their own — two links don't justify one.
    const extras = group.id === 'about' ? (nav.footerExtras || []) : [];

    return (
      <section className="site-footer__group" key={group.id} aria-labelledby={titleId}>
        <h2 id={titleId} className="site-footer__group-title">{group.label}</h2>
        <ul>
          {items.map((it) => (
            <li key={it.href}>
              <Link to={`/${it.href.replace(/^\//, '')}`}>{it.label}</Link>
            </li>
          ))}
          {extras.map((ex) => {
            const href = ex.href.replace('{{email}}', site.email || '');
            // mailto: is already absolute; everything else needs the depth prefix.
            return (
              <li key={ex.label}>
                {href.startsWith('mailto:')
                  ? <a href={href}>{ex.label}</a>
                  : <Link to={`/${href.replace(/^\//, '')}`}>{ex.label}</Link>}
              </li>
            );
          })}
        </ul>
      </section>
    );
  });
}

export default function App({ route, base }) {
  const Page = pageFor(route);

  return (
    <BaseContext.Provider value={{ route, base }}>
      <a href="#main" className="skip-link">Skip to content</a>

      <nav className="site-nav site-nav--drawer" aria-label="Primary">
        <div className="site-nav__inner">
          <Link className="site-nav__home" to="/" aria-label="Home">Home</Link>
          <div className="site-nav__links">
            <button id="theme-toggle" className="site-nav__theme" type="button" aria-label="Toggle theme">
              <svg className="theme-toggle__moon" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
              <svg className="theme-toggle__sun" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
            </button>
            <button
              id="menu-open"
              className="site-nav__menu-btn"
              type="button"
              aria-haspopup="dialog"
              aria-expanded="false"
              aria-controls="site-menu-dialog"
            >
              <span>Menu</span>
              <svg className="icon icon--trailing" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
          </div>
        </div>
      </nav>

      <div
        id="site-menu-dialog"
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="site-menu-dialog-heading"
        hidden
      >
        <div className="drawer__head">
          <h2 id="site-menu-dialog-heading" className="drawer__heading" tabIndex={-1}>Browse</h2>
          <button id="menu-close" className="site-nav__menu-btn" type="button" aria-label="Close menu">
            <span>Close</span>
            <svg className="icon icon--trailing" aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="drawer__body"><DrawerNav /></div>
      </div>

      <Page route={route} />

      <footer className="site-footer">
        <div className="site-footer__groups"><FooterNav /></div>
        <div className="site-footer__credit">
          <span>&copy; 2021&ndash;2026 {site.ownerName}</span>
          <span>&middot;</span>
          <span>Set in Newsreader &amp; Inter</span>
        </div>
      </footer>
    </BaseContext.Provider>
  );
}
