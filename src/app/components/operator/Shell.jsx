/**
 * Shell.jsx: the frame every page of the OP-XY project sits in.
 *
 * The site's nav stays where it is. Under it, inside <main>, the project gets
 * a masthead of its own: the project's title and, on the pages beneath it, a
 * trail saying where you are ("Watch it design a screen / Kiln"). The case
 * study and the demonstration are separate projects that link to each other
 * from here, not tabs of one page.
 *
 * `.operator` on <main> is also where the monochrome accent is set (see
 * operator.css). Everything inside inherits the device's greys as its accent;
 * the nav and footer outside keep the site's rust.
 */

import Link from '../../Link';

/**
 * @param {object} props
 * @param {object} props.project  the project entry
 * @param {Array<{label: string, to: string}>} [props.trail]  pages above this one, nearest last
 * @param {string} [props.here]  this page's name, when it is not the project's own page
 * @param {{label: string, to: string}} [props.related]  the sibling project: the case study or the demonstration
 * @param {string} [props.theme]  an extra class on <main> for a project's own accent (`minty`)
 */
export function OperatorShell({ project, trail = [], here, related, theme, children }) {
  const base = `/projects/${project.slug}/`;
  const crumbs = [{ label: project.title, to: base }, ...trail];

  return (
    <main id="main" className={`operator${theme ? ` ${theme}` : ''}`}>
      <header className="operator-mast container">
        <div className="operator-mast__row">
          {here ? (
            <nav className="operator-trail" aria-label="You are here">
              <ol>
                {crumbs.map((c) => (
                  <li key={c.to}><Link to={c.to}>{c.label}</Link></li>
                ))}
                <li aria-current="page">{here}</li>
              </ol>
            </nav>
          ) : (
            <span className="operator-mast__title">{project.title}</span>
          )}
          <span className="operator-mast__links">
            {related && <Link className="operator-mast__up operator-mast__related" to={related.to}>{related.label}</Link>}
            <Link className="operator-mast__up" to="/projects/">All projects</Link>
          </span>
        </div>
      </header>
      {children}
    </main>
  );
}
