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
import { Demo, Machine, ProjectLinks } from './Demo';
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

        <PagesList project={project} />
      </article>
    </main>
  );
}

/**
 * A folder project's pages, under its body: `projects/06-lamp/` holds
 * `index.mdx` (the project) and any other .mdx beside it (these). Nothing
 * renders for a one-file project.
 */
function PagesList({ project }) {
  if (!project.pages || !project.pages.length) return null;
  return (
    <nav className="project-pages" aria-labelledby="project-pages-title">
      <h2 id="project-pages-title" className="project-pages__title">In this project</h2>
      <ol className="project-pages__list">
        {project.pages.map((pg) => (
          <li key={pg.slug}>
            <Link to={pg.url}>{pg.title}</Link>
            {pg.summary && <span className="project-pages__summary">{pg.summary}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** /projects/:slug/:page/, one page of a folder project, read like the project itself. */
function ProjectPage({ project, page }) {
  const at = project.pages.indexOf(page);
  const prev = project.pages[at - 1];
  const next = project.pages[at + 1];
  return (
    <main id="main">
      <article className="reader reader--wide">
        <Link className="btn btn--link reader__back" to={`/projects/${project.slug}/`}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12,19 5,12 12,5" /></svg>
          <span className="reader__back-label">{project.title}</span>
        </Link>

        <div className="reader__kicker"><span className="kicker">{project.title} &middot; {at + 1} of {project.pages.length}</span></div>
        <h1>{page.title}</h1>
        {page.summary && <p className="lead">{page.summary}</p>}

        <div className="reader__body prose"><page.Body components={mdxComponents} /></div>

        <nav className="reader__pager" aria-label={`Other pages in ${project.title}`}>
          {prev ? <Link to={prev.url} rel="prev">&larr; {prev.title}</Link> : <Link to={`/projects/${project.slug}/`} rel="prev">&larr; {project.title}</Link>}
          {next ? <Link to={next.url} rel="next">{next.title} &rarr;</Link> : <span />}
        </nav>
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

/**
 * /projects/:slug/:child/ is a walk project's machine or a folder project's page.
 * The two can't collide: buildContent refuses pages on a walk project.
 */
export function ProjectChild({ route }) {
  const [, slug, child] = route.split('/').filter(Boolean);
  const project = content.projects.find((p) => p.slug === slug);
  if (project && hasWalk(project)) return <Machine route={route} />;
  const page = project && (project.pages || []).find((p) => p.slug === child);
  if (!page) return <main id="main"><div className="container section"><h1>Not found</h1></div></main>;
  return <ProjectPage project={project} page={page} />;
}
