/**
 * Html.jsx: render a string of already-parsed markdown.
 *
 * The markdown parser produces HTML strings, so somewhere has to hand them to
 * the DOM. Isolating that in one named component means every unescaped insertion
 * in the app is one grep away, instead of `dangerouslySetInnerHTML` appearing in
 * a dozen page files.
 *
 * Safe here because the only input is my own content files, parsed by my own
 * markdown parser, not anything a visitor can supply.
 */

export default function Html({ html, as: Tag = 'div', ...rest }) {
  return <Tag {...rest} dangerouslySetInnerHTML={{ __html: html || '' }} />;
}
