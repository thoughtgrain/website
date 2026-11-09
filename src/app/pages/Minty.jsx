/**
 * Minty.jsx: the two Minty projects.
 *
 *   layout: minty       the case study, /projects/minty/
 *   layout: minty-demo  the hands-on page, /projects/minty-demo/
 *
 * Both sit in the project shell with Minty's mint accent, and link to each
 * other from the masthead. Their bodies are MDX; the figures inside them are
 * components/minty/figures.jsx, drawn from Minty's own measurements.
 */

import { content } from '../content.js';
import Link from '../Link';
import { mdxComponents } from '../components/mdx';
import { OperatorShell } from '../components/operator/Shell';
import { Pedal } from '../components/minty/figures';
import { ProjectLinks } from './Demo';

const bySlug = (slug) => (slug ? content.projects.find((p) => p.slug === slug) || null : null);

export function MintyStudy({ project }) {
  const demo = bySlug(project.demo);
  const tagsJoined = [project.tag1, project.tag2, project.tag3].filter(Boolean).join(' · ');
  return (
    <OperatorShell project={project} theme="minty" related={demo ? { label: 'Turn the knobs', to: `/projects/${demo.slug}/` } : null}>
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
          extra={demo ? <Link className="operator-links__a operator-links__a--demo" to={`/projects/${demo.slug}/`}>{demo.title}</Link> : null}
        />
        <Pedal interactive={false} caption="The Endless with Minty loaded. Minty gets the three knobs, the LED, and the left footswitch, which knows a press from a hold. The right footswitch is the pedal’s own on and off." />
        <div className="reader__body prose"><project.Body components={mdxComponents} /></div>
      </article>
    </OperatorShell>
  );
}

export function MintyDemo({ project }) {
  const study = bySlug(project.caseStudy);
  return (
    <OperatorShell project={project} theme="minty" related={study ? { label: 'Read the case study', to: `/projects/${study.slug}/` } : null}>
      <div className="container section">
        <header className="page-header page-header--left">
          <span className="kicker">{project.label || 'Hands on'}</span>
          <h1>{project.title}</h1>
          <p className="lead">{project.summary}</p>
          <ProjectLinks project={project} />
        </header>
        <div className="walk prose">
          <project.Body components={mdxComponents} />
        </div>
      </div>
    </OperatorShell>
  );
}
