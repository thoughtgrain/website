'use strict';

/**
 * args.js — a deliberately tiny argv parser.
 *
 * There is no dependency budget here (the whole project is Node stdlib only), so
 * rather than pull in a flag library this handles the four shapes the build CLI
 * actually uses and nothing else:
 *
 *   node build.js render --group writing    → { _: ['render'], group: 'writing' }
 *   node build.js render --group=writing    → same
 *   node build.js render --resume           → { _: ['render'], resume: true }
 *   node build.js render --no-prune         → { _: ['render'], prune: false }
 *
 * Anything that isn't a flag lands in `_`, positionally.
 *
 * ## The iOS smart-punctuation trap
 *
 * This parser used to test for a literal `--` prefix, and that quietly broke
 * every command I typed on my phone. iOS autocorrect converts two hyphens into
 * an EM DASH as you type — in the terminal as much as anywhere else — so what
 * actually reached the process was:
 *
 *   node build.js render —group notes
 *
 * which parsed as the `render` command with NO group flag and a stray
 * positional. The result: a "render one group" command silently rendered the
 * whole site, and `—resume` silently started over. The workflow I built
 * specifically for that device had never once worked there.
 *
 * So the first thing `parse` does is normalise the Unicode dashes iOS
 * substitutes back into ASCII hyphens, and strip smart quotes off values. A CLI
 * that only accepts characters its user's keyboard won't produce is a CLI with
 * a bug, not a user with a bad keyboard.
 */

/**
 * Characters iOS (and most word processors) substitute for a run of hyphens.
 *   U+2014 EM DASH        — what `--` becomes
 *   U+2013 EN DASH        – what `-` sometimes becomes between words
 *   U+2212 MINUS SIGN     − occasionally produced by numeric keyboards
 *   U+2012 FIGURE DASH    ‒ rare, included for completeness
 *   U+2010/U+2011 HYPHEN  ‐ ‑ typographic hyphens, not ASCII
 */
const DASHES = '—–−‒‐‑';
const LEADING_DASH_RE = new RegExp('^[-' + DASHES + ']+');

/** Smart quote pairs iOS substitutes for ' and ". */
const SMART_QUOTES = /[‘’“”]/g;

/**
 * Turn a token's leading dash run into a plain `--`.
 *
 * Every leading run collapses to exactly two hyphens, whatever it was made of.
 * That's safe here because this CLI has **no short flags** — there is no `-g`
 * to distinguish from `--group` — so a leading dash of any kind, in any
 * quantity, can only have been an attempt at a long flag. `—group`, `–group`,
 * `-group` and `--group` all mean the same thing, and now all parse that way.
 *
 * @param {string} token
 * @returns {string}
 */
function normaliseDashes(token) {
  const match = token.match(LEADING_DASH_RE);
  if (!match) return token;
  return '--' + token.slice(match[0].length);
}

/** Strip smart quotes a keyboard substituted for plain ones. */
function unsmartQuotes(s) {
  return s.replace(SMART_QUOTES, function (q) {
    return (q === '“' || q === '”') ? '"' : "'";
  });
}

/**
 * Remove a matched pair of surrounding quotes.
 *
 * A shell normally does this, but a value pasted or autocorrected on a phone can
 * arrive with the quotes still attached.
 */
function unquote(s) {
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' || first === "'") && first === last) return s.slice(1, -1);
  }
  return s;
}

/** Normalise one raw argv token before any parsing decisions are made. */
function normaliseToken(token) {
  return unquote(unsmartQuotes(normaliseDashes(String(token))));
}

/** Does this token look like a flag, after normalisation? */
function isFlag(token) {
  return token.slice(0, 2) === '--';
}

/**
 * @param {string[]} argv Raw arguments, normally `process.argv.slice(2)`.
 * @returns {object} Parsed flags plus a `_` array of positional arguments.
 */
function parse(argv) {
  // `_` always exists so callers can read `args._[0]` without a guard.
  const out = { _: [] };

  // Normalise everything up front, so the flag/positional decisions below and
  // the lookahead on the next token both see the same, already-fixed text.
  const tokens = argv.map(normaliseToken);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Not a flag — it's a positional (the command name, usually).
    if (!isFlag(token)) {
      out._.push(token);
      continue;
    }

    // Strip the leading `--` and split on the first `=`, so `--group=writing`
    // and `--group writing` both work.
    let body = token.slice(2);
    let value = null;
    const eq = body.indexOf('=');
    if (eq !== -1) {
      value = body.slice(eq + 1);
      body = body.slice(0, eq);
    }

    // `--no-prune` is the negated form of `--prune`. Recognising it explicitly
    // means a flag can default to true and still be switched off.
    if (body.slice(0, 3) === 'no-') {
      out[camel(body.slice(3))] = false;
      continue;
    }

    // `--group writing`: no `=`, and the next token isn't itself a flag, so
    // treat that next token as this flag's value and skip past it.
    if (value === null && tokens[i + 1] && !isFlag(tokens[i + 1])) {
      value = tokens[i + 1];
      i++;
    }

    // A flag with no value at all is a boolean switch.
    out[camel(body)] = value === null ? true : value;
  }

  return out;
}

/** `fetch-images` → `fetchImages`, so flags read naturally in JS. */
function camel(s) {
  return s.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
}

/**
 * Describe a token's non-ASCII characters by codepoint.
 *
 * Used by the run-log header and `build.js doctor`: when a flag goes missing,
 * seeing `—group (U+2014 EM DASH)` in a file is the difference between a
 * five-minute diagnosis and an hour of guessing.
 *
 * @param {string} token
 * @returns {string} '' when the token is plain ASCII.
 */
function describeNonAscii(token) {
  const found = [];
  for (const ch of String(token)) {
    const code = ch.codePointAt(0);
    if (code < 128) continue;
    const hex = 'U+' + code.toString(16).toUpperCase().padStart(4, '0');
    const name = DASHES.indexOf(ch) !== -1 ? ' dash'
      : SMART_QUOTES.test(ch) ? ' smart quote'
        : '';
    SMART_QUOTES.lastIndex = 0; // the regex is /g; reset after each test
    found.push(ch + ' ' + hex + name);
  }
  return found.join(', ');
}

module.exports = { parse, normaliseToken, describeNonAscii };
