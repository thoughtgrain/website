# The build, and how to run it on a phone

I wrote this because the build broke in a way that took me a while to
understand, and the fix changed the shape of the whole thing. If you only ever
run `node build.js` on a laptop, you can stop after the first section. The rest
is for when that isn't enough.

## The short version

```sh
node build.js        # scan + render everything → dist/
node serve.js        # dev server on http://localhost:3000, live reload
```

That's still the whole story on a normal machine. Nothing about the everyday
path changed.

## What broke

I edit this site from my phone, in Code App, which runs a sandboxed Node on the
device. Two things went wrong there, and both had the same root cause: the build
was a single, indivisible, all-or-nothing unit of work.

**The build deleted `dist/` before it wrote anything.** The very first statement
of the old `build()` was:

```js
fs.rmSync(DIST, { recursive: true, force: true });
```

which is fine right up until the process doesn't finish. iOS kills long-running
work, and when it did, I was left with an empty or half-populated `dist/`. I
measured the old build with a stopwatch and a `timeout`:

| killed at | files left in `dist/` |
| --------- | --------------------- |
| 0.10s     | 13                    |
| 0.13s     | 50                    |
| 0.20s     | 64 (finished)         |

Thirteen files. That's "it builds a few files and then nothing" exactly.

**And `node serve.js` ran two builds at once.** `build.js` called `build()` at
module load *and* exported it, with no `require.main === module` guard. So
`serve.js`'s `require('./build')` started build #1, and the explicit `build()`
call a few lines later started build #2. Two concurrent builds, each opening
with that `rmSync`. On a fast disk they mostly serialise and you never notice;
on a slow sandboxed one they interleave and you get a site with holes in it.
One `node serve.js` produced 128 write lines for a 64-file site — I counted.

## What changed

### Nothing gets deleted up front

Every output now goes through one writer (`lib/fsx.js`). It records each path it
writes, and skips the write entirely when the bytes on disk already match. Stale
files are removed at the **end** of a run, and only when that run finished every
group.

The upshot: an interrupted build leaves the previous site standing, partially
updated. Worst case is a stale page, never a blank site. The same table as above,
after the change, reads 64 files at every kill point.

It also makes rebuilds cheap. A one-line content edit rewrites one or two files
and reports the rest as unchanged:

```
[render] done       64 files    87ms  (4 written, 60 unchanged)
```

### Gathering and iterating are separate commands

This is the split I actually wanted. `scan` walks the input directories and
writes `.cache/manifest.json` — a plain list of every content file, layout,
component, stylesheet and script, with sizes and mtimes. `render` reads that list
and renders it.

```sh
node build.js scan       # gather
node build.js render     # iterate
```

Why bother, when the whole build takes 90ms here? Because `readdir` is the call
most likely to be denied or come back empty in a sandbox, and when that happened
the old code turned it into silence — `parseMdxDir` swallowed a missing directory
with `return []`, and you got a site with no content and no error. Now
enumeration happens once, in a command short enough that nothing kills it midway,
and it *reports what it found*:

```
[scan] articles   7 files     0ms
[scan] projects   2 files     0ms
[scan] notes      3 files     0ms
...
[scan] wrote .cache/manifest.json  (23 content files, 7ms)
```

An empty collection is now something you can see.

### Rendering happens in resumable groups

The old 1,354-line `build()` is now ten group modules under `lib/pages/`, and
`render` walks them, checkpointing to `.cache/state.json` after each one.

```sh
node build.js render --list              # what the groups are
node build.js render --group writing     # render just one
node build.js render --resume            # skip what's already done
```

Each group gets a fully-derived context (see `lib/context.js`), so **any group
can run alone, in any order, in its own process**. That's the phone workflow:

```sh
node build.js scan
node build.js render --group assets
node build.js render --group home
node build.js render --group notes
# ... and so on
```

Each invocation is a few milliseconds of actual work, tells you what's left, and
records its progress:

