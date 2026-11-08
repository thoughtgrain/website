/**
 * Shell.jsx: the frame every page of the OP-XY project sits in.
 *
 * The site's nav stays where it is. Under it, inside <main>, the project gets
 * a masthead of its own: its title (a link back to the study), its status, and
 * a two-item sub-navigation between the case study and the screen archive.
 * That is the whole "project UI": enough to say you have stepped into one
 * thing with two rooms, and no more chrome than that.
 *
 * `.operator` on <main> is also where the monochrome accent is set (see
 * operator.css). Everything inside inherits the device's greys as its accent;
 * the nav and footer outside keep the site's rust.
 */

import Link from '../../Link';

export function OperatorShell({ project, current, trail, children }) {
  const base = `/projects/${project.slug}/`;
  const items = [
    { key: 'study', label: 'Case study', to: base },
    { key: 'screens', label: 'Screens', to: `${base}screens/` },
  ];

  return (
    <main id="main" className="operator">
      <header className="operator-mast container">
        <div className="operator-mast__row">
          <Link className="operator-mast__title" to={base}>{project.title}</Link>
          <Link className="operator-mast__up" to="/projects/">All projects</Link>
        </div>
        <nav className="operator-subnav" aria-label={`${project.title} sections`}>
          <ul>
            {items.map((it) => (
              <li key={it.key}>
                <Link to={it.to} {...(current === it.key ? { 'aria-current': 'page' } : {})}>{it.label}</Link>
              </li>
            ))}
            {/* On a machine page the trail names where in the archive you are,
                so the sub-nav reads "Screens / Kiln" without a third level. */}
            {trail && <li className="operator-subnav__trail" aria-current="location">{trail}</li>}
          </ul>
        </nav>
      </header>
      {children}
    </main>
  );
}
