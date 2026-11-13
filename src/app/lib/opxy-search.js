/**
 * opxy-search.js: the text behind every screen, flattened for a filter box.
 *
 * Pure: manifest in, index out. The build emits the result as
 * /opxy/search.json and src/js/opxy-filter.js fetches it the first time someone
 * types in the search field on the screens page. The page itself carries only
 * the cells, so the full text (subjects, control notes, risks, patterns,
 * drawing languages) costs nothing until it is asked for.
 *
 * Shape, which the filter script depends on:
 *
 *   { version, machines: { <id>: "haystack" }, cells: { <id>: ["haystack", …] } }
 *
 * `cells[id][i]` is the text for cell `i` of that machine, the same `i` as
 * `data-i` on the page. A cell matches a query when every term appears in its
 * own text or its machine's.
 */

const norm = (parts) => parts
  .flat(Infinity)
  .filter((x) => x != null && x !== '')
  .map(String)
  .join(' ')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

export function searchIndex(manifest) {
  if (!manifest) return null;
  const machines = {};
  const cells = {};

  for (const m of manifest.machines) {
    const cat = manifest.categories[m.category] || {};
    machines[m.id] = norm([
      m.id, m.name, m.category, cat.label, cat.singular, m.kind,
      m.description, m.concept, m.soundsLike,
      (m.controls || []).map((c) => [c.id, c.label]),
    ]);
    cells[m.id] = m.cells.map((c) => norm([
      c.name, c.control, c.pass, c.passKind, c.passState, c.variant, c.reason,
      c.subject, c.controls, c.risks, c.pattern, c.patternName, c.drawingLanguage, c.angle,
      c.alt,
    ]));
  }

  return { version: manifest.version, machines, cells };
}
