/**
 * Projects.jsx — /projects/ and /projects/cat/<slug>/
 *
 * Projects are organised two ways at once, on purpose: by LIFECYCLE on the
 * index, because the first question about someone's project list is "what's
 * still alive"; and by CATEGORY at /projects/cat/<slug>/, for people who came
 * looking for one kind of work. The category pages are a filtered view of the
 * same tiles, rendered statically so they work without JS.
 */

import { content } from '../content.js';
import { MAKING_CATEGORIES } from '../lib/content-model.js';
import Link from '../Link';
import FeedLink from '../components/FeedLink';

/** Lifecycle buckets, in display order. */
const GROUPS = [
  { key: 'in-flight', label: 'In flight' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'paused', label: 'Paused' },
];

/**
 * Map a free-text `status:` onto a bucket. Matched loosely because the field is
 * prose and may carry a leading symbol. Untagged work counts as live rather than
 * hidden — a missing status far more often means "I forgot" than "this is dead".
 */
function bucketFor(status) {
  const s = String(status || '').toLowerCase();
  if (/in progress|ongoing|maintained/.test(s)) return 'in-flight';
  if (/shipped/.test(s)) return 'shipped';
  if (/paused|shelved|archived/.test(s)) return 'paused';
  return 'in-flight';
}

function Tile({ project }) {
  return (
    <Link className="project-tile" to={`/projects/${project.slug}/`}>
      <div className={`project-tile__plate project-tile__plate--${project.plate || 'cocoa'}`}>
        <div className="project-tile__glyph">{project.glyph || ''}</div>
        <div className="project-tile__plate-label">{project.label || ''}</div>
      </div>
      <div className="project-tile__body">
        <div className="project-tile__meta">
          <span className="kicker">{project.status || ''}</span>
          <span className="project-tile__year">{project.year || ''}</span>
        </div>
        <h4 className="project-tile__title">{project.title || ''}</h4>
        <p className="project-tile__blurb">{project.summary || ''}</p>
      </div>
    </Link>
  );
}

function Groups({ list }) {
  return GROUPS.map((g) => {
    const members = list.filter((p) => bucketFor(p.status) === g.key);
    // An empty bucket renders nothing at all — no orphan heading.
    if (!members.length) return null;
    return (
      <section className="projects-group" key={g.key}>
        <h3 className="projects-group__label">
          {g.label} <span className="projects-group__count">{members.length}</span>
        </h3>
        <div className="grid grid--projects">
          {members.map((p) => <Tile project={p} key={p.slug} />)}
        </div>
      </section>
    );
  });
}

export default function Projects({ route }) {
  const segments = route.slice(1, -1).split('/');
  const catSlug = segments[1] === 'cat' ? segments[2] : null;
  const category = catSlug ? MAKING_CATEGORIES.find((c) => c.slug === catSlug) : null;

  const list = category
    ? content.projects.filter(
        (p) => String(p.category || '').toLowerCase() === category.label.toLowerCase(),
      )
    : content.projects;

  return (
    <main id="main">
      <div className="container section">
        <header className="page-header page-header--left">
          <span className="kicker">Making</span>
          <h1>{category ? category.label : 'All projects'}</h1>
          <p className="lead">
            {category
              ? category.dek
              : 'Things I’ve made, or am still making. Filter by category in the menu, or read them all below.'}
          </p>
          {!category && <FeedLink href="/projects/feed.xml" label="projects" />}
        </header>

        {/* A real but unpopulated category says so, rather than 404ing or
            showing an empty grid. */}
        {category && list.length === 0 && (
          <p className="t-small page-empty">
            Nothing in this category yet, but it’s a real corner of the site.
          </p>
        )}

        <Groups list={list} />
      </div>
    </main>
  );
}