```
[render] notes      4 files     3ms
[render] 7 groups still pending: writing, series, projects, flat, enjoying, products, feeds
```

When the last group lands, the checkpoint flips to complete and pruning runs —
so the chunked path ends up in exactly the same place as `node build.js`, and I
verified the output is byte-identical between the two.

If a run does get killed partway, `node build.js render --resume` picks up where
it stopped.

### The network is opt-in now

One product hero image is fetched from the product page's `og:image` at build
time. That used to happen on **every** build, with an 8-second socket timeout,
whether or not there was a cache — and the cache directory it checked didn't
exist in the repo, so it never hit. A live network round trip in the middle of an
otherwise entirely local build is the other thing that stalls on a phone.

Now it only runs when asked:

```sh
node build.js --fetch-images
FETCH_PRODUCT_IMAGES=1 node build.js   # same thing, easier to type on a phone
```

Otherwise it uses whatever is cached in `src/assets/products/` and falls back to
a typographic placeholder, which is a perfectly good page. CI never needs the
network.

### The dev server survives a missing `fs.watch`

`fs.watch(dir, { recursive: true })` is the only platform-gated API in here. Where
it isn't supported it throws `ERR_FEATURE_UNAVAILABLE_ON_PLATFORM` or `ENOSYS`,
and it used to take the server down at startup. It's wrapped now, with an mtime
poller as the fallback — which polls exactly the files the manifest lists, so it
doesn't walk directories on every tick either.

```
[serve] fs.watch unavailable (ERR_FEATURE_UNAVAILABLE_ON_PLATFORM), polling src/ every 1000ms instead
```

## Command reference

| Command | What it does |
| ------- | ------------ |
| `node build.js` | scan + render everything (what CI runs) |
| `node build.js scan` | gather inputs into `.cache/manifest.json` |
| `node build.js render` | render the manifest into `dist/` |
| `node build.js clean` | prune `dist/` against the last complete build |
| `node serve.js` | dev server with live reload |

| Flag | What it does |
| ---- | ------------ |
| `--group <id>` | render one group only |
| `--resume` | skip groups a previous run finished |
| `--list` | print the groups and stop |
| `--verbose` | log every path, not just per-group counts |
| `--quiet` | warnings and errors only |
| `--fetch-images` | allow the network for product hero images |
| `--no-prune` | keep files this build didn't write |
| `--no-watch` | (serve) don't rebuild on change |
| `--host 0.0.0.0` | (serve) bind all interfaces, to reach it from another device |
| `--port <n>` | (serve) override the port |

## Where the code lives

```
build.js                    CLI entry: parse argv, dispatch to a command
serve.js                    dev server

lib/
  config.js                 paths, content dirs, CSS/JS order
  args.js                   tiny argv parser
  log.js                    progress reporting
  fsx.js                    write-then-prune writer  ← the durability fix
  manifest.js               scan: gather inputs
  state.js                  render checkpoint
  context.js                the derive step  ← what makes groups independent

  parse/                    frontmatter, markdown, components, content files
  render/                   escape, template engine, layouts, nav, helpers,
                            plus the shared writing / notes / series blocks
  net/                      the opt-in HTTP client and image grabber
  pages/                    one module per output group; index.js is the registry
  commands/                 scan, render, build, clean
  watch-poll.js             the fs.watch fallback
```

Every file has a header saying what it is and why it exists. If you're following
the flow for the first time: `build.js` → `lib/commands/build.js` →
`lib/commands/render.js` → `lib/context.js` → `lib/pages/index.js`.

## Adding a page group

1. Write `lib/pages/<name>.js` exporting `{ id, label, run(ctx) }`.
2. Add `require('./<name>')` to the array in `lib/pages/index.js`.

That's it. It gets a checkpoint, a progress line, and `--group` support for free.
`ctx.emit(relPath, layoutName, data)` renders through the inner layout and
`base.html` and writes the result.
