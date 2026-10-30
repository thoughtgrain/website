/**
 * TagFilter.jsx — the tag chip bar above a writing index.
 *
 * Chips are real links to /<kind>/tag/<slug>/, and every tag page renders the
 * FULL list with non-matching cards marked hidden. So without JS a chip
 * navigates to a statically filtered page, and with JS the tag-filter enhancer
 * intercepts the click and toggles `hidden` in place. Same markup serves both —
 * it costs a little page weight and buys a filter that works with JS disabled.
 *
 * Tags are the union across every item of the kind, so the bar doesn't reshuffle
 * as you filter. There are no KIND chips; the route already says which kind
 * you're looking at.
 */

import { relativeHref, useRoute } from '../base.js';
import { collectTags, slugifyTag } from '../lib/content-model.js';

function Chip({ href, label, tag, active }) {
  return (
    <a
      className={`filter-bar__btn${active ? ' is-active' : ''}`}
      href={href}
      data-tag={tag}
      aria-pressed={active ? 'true' : 'false'}
      {...(active ? { 'aria-current': 'page' } : {})}
    >
      {label}
    </a>
  );
}

export default function TagFilter({ items, kindLabel, dir, activeTag }) {
  if (!items.length) return null;
  const tags = collectTags(items);
  if (!tags.length) return null;

  const route = useRoute();
  // Every chip is resolved from the page it sits on, so the bar links correctly
  // from /essays/ and from /essays/tag/<slug>/ alike — the two sit at different
  // depths and a single shared prefix can only be right on one of them.
  const kindHref = (path) => relativeHref(route, `/${dir}/${path}`);
  const labelId = `tag-filter-label-${kindLabel.toLowerCase()}`;
  const liveId = `tag-filter-live-${kindLabel.toLowerCase()}`;

  return (
    <div className="filter-row" data-tag-filter="">
      <span id={labelId} className="filter-row__label">Filter {kindLabel} by tag</span>
      <div className="filter-bar filter-bar--tags" role="group" aria-labelledby={labelId}>
        <Chip href={kindHref('')} label="All" tag="all" active={!activeTag} />
        {tags.map((t) => (
          <Chip
            key={t}
            href={kindHref(`tag/${slugifyTag(t)}/`)}
            label={t}
            tag={t}
            active={activeTag === t}
          />
        ))}
      </div>
      {/* Empty in the HTML; the enhancer writes "N essays" here after a filter,
          so screen reader users hear the result of a click that otherwise
          changes nothing announced. */}
      <p id={liveId} className="visually-hidden" aria-live="polite" aria-atomic="true" />
    </div>
  );
}
