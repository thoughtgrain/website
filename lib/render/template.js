'use strict';

/**
 * render/template.js — the template engine.
 *
 * Three constructs, nothing more:
 *
 *   {{variable}}            simple and dot-path lookups
 *   {{#each array}}…{{/each}}
 *   {{#if key}}…{{/if}}
 *
 * ## Why each construct runs in a loop
 *
 * Each pass is a regex replace, and each regex is written to match the
 * INNERMOST block of its kind (the `(?!\{\{#each\s)` guard). Running it once
 * only resolves the innermost level, so each construct repeats until the output
 * stops changing — that's how nesting works without writing a real parser.
 *
 * The plain `{{key}}` pass loops for a different reason: a substitution can
 * inject markup that itself contains placeholders. `{{drawerNavHtml}}` expands
 * into nav HTML that references `{{basePath}}`, and without a second pass that
 * would ship to the browser as a literal `{{basePath}}` — a bug this site has
 * actually had.
 *
 * ## Why there's an iteration cap
 *
 * Those loops were previously unbounded `do…while`s. A template or a data value
 * that keeps re-introducing a placeholder (say, content containing the literal
 * text `{{drawerNavHtml}}`) would spin forever with no output and no error —
 * indistinguishable from a hang. On a phone, where a stalled process just gets
 * killed, that reads as "the build silently did nothing".
 *
 * MAX_PASSES is generous: real templates here converge in two or three. Hitting
 * it means something is genuinely wrong, so it throws with the offending
 * placeholder named rather than looping.
 */

const { renderValue } = require('./escape');

// Far above what any legitimate template needs; low enough to fail fast.
const MAX_PASSES = 50;

/**
 * Run `fn` over the output until it stops changing, or until MAX_PASSES.
 *
 * @param {string} label Construct name, used in the error message.
 * @param {string} input
 * @param {function(string): string} fn One pass.
 * @returns {string}
 */
function untilStable(label, input, fn) {
  let output = input;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const previous = output;
    output = fn(output);
    if (output === previous) return output;
  }
  // Surface the first placeholder still present — it's almost always the cause.
  const stuck = (output.match(/\{\{[^}]{0,60}\}\}/) || ['(unknown)'])[0];
  throw new Error(
    'template: ' + label + ' did not settle after ' + MAX_PASSES + ' passes; ' +
    'stuck on ' + stuck + '. This usually means a value expands to text that ' +
    'contains its own placeholder.'
  );
}

/**
 * Render `template` against `data`.
 *
 * @param {string} template
 * @param {object} data
 * @returns {string}
 */
function renderTemplate(template, data) {
  let output = template;

  // ---- {{#each key}} … {{/each}} ------------------------------------------
  // Each item is rendered against the parent data merged with the item, so a
  // loop body can reach both its own fields and page-level ones like basePath.
  const eachRe = /\{\{#each\s+(\w+)\}\}((?:(?!\{\{#each\s)[\s\S])*?)\{\{\/each\}\}/g;
  output = untilStable('{{#each}}', output, function (current) {
    return current.replace(eachRe, function (_, key, block) {
      const arr = data[key];
      // A missing or non-array value renders nothing rather than throwing —
      // optional sections are common and shouldn't need an {{#if}} wrapper.
      if (!Array.isArray(arr)) return '';
      return arr.map(function (item) {
        return renderTemplate(block, Object.assign({}, data, item));
      }).join('');
    });
  });

  // ---- {{#if key}} … {{/if}} ----------------------------------------------
  // Same innermost-first loop. Without it, the non-greedy match grabs the first
  // {{/if}} it sees — on a nested block that's the INNER close, which leaves the
  // outer close and any trailing markup orphaned in the output.
  const ifRe = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if\s)[\s\S])*?)\{\{\/if\}\}/g;
  output = untilStable('{{#if}}', output, function (current) {
    return current.replace(ifRe, function (_, key, block) {
      return data[key] ? renderTemplate(block, data) : '';
    });
  });

  // ---- {{a.b.c}} ----------------------------------------------------------
  // Dot paths resolve in a single pass; they're only used for the structured
  // JSON config, which never nests placeholders inside itself.
  output = output.replace(/\{\{([\w.]+)\}\}/g, function (match, keyPath) {
    if (!keyPath.includes('.')) return match; // simple keys handled below
    const parts = keyPath.split('.');
    let val = data;
    for (let i = 0; i < parts.length; i++) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        val = val[parts[i]];
      } else {
        return '';
      }
    }
    return renderValue(keyPath, val);
  });

  // ---- {{key}} ------------------------------------------------------------
  // Unknown keys are left as literal text rather than blanked, so a typo shows
  // up in the page instead of vanishing.
  output = untilStable('{{key}}', output, function (current) {
    return current.replace(/\{\{(\w+)\}\}/g, function (match, key) {
      if (!(key in data)) return match;
      return renderValue(key, data[key]);
    });
  });

  return output;
}

module.exports = { renderTemplate, MAX_PASSES };
