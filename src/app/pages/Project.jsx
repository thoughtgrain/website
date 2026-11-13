/**
 * Project.jsx: /projects/:slug/
 *
 * Three shapes of page share this route, chosen by the frontmatter's
 * `layout`. The default is the plain case-study reader: plate, kicker, body.
 * `operator` is the OP-XY case study, in its own masthead with the device's
 * greys as its accent. `walk` is the OP-XY demonstration, a separate project
 * that walks through the server's sessions (see Demo.jsx). The dispatch is
 * here rather than in routes.jsx because the URL has the same shape for all
 * three. `minty` is the Minty project page (see Minty.jsx); its hands-on
 * figures are in an essay, linked from it.
 */

import { content } from '../content.js';
import { hasWalk } from '../lib/content-model.js';
import Link from '../Link';
import { mdxComponents } from '../components/mdx';
import { OperatorShell } from '../components/operator/Shell';
import { Sprite } from '../components/operator/Sprite';
import { machineById } from '../opxy.js';
import { Demo, ProjectLinks } from './Demo';
import { MintyStudy } from './Minty';

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
  const demo = project.demo ? content.projects.find((p) => p.slug === project.demo) : null;

  return (
    <OperatorShell project={project} related={demo ? { label: 'See the demonstration', to: `/projects/${demo.slug}/` } : null}>
      <article className="reader operator-study">
        <div className="reader__kicker"><span className="kicker">{project.status}</span></div>
        <h1>{project.title}</h1>
        <p className="lead">{project.summary}</p>
        <div className="reader__meta">
          <span className="kicker">{project.year}</span>
          {tagsJoined && <span className="kicker">&middot; {tagsJoined}</span>}
        </div>
        <ProjectLinks
          project={project}
          extra={demo ? <Link className="operator-links__a operator-links__a--demo" to={`/projects/${demo.slug}/`}>Watch it design a screen</Link> : null}
        />

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

  if (hasWalk(project)) return <Demo route={route} />;
  if (project.layout === 'minty') return <MintyStudy project={project} />;
  if (project.layout === 'operator') return <OperatorProject project={project} />;
  return <PlainProject project={project} />;
}
