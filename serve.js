#!/usr/bin/env node

/**
 * serve.js — the development server.
 *
 * Serves dist/ over HTTP, watches src/, rebuilds on change, and pushes a reload
 * to open browsers over Server-Sent Events. Zero dependencies, like everything
 * else here.
 *
 * ## Two bugs this file used to have
 *
 * 1. **It ran two builds on every start.** build.js called `build()` at module
 *    load AND exported it, with no `require.main === module` guard. So line 1's
 *    `require('./build')` kicked off build #1, and the explicit call below
 *    started build #2 — two concurrent builds, each of which began by deleting
 *    dist/. I measured it: one `node serve.js` produced 128 write lines for a
 *    64-file site. On a fast disk they mostly serialise; on a slow sandboxed one
 *    they interleave, and you get a half-built or empty site. Both halves are
 *    fixed now: build.js has the guard, and this file builds exactly once.
 *
 * 2. **`fs.watch(recursive: true)` was unguarded.** Where the platform doesn't
 *    support it, that throws and takes the server down at startup. It's now
 *    wrapped, with an mtime poller as the fallback (lib/watch-poll.js).
 *
 * ## Flags
 *
 *   --no-watch     serve without rebuilding on change
 *   --port <n>     override the port (or PORT=…)
 *   --host <addr>  bind address; defaults to localhost. Pass 0.0.0.0 to reach
 *                  the server from another device on the network.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const args = require('./lib/args').parse(process.argv.slice(2));
const log = require('./lib/log');
const { DIST, SRC } = require('./lib/config');
const manifest = require('./lib/manifest');
const buildCommand = require('./lib/commands/build');
const layouts = require('./lib/render/layouts');
const components = require('./lib/parse/components');
const watchPoll = require('./lib/watch-poll');

log.configure(args);

const PORT = args.port || process.env.PORT || 3000;
// Default to loopback: a dev server binding every interface by default is a
// surprise, especially on a phone sharing a café network. --host 0.0.0.0 is the
// deliberate opt-in.
const HOST = args.host || process.env.HOST || '127.0.0.1';

// Debounce window for rebuilds. An editor save often touches a file more than
// once; this collapses that into one build.
const REBUILD_DEBOUNCE_MS = 150;

// ---------------------------------------------------------------------------
// MIME types. Anything not listed is served as a binary download, which is a
// safer default than guessing.
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.xsl': 'application/xslt+xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// ---------------------------------------------------------------------------
// Live reload over Server-Sent Events.
//
// SSE rather than a WebSocket because it's one-directional (the server only
// ever says "reload") and needs no handshake library — `res.write` on a
// long-lived response is the entire protocol.
// ---------------------------------------------------------------------------
let sseClients = [];

function sendReload() {
  sseClients.forEach(function (res) { res.write('data: reload\n\n'); });
}

// Injected before </body> in every HTML response. The error handler reloads
// after a pause so the page recovers by itself when the server restarts.
const RELOAD_SCRIPT = `
<script>
(function() {
  var es = new EventSource('/__sse');
  es.onmessage = function(e) {
    if (e.data === 'reload') window.location.reload();
  };
  es.onerror = function() {
    es.close();
    setTimeout(function() { window.location.reload(); }, 2000);
  };
})();
</script>
`;

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------
const server = http.createServer(function (req, res) {
  if (req.url === '/__sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: connected\n\n');
    sseClients.push(res);
    req.on('close', function () {
      sseClients = sseClients.filter(function (c) { return c !== res; });
    });
    return;
  }

  // The site uses directory-style URLs (/notes/, /essays/on-craft/), so a path
  // with no file extension maps to that directory's index.html.
  let urlPath = req.url.split('?')[0];
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  if (!path.extname(urlPath)) urlPath += '/index.html';

  const filePath = path.join(DIST, urlPath);

  // path.join normalises away any ../ in the URL, so this catches a traversal
  // attempt after normalisation rather than trying to pattern-match it before.
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      // The /index.html we appended may have been wrong — the URL might name a
      // real file with no extension. Try it as-is before giving up.
      const altPath = path.join(DIST, req.url.split('?')[0]);
      if (altPath.startsWith(DIST) && fs.existsSync(altPath) && fs.statSync(altPath).isFile()) {
        res.writeHead(200, {
          'Content-Type': MIME[path.extname(altPath)] || 'application/octet-stream',
        });
        res.end(fs.readFileSync(altPath));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1><p>' + req.url + '</p>');
      return;
    }

    const ext = path.extname(filePath);
    let content = data;
    if (ext === '.html') {
      content = data.toString().replace('</body>', RELOAD_SCRIPT + '</body>');
    }

    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

// ---------------------------------------------------------------------------
// Rebuild on change
// ---------------------------------------------------------------------------
let rebuildTimer = null;
let rebuilding = false;

function scheduleRebuild(filename) {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(function () {
    // Never start a build while one is running. The old double-build race is
    // exactly the failure mode this guards against, in a different form.
    if (rebuilding) return;
    rebuilding = true;

    log.line('watch', 'change detected: ' + filename);

    // Layouts and components are cached for the life of the process, so edits to
    // them need the caches dropped or the rebuild renders the old markup.
    layouts.invalidate();
    components.invalidate();

    buildCommand.run(args).then(function () {
      sendReload();
    }).catch(function (e) {
      log.error('watch', 'build error: ' + e.message);
    }).then(function () {
      rebuilding = false;
    });
  }, REBUILD_DEBOUNCE_MS);
}

/**
 * Start watching src/.
 *
 * Prefers the native recursive watcher and falls back to mtime polling, which
 * is what makes this work in sandboxed runtimes where fs.watch isn't available.
 */
function startWatching() {
  if (args.watch === false) {
    log.line('serve', 'watching disabled (--no-watch)');
    return;
  }

  try {
    fs.watch(SRC, { recursive: true }, function (eventType, filename) {
      if (!filename) return;
      scheduleRebuild(filename);
    });
    log.line('serve', 'watching src/ for changes');
  } catch (err) {
    const found = manifest.load();
    if (!found) {
      log.warn('serve', 'fs.watch unavailable (' + err.code + ') and no manifest to poll; ' +
        'run `node build.js scan` and restart to enable watching');
      return;
    }
    watchPoll.watch(found, scheduleRebuild);
    log.line('serve', 'fs.watch unavailable (' + err.code + '), polling src/ every ' +
      watchPoll.DEFAULT_INTERVAL + 'ms instead');
  }
}

// ---------------------------------------------------------------------------
// Start: build once, then listen.
// ---------------------------------------------------------------------------
log.line('serve', 'building...');

buildCommand.run(args).then(function () {
  startWatching();
  server.listen(PORT, HOST, function () {
    log.line('serve', 'http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT);
  });
}).catch(function (e) {
  log.error('serve', 'initial build failed: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
