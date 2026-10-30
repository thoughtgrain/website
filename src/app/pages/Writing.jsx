/**
 * Writing.jsx: /essays/, /studies/ and their tag pages.
 *
 * One component for both kinds and both shapes. A tag page renders every item
 * and hides the ones that don't match, which is what lets the filter work
 * without JS; see TagFilter for the reasoning.
 */

import { content } from '../content.js';
import { slugifyTag } from '../lib/content-model.js';
import Link from '../Link';
import FeedLink from '../components/FeedLink';
import TagFilter from '../components/TagFilter';

const META = {
  essays: {
    kicker: 'Essays',
    heading: 'Essays',
    dek: 'Long-form writing. Published slowly, revised often. The ones I’d still send to a friend.',
    empty: 'No essays yet.',
    kindLabel: 'essays',
  },
  studies: {
    kicker: 'Studies',
    heading: 'Studies',
    dek: 'Short, investigated pieces. Each one answers a specific question, usually with a small data set and a stronger opinion than the data deserves.',
    empty: 'No studies yet.',
    kindLabel: 'studies',
  },
};

function Card({ item, hidden }) {
  return (
    <Link
      className="essay-card"
      to={item.url}
      data-tags={item.tagList.join('|')}
      {...(hidden ? { hidden: true } : {})}
    >
      <div className="essay-card__meta">
        <span className="kicker">{item.kind}</span>
        <span className="essay-card__date">{item.date} &middot; {item.read}</span>
      </div>
      <h3 className="essay-card__title">{item.title}</h3>
      <p className="essay-card__dek">{item.summary}</p>
      <div className="essay-card__tags">
        {item.tagList.map((t) => <span className="tag" key={t}>{t}</span>)}
      </div>
    </Link>
  );
}

export default function Writing({ route }) {
  const segments = route.slice(1, -1).split('/');
  const dir = segments[0];
  const meta = META[dir];
  const items = content[dir];

  // /essays/tag/<slug>/, resolve the slug back to the tag it came from.
  const tagSlug = segments[1] === 'tag' ? segments[2] : null;
  const activeTag = tagSlug
    ? items.flatMap((i) => i.tagList).find((t) => slugifyTag(t) === tagSlug) || null
    : null;

  const matches = (item) => !activeTag || item.tagList.includes(activeTag);
  const matchCount = items.filter(matches).length;

  return (
    <main id="main">
      <div className="container section">
        <header className="page-header page-header--left">
          <span className="kicker">{meta.kicker}</span>
          <h1>{activeTag ? `${meta.heading} · ${activeTag}` : meta.heading}</h1>
          <p className="lead">{activeTag ? `Filtered to ${activeTag}. ${meta.dek}` : meta.dek}</p>
          <FeedLink href={`/${dir}/feed.xml`} label={meta.kindLabel} />
        </header>

        <TagFilter items={items} kindLabel={meta.kindLabel} dir={dir} activeTag={activeTag} />

        <div className="essay-list" data-tag-target="">
          {items.map((item) => (
            <Card item={item} hidden={!matches(item)} key={item.slug} />
          ))}
          {matchCount === 0 && (
            <p className="empty-state">
              {activeTag ? `No ${meta.kindLabel} tagged ${activeTag}.` : meta.empty}
            </p>
          )}
          <p className="empty-state" data-tag-empty="" hidden>
            No items match that tag. <a className="btn btn--link" data-tag-reset="" href="">Show all</a>
          </p>
        </div>
      </div>
    </main>
  );
}
