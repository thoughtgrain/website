/**
 * Project.jsx: /projects/:slug/
 *
 * Two shapes of page share this route. The default is the plain case-study
 * reader: plate, kicker, body. A project whose frontmatter says
 * `layout: operator` is the OP-XY screen design work, which carries its own
 * sub-navigation (the study and the screen archive) and a monochrome accent in
 * place of the site's rust, so the pages read as one project rather than as
 * one more article. The dispatch is here, on the frontmatter, rather than in
 * routes.jsx, because the URL is the same either way.
 */

import { content } from '../content.js';
import { hasScreens } from '../lib/content-model.js';
import Link from '../Link';
import { mdxComponents } from '../components/mdx';
import { OperatorShell } from '../components/operator/Shell';
import { Sprite } from '../components/operator/Sprite';
import { machineById } from '../opxy.js';

function PlainProject({ project }) {
  // Tags joined into one string rather than looped, so the meta row reads as a
  // single kicker, "tag · tag · tag", instead of several fragments.
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

        <div className="reader__body prose"><project.Body components={mdxComponents} /></div>
      </article>
    </main>
  );
}

/**
 * The case study, inside the project's own shell.
 *
 * The plate is replaced by the hero machine's rest frame at the device's own
 * proportions: the project is about those screens, so the first thing on the
 * page is one of them rather than a coloured rectangle standing in for it.
 */
function OperatorProject({ project }) {
  const hero = project.heroMachine ? machineById(project.heroMachine) : null;
  const rest = hero && hero.cells.find((c) => c.kind === 'frame' && c.name === 'rest');
  const tagsJoined = [project.tag1, project.tag2, project.tag3].filter(Boolean).join(' · ');

  return (
    <OperatorShell project={project} current="study">
      <article className="reader operator-study">
        <div className="reader__kicker"><span className="kicker">{project.status}</span></div>
        <h1>{project.title}</h1>
        <p className="lead">{project.summary}</p>
        <div className="reader__meta">
          <span className="kicker">{project.year}</span>
          {tagsJoined && <span className="kicker">&middot; {tagsJoined}</span>}
          {project.repo && (
            <a className="kicker operator-study__repo" href={project.repo} rel="noopener">Source on GitHub</a>
          )}
        </div>

        {rest && (
          <figure className="operator-hero">
            <Sprite machine={hero} cell={rest} lazy={false} />
            <figcaption>{hero.name} at rest, as it draws on the OP-XY&rsquo;s 480 by 220 screen.</figcaption>
          </figure>
        )}

        <div className="reader__body prose"><project.Body components={mdxComponents} /></div>
      </article>
    </OperatorShell>
  );
}

export default function Project({ route }) {
  const slug = route.split('/').filter(Boolean)[1];
  const project = content.projects.find((p) => p.slug === slug);
  if (!project) return <main id="main"><div className="container section"><h1>Not found</h1></div></main>;

  return hasScreens(project)
    ? <OperatorProject project={project} />
    : <PlainProject project={project} />;
}
