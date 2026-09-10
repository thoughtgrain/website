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
 */

/**
 * @param {string[]} argv Raw arguments, normally `process.argv.slice(2)`.
 * @returns {object} Parsed flags plus a `_` array of positional arguments.
 */
function parse(argv) {
  // `_` always exists so callers can read `args._[0]` without a guard.
  const out = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    // Not a flag — it's a positional (the command name, usually).
    if (token.slice(0, 2) !== '--') {
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
    if (value === null && argv[i + 1] && argv[i + 1].slice(0, 2) !== '--') {
      value = argv[i + 1];
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

module.exports = { parse };
