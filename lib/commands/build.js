'use strict';

/**
 * commands/build.js — `node build.js` with no arguments, and what serve.js calls.
 *
 * Scan then render, which is what the old single-shot build did — just with the
 * two halves now separable, observable, and resumable.
 *
 * This is the path CI takes (.github/workflows/pages.yml runs bare
 * `node build.js`), so it must work with no flags and no network.
 */

const scan = require('./scan');
const render = require('./render');
const log = require('../log');

/**
 * @param {object} args Parsed CLI flags.
 * @returns {Promise<object>} Render stats.
 */
async function run(args) {
  args = args || {};
  scan.run(args);
  log.blank();
  return render.run(args);
}

module.exports = { run };
