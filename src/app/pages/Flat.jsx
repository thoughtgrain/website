/**
 * Flat.jsx: the five standing pages driven by JSON: now, about, learning,
 * gear, colophon.
 *
 * They share nothing but their shape, one config file, one layout, so they're
 * one module with a component each rather than five files of boilerplate.
 * /styles/ is the exception and lives on its own, being a specimen page with no
 * data behind it.
 */

import { content, site } from '../content.js';
import Link from '../Link';
import Html from '../components/Html';

/** Learning resources carry a machine `kind`; this is the pill label. */
const LEARNING_KIND_LABEL = {
  book: 'Book', course: 'Course', talk: 'Talk', paper: 'Paper',
  reading: 'Reading', tool: 'Tool', newsletter: 'Letter',
  community: 'Community', event: 'Event',
};

function PageHeader({ kicker, title, children }) {
  return (
    <header className="page-header page-header--left">
      <span className="kicker">{kicker}</span>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

export function Now() {
  const now = content.data.now || {};
  return (
    <main id="main">
      <div className="container--narrow section">
        <PageHeader kicker="Now" title="What I’m up to, this month.">
          <p className="lead">
            A <a href="https://nownownow.com" target="_blank" rel="noreferrer">now page</a>, in
            the spirit of Derek Sivers. Updated the first of each month. Last revised{' '}
            <strong>{now.updated}</strong>.
          </p>
        </PageHeader>

        <ul className="now-list">
          {(now.items || []).map((item) => (
            <li className="now-item" key={item.label}>
              <div className="now-item__label">{item.label}</div>
              <Html as="p" className="now-item__body" html={item.bodyHtml || item.body} />
            </li>
          ))}
        </ul>

        <div className="now-footer">
          <p className="t-small t-small--muted">
            {site.ownerName}, from a café in the mission. If you’re nearby and want
            coffee, <a href={`mailto:${site.email}`}>say hello</a>.
          </p>
        </div>
      </div>
    </main>
  );
}

export function About() {
  const about = content.data.about || {};
  return (
    <main id="main" className="about">
      <section className="container--narrow section">
        <header className="page-header page-header--left">
          <span className="kicker">About</span>
          <h1 className="about__title">Hello.</h1>
        </header>

        <div className="about__intro">
          <div className="about__portrait" aria-hidden="true">
            <div className="about__portrait-inner">
              <div className="about__portrait-initials">{about.initials}</div>
              <div className="about__portrait-label">portrait, placeholder</div>
            </div>
          </div>
          <div className="about__copy">
            <p className="lead">
              I’m Brian. I lead accessibility at <strong>Superhuman</strong>, which some of
              you will still remember as <strong>Grammarly</strong>. Before that, I was a
              designer at Figma, an engineer at The Guardian, and, for a short, useful
              stretch, a two-person consultancy with a friend.
            </p>
            <p>
              I’ve spent about equal time as a designer, a developer, and a manager of teams
              that include both. The longer I do this, the less those three labels feel like
              separate jobs, they feel like three rooms in the same house, with doors between
              them that I keep propped open.
            </p>
            <p>
              Most of what I care about, professionally, comes back to one word: <em>care</em>.
              Care for the people using the software. Care for the engineers who have to
              maintain it. Care for the systems, the words, the components, the processes,
              that hold a product together when the humans are busy elsewhere.
            </p>
            <p>
              This site is where I think in public. Essays are the long stuff; studies are the
              investigated stuff; <Link to="/notes/">notes</Link> are the unfinished stuff.
              Projects are what I’m actually building. <Link to="/now/">The now page</Link> is
              the short version.
            </p>
          </div>
        </div>
      </section>

      <section className="container section">
        <header className="about__section-head">
          <span className="kicker">Work history</span>
          <h2 className="section__title">What I’ve done, in reverse.</h2>
        </header>

        <ol className="cv">
          {(about.work || []).map((w) => (
            <li className="cv__item" key={`${w.company}-${w.period}`}>
              <div className="cv__period">
                <div className="cv__period-main">{w.period}</div>
                <div className="cv__period-sub">{w.location}</div>
              </div>
              <div className="cv__body">
                <div className="cv__head">
                  <h3 className="cv__role">{w.role}</h3>
                  <div className="cv__company">{w.company}</div>
                </div>
                <p className="cv__note">{w.note}</p>
                {w.highlights?.length > 0 && (
                  <ul className="cv__highlights">
                    {w.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container--narrow section about__closing">
        <h2 className="section__title">Elsewhere</h2>
        <ul className="about__elsewhere">
          {(about.elsewhere || []).map((e) => (
            <li key={e.label}>
              <span className="kicker">{e.label}</span> <a href={e.href}>{e.value}</a>
            </li>
          ))}
        </ul>

        <p className="t-small about__source-note">
          Typeset in Newsreader and Inter. Hand-built, maintained when there is time.
          The site is open-source; <a href="#">the source is here</a>.
        </p>
      </section>
    </main>
  );
}

export function Learning() {
  const learning = content.data.learning || {};
  return (
    <main id="main">
      <div className="container--narrow section">
        <PageHeader kicker="Learning" title="What I’m chasing.">
          <p className="lead">
            A standing log of what I am trying to get better at, why it feels worth the
            time, and the resources I keep returning to. Updated quarterly.
          </p>
        </PageHeader>

        {(learning.topics || []).map((t) => (
          <section className="learning-topic" key={t.topic}>
            <div className="learning-topic__head">
              <h2 className="learning-topic__title">{t.topic}</h2>
              <span className="learning-topic__stage">&middot; {t.stage}</span>
            </div>
            <p className="learning-topic__why">{t.why}</p>
            <ul className="learning-resources">
              {(t.resources || []).map((r, i) => (
                <li className="learning-resource" key={i}>
                  <span className="learning-resource__kind">
                    {LEARNING_KIND_LABEL[r.kind] || r.kind}
                  </span>
                  <span>
                    <span className="learning-resource__label">{r.label}</span>
                    <span className="learning-resource__author">, {r.author}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

export function Gear() {
  const gear = content.data.gear || {};
  return (
    <main id="main">
      <div className="container--narrow section">
        <PageHeader kicker="Gear" title="The tools, honestly.">
          <p className="lead">
            No affiliate links. No carousels. The things I actually use and why, updated
            when something changes, which is rarely.
          </p>
        </PageHeader>

        {(gear.sections || []).map((s) => (
          <section className="gear-section" key={s.section}>
            <h3>{s.section}</h3>
            <ul className="gear-list">
              {(s.items || []).map((g) => (
                <li className="gear-row" key={g.name}>
                  <span className="gear-row__name">{g.name}</span>
                  <p className="gear-row__note">{g.note}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}

export function Colophon() {
  const colophon = content.data.colophon || {};
  const series = content.buildSeries;

  return (
    <main id="main">
      <div className="container--narrow section">
        <PageHeader kicker="Colophon" title="How this site is made.">
          <p className="lead">
            A personal site has a duty to declare its methods. This one does too.
          </p>
        </PageHeader>

        <ul className="colophon-list">
          {(colophon.items || []).map((item) => (
            <li className="colophon-row" key={item.label}>
              <span className="colophon-row__label">{item.label}</span>
              <p className="colophon-row__value">{item.value}</p>
            </li>
          ))}
        </ul>

        {/* The colophon is the index for the build series. It's the only place
            those posts are linked from. */}
        {series.length > 0 && (
          <section className="build-series">
            <h2 className="build-series__heading">How this site was built</h2>
            <p className="build-series__intro">
              A short series on the rules, the bones, the template engine, the content,
              and the deploy.
            </p>
            <ol className="build-series__list">
              {series.map((p) => (
                <li className="build-series__row" key={p.slug}>
                  <Link className="build-series__link" to={p.url}>
                    {p.seriesPart && (
                      <span className="build-series__num">
                        {String(p.seriesPart).padStart(2, '0')}
                      </span>
                    )}
                    <span className="build-series__body">
                      <span className="build-series__title">
                        {p.title.replace(/^Building this site, /, '')}
                      </span>
                      <span className="build-series__dek">{p.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        )}

        <p className="colophon__styles-link">
          For a live specimen of the palette, type, and components,{' '}
          <Link to="/styles/">see the design system ↗</Link>
        </p>

        <p className="t-small colophon__signoff">Thanks for reading the small print.</p>
      </div>
    </main>
  );
}
