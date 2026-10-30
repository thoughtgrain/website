/**
 * Styles.jsx — /styles/, the design-system specimen.
 *
 * This one keeps its original HTML rather than becoming JSX. It's 369 lines of
 * static markup whose entire job is to demonstrate the stylesheet — no data, no
 * logic, and `{{basePath}}` is the only thing in it that varies. Hand-converting
 * that to JSX would be several hundred lines of transcription risk in exchange
 * for nothing, so it's imported as raw text and rendered as-is.
 *
 * If the specimen ever grows real behaviour, that's the moment to convert it.
 */

import specimen from '../../src/layouts/styles.html?raw';
import { useBase } from '../base.js';
import Html from '../components/Html.jsx';

export default function Styles() {
  const base = useBase();
  // The one substitution the old template engine did for this page.
  const html = specimen.replaceAll('{{basePath}}', base);
  return <Html html={html} />;
}
