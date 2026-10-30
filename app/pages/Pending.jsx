/**
 * Pending.jsx — a route whose page component hasn't been ported yet.
 *
 * Temporary, and visibly so. Every one of the fifty routes is generated and
 * served from the first build, which means navigation and the shell can be
 * tested before all 27 layouts exist. Each of these disappears as its page
 * lands; when the list in routes.jsx is complete, this file goes too.
 */

export default function Pending({ route }) {
  return (
    <main id="main">
      <div className="container--narrow section">
        <header className="page-header page-header--left">
          <span className="kicker">Not ported yet</span>
          <h1>{route}</h1>
          <p className="lead">
            This route is generated and routed; its page component is still being
            moved over from the old layouts.
          </p>
        </header>
      </div>
    </main>
  );
}
