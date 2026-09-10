#!/usr/bin/env node

/**
 * build.js — the CLI entry point.
 *
 * This file used to be 1,890 lines. It's now a dispatcher; the work lives in
 * lib/, one module per concern, so each piece is small enough to read on a
 * phone. Start at lib/commands/build.js if you're following the flow.
 *
 * ## Commands
 *
 *   node build.js                    scan + render everything
 *   node build.js scan               gather inputs → .cache/manifest.json
 *   node build.js render             iterate the manifest → dist/
 *   node build.js clean              prune dist/ against the last complete build
 *   node build.js status             what's done and what's left, no building
 *
 * ## Flags
 *
 *   --group <id>      render one group only (see --list for the ids)
 *   --resume          skip groups a previous run already checkpointed as done
 *   --list            print the groups and what each covers, then stop
 *   --verbose         log every file path, not just per-group counts
 *   --quiet           warnings and errors only
 *   --fetch-images    allow the network (product hero images); off by default
 *   --no-prune        keep files the build didn't write
 *
 * ## Why scan and render are separate
 *
 * Running this in Code App on iOS, a single long build gets killed partway —
 * and the old version deleted dist/ before writing anything, so a kill left an
 * empty site. Splitting enumeration from rendering means each command is short,
 * every group checkpoints, and a killed run resumes instead of restarting from
 * nothing. See lib/commands/render.js for the mechanics.
 *
 * ## Why progress also goes to a file
 *
 * That same runtime shows no stdout at all, so every line is mirrored to
 * .cache/build.log and .cache/status.txt, which are readable in an editor pane.
 * See lib/log.js — it's also why nothing here calls process.exit().
 *
 * The module also exports `build` for serve.js. It only auto-runs when invoked
 * directly — the `require.main === module` guard at the bottom. Without that
 * guard, `require('./build')` started a second concurrent build, which is what
 * made `node serve.js` run two builds racing over the same directory.
 */

'use strict';

const args = require('./lib/args');
const log = require('./lib/log');

const COMMANDS = {
  scan: require('./lib/commands/scan'),
  render: require('./lib/commands/render'),
  build: require('./lib/commands/build'),
  clean: require('./lib/commands/clean'),
  status: require('./lib/commands/status'),
};

/**
 * Run one command.
 * @param {string[]} argv Normally process.argv.slice(2).
 */
async function main(argv) {
  const parsed = args.parse(argv);
  log.configure(parsed);

  // No positional argument means the default full build.
  const name = parsed._[0] || 'build';

  if (name === 'help' || parsed.help) {
    printUsage();
    return;
  }

  const command = COMMANDS[name];
  if (!command) {
    log.error('build', 'unknown command "' + name + '"');
    printUsage();
    process.exitCode = 1;
    return;
  }

  // Start the run log before any work, so a failure in the first few lines is
  // still captured to .cache/build.log even when nothing reaches the terminal.
  log.openRun([name].concat(argv.filter(function (a) { return a !== name; })).join(' '));
  try {
    await command.run(parsed);
  } catch (err) {
    // Handled here rather than by the caller so the failure is written BEFORE
    // closeRun's finish marker — a log that ends mid-stack with the reason above
    // the footer is a lot easier to read than one where they're inverted.
    log.error('build', 'failed: ' + (err && err.stack ? err.stack : err));
    process.exitCode = 1;
  } finally {
    log.closeRun(__dirname);
  }
}

function printUsage() {
  // Through the logger, not console.log, so usage text takes the same
  // synchronous write path as everything else — see lib/log.js.
  [
    'Usage: node build.js [command] [flags]',
    '',
    'Commands:',
    '  (none)     scan + render everything',
    '  scan       gather inputs into .cache/manifest.json',
    '  render     render the manifest into dist/',
    '  clean      prune dist/ against the last complete build',
    '  status     what is done and what is left, without building',
    '',
    'Flags:',
    '  --group <id>    render a single group (--list to see them)',
    '  --resume        skip groups already checkpointed as done',
    '  --list          list the groups and exit',
    '  --verbose       log every path written',
    '  --quiet         warnings and errors only',
    '  --fetch-images  allow network fetches for product images',
    '  --no-prune      keep files this build did not write',
    '',
    'Progress is also written to .cache/build.log and .cache/status.txt,',
    'which are readable when a terminal is not.',
  ].forEach(log.raw);
}

// Only run when invoked directly. serve.js requires this module for `build`,
// and without this guard that require would kick off a whole second build.
if (require.main === module) {
  // main() already reports command failures; this only catches anything thrown
  // before it gets that far (a bad argv, a module that won't load).
  main(process.argv.slice(2)).catch(function (err) {
    log.error('build', 'failed: ' + (err && err.stack ? err.stack : err));
    // NOT process.exit(1): that discards anything still buffered on stdout, so
    // on a runtime where writes are async the error message you most need is
    // the one you lose. Setting exitCode lets Node exit once output has drained.
    process.exitCode = 1;
  });
}

// Exported for serve.js. Takes the same parsed-args object the CLI uses.
module.exports = { build: COMMANDS.build.run, main: main };
