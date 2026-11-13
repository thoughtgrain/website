/**
 * opxy-words.js: the word-overlap measure design_pass_submit uses, in JS.
 *
 * A port of `_words` and `overlap` in operator-design's mcp/opxy_mcp/passes.py,
 * kept exact so the demonstration can highlight the very words the server
 * counted when it decided two subjects were different enough. Lowercase,
 * runs of [a-z0-9], minus a short stopword list and anything under three
 * letters; overlap is shared words over all words (Jaccard). Two empty sets
 * count as identical (1.0), as on the server.
 *
 * Pure. The test in scripts/ checks it reproduces every overlap the server
 * recorded.
 */

const STOP = new Set((
  'a an the of and or to in on at by for with as is its it this that into from each every one their them '
  + 'be are was were than then so which who what where when how per'
).split(' '));

/** The set of words a subject is compared on. */
export function wordsOf(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().match(/[a-z0-9]+/g) || []) {
    if (!STOP.has(w) && w.length > 2) out.add(w);
  }
  return out;
}

/** Shared words over all words, as design_pass_submit measures it. */
export function overlap(a, b) {
  const wa = wordsOf(a);
  const wb = wordsOf(b);
  if (!wa.size || !wb.size) return 1;
  let shared = 0;
  wa.forEach((w) => { if (wb.has(w)) shared += 1; });
  return shared / (wa.size + wb.size - shared);
}

/** The words two subjects share, for highlighting. */
export function sharedWords(a, b) {
  const wb = wordsOf(b);
  return new Set([...wordsOf(a)].filter((w) => wb.has(w)));
}

/**
 * A subject split into runs, each marked if it is a counted word in `shared`.
 * Splitting on the same [a-z0-9] runs the measure uses keeps the highlights
 * honest: "1:1" is three runs and none of them counts, exactly as on the
 * server.
 */
export function markRuns(text, shared) {
  return String(text || '').split(/([A-Za-z0-9]+)/).filter((s) => s !== '').map((s) => ({
    text: s,
    hit: shared.has(s.toLowerCase()),
  }));
}
