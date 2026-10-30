/**
 * mdx.jsx: the components content is allowed to use.
 *
 * Content writes `<Pullquote text="…" cite="…" />` in a .mdx file. Under real
 * MDX those tags compile to JSX, and MDX throws at render for any name it
 * can't resolve, `_missingMdxReference("Pullquote", true)`, so every one of
 * them has to be in scope. This map is what provides them, handed to the MDX
 * body as its `components` prop.
 *
 * These are ports of the `{{prop}}` templates that used to live in
 * src/components/*.html and get expanded by string substitution. The markup is
 * kept identical because the stylesheet is keyed to these exact class names.
 *
 * `text` arrives as a plain string and React escapes it, which is the right
 * default and a change from the old templates, those interpolated raw, so a
 * pull quote could contain `<em>`. None currently does; if one needs to, it
 * should be written as real markdown inside the tag rather than as HTML in an
 * attribute.
 */

import { demoComponents } from './demos';

export function Dropcap({ text }) {
  return <p className="dropcap">{text}</p>;
}

export function Pullquote({ text, cite }) {
  return (
    <blockquote className="pullquote">
      {text}
      <span className="pullquote__cite">{cite}</span>
    </blockquote>
  );
}

export function PullquoteNoCite({ text }) {
  return <blockquote className="pullquote">{text}</blockquote>;
}

export function MarginaliaPin({ text, rotate }) {
  return (
    <span className="marginalia-pin marginalia-pin--right">
      <span
        className="marginalia marginalia--rotated"
        style={{ '--marginalia-rotate': `${rotate}deg` }}
      >
        {text}
      </span>
    </span>
  );
}

export function Footnote({ id }) {
  return (
    <sup>
      <a
        href={`#fn${id}`}
        id={`ref${id}`}
        className="footnote-ref"
        aria-label={`Footnote ${id}, see source`}
      >
        [{id}]
      </a>
    </sup>
  );
}

/**
 * Passed to every MDX body as its `components` prop.
 *
 * The demos are the interactive figures the build series uses. They're the only
 * stateful components in the app, see demos.jsx for the three rules that come
 * with that.
 */
export const mdxComponents = {
  Dropcap, Pullquote, PullquoteNoCite, MarginaliaPin, Footnote,
  ...demoComponents,
};
