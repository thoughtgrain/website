/**
 * FeedLink.jsx — the "Subscribe to …" pill in a section header.
 *
 * Its own line in the page header so it reads as a quiet invitation, distinct
 * from the small RSS link in the footer.
 */

import { relativeHref, useRoute } from '../base.js';

export default function FeedLink({ href, label }) {
  const route = useRoute();
  return (
    <p className="page-header__feed">
      <a className="page-feed-link" href={relativeHref(route, href)}>
        <svg className="page-feed-link__icon" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
        </svg>
        <span>Subscribe to {label}</span>
      </a>
    </p>
  );
}
