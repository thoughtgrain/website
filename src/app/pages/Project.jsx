/**
 * Project.jsx — /projects/:slug/
 */

import { content } from '../content.js';
import Link from '../Link.jsx';
import Html from '../components/Html.jsx';

export default function Project({ route }) {
  const slug = route.split('/').filter(Boolean)[1];
  const project = content.projects.find((p) => p.slug === slug);
  if (!project) return <main id="main"><div className="container section"><h1>Not found</h1></div></main>;

  // Tags joined into one string rather than looped, so the meta row reads as a
  // single kicker — "tag · tag · tag" — instead of several fragments.
  const tagsJoined = [project.tag1, project.tag2, project.tag3].filter(Boolean).join(' · ');

  return (
    <main id="main">
      <article className="reader reader--wide">
        <Link className="btn btn--link reader__back" to="/projects/">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" /></svg>
          <span className="reader__back-label">All projects</span>
        </Link>

        <div className="reader__kicker"><span className="kicker">{project.status}</span></div>
        <h1>{project.title}</h1>
        <p className="lead">{project.summary}</p>
        <div className="reader__meta">
          <span className="kicker">{project.year}</span>
          {tagsJoined && <span className="kicker">&middot; {tagsJoined}</span>}
        </div>

        <div className={`project-plate project-plate--${project.plate}`}>
          <div className="project-plate__glyph">{project.glyph}</div>
          <div className="project-plate__label">{project.label}</div>
        </div>

        <Html className="reader__body prose" html={project.bodyHtml} />
      </article>
    </main>
  );
}
