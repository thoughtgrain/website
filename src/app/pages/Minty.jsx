/**
 * Minty.jsx: the Minty project page, /projects/minty/ (`layout: minty`).
 *
 * The project shell with Minty's mint accent: the story of how it was built,
 * with a still drawing of the pedal and two charts from its measurements. The
 * hands-on figures (the pedal you can play, every curve, the audio) are in an
 * essay, named by the project's `essay` frontmatter and linked from the
 * masthead, the links row and the body.
 */

import { content } from '../content.js';
import Link from '../Link';
import { mdxComponents } from '../components/mdx';
import { OperatorShell } from '../components/operator/Shell';
import { Pedal } from '../components/minty/pedal';
import { ProjectLinks } from './Demo';

const essayBySlug = (slug) => (slug ? content.articles.find((a) => a.slug === slug) || null : null);

export function MintyStudy({ project }) {
  const essay = essayBySlug(project.essay);
  const tagsJoined = [project.tag1, project.tag2, project.tag3].filter(Boolean).join(' · ');
  return (
    <OperatorShell project={project} theme="minty" related={essay ? { label: 'Turn the knobs', to: essay.url } : null}>
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
          extra={essay ? <Link className="operator-links__a operator-links__a--demo" to={essay.url}>{essay.title}</Link> : null}
        />
        <Pedal interactive={false} caption="The Endless with Minty loaded. Minty gets the three knobs, the LED, and the left footswitch, which knows a press from a hold. The right footswitch is the pedal’s own on and off." />
        <div className="reader__body prose"><project.Body components={mdxComponents} /></div>
      </article>
    </OperatorShell>
  );
}
