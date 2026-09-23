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

## The em dash that ate every flag

This one cost me a while, so it goes first.

I ran `node build.js --help` on the phone to test whether output worked at all,
and got nothing. What I had actually typed was `—help` — an **em dash**. iOS
autocorrect turns two hyphens into one as you type, and it does it in the
terminal as readily as anywhere else.

The parser only recognised a literal `--`, so every flag I'd ever typed on that
device was being silently discarded:

| what I typed | what the parser did |
| ------------ | ------------------- |
| `—help` | a positional named `"—help"`, not the help flag |
| `render —group notes` | `render` with **no group flag** → rendered all 64 files |
| `render —resume` | flag dropped → started over instead of resuming |

So the chunked, one-group-at-a-time workflow I built specifically for the phone
had never once worked there. It was quietly rendering the whole site every time
and I had no way to see that it was.

Three fixes, and I'd argue the third is the real one:

**The parser normalises dashes now.** `lib/args.js` converts any leading run of
em dash, en dash, minus sign or typographic hyphen into `--` before it decides
anything. That's safe because this CLI has no short flags — there's no `-g` to
distinguish from `--group` — so a leading dash of any shape can only have been
an attempt at a long flag. Smart quotes get stripped off values too. `—group`,
`–group`, `-group` and `--group` all work.

**The log names the character.** Every run's header records `argv` verbatim and
describes anything non-ASCII by codepoint:

```
# argv: "—help"
#   non-ascii in "—help": — U+2014 dash
```

If a flag goes missing again, that line says why in one glance.

**And the commands don't need flags any more.** Fighting autocorrect for every
`--` is a bad deal, so the things I actually do on a phone are plain words:

```sh
node build.js step            # render the next pending group, then stop
node build.js resume          # continue an interrupted run
node build.js render notes    # positional, same as --group notes
```

`step` is the one to remember. Run it, it does one group and tells you what's
left. Run it again, it does the following one. No flags, no group ids to
memorise, and ten short commands get you a complete site — byte-identical to
what a single `node build.js` produces, which I check.

## When the terminal shows nothing

On my phone I get no build output at all — not a truncated tail, nothing. That
reframed the original problem: the build never *looked* silent because it was
silent, it looked silent because I was never seeing its stdout. The only way I
could tell it had done anything was to open `dist/` in the file browser.

Three changes, in order of how much they help.

**Every line is written synchronously.** Node only guarantees synchronous writes
to stdout for a TTY, and for pipes on Linux. Anywhere else a pipe write is
asynchronous and buffered, and a process that ends before the buffer drains loses
whatever was queued. So `lib/log.js` writes with `fs.writeSync` rather than
`console.log` — unbuffered, lands before the next statement runs, with an EAGAIN
retry for a full pipe.

**Nothing calls `process.exit()` any more.** It discards that buffer outright, so
a *failing* build could emit literally nothing — the one moment you actually need
the message. Both call sites now set `process.exitCode` and let Node exit once
output has drained.

**And the terminal isn't the only channel.** If the host simply doesn't wire
stdout to its terminal pane, flushing can't help. So every run also writes:

- **`build.log`** — the complete output of the last run, truncated at the start
  of each one so it never grows without bound. Includes the failure and stack
  trace when there is one, and the `argv` header described above.
- **`build-status.txt`** — a four-line snapshot of what's done and what's left,
  rewritten *after every group*, so it's accurate even for a run that got killed
  partway. That's the case it's really for.

Both sit at the **repo root**, not in `.cache/`. They used to be in `.cache/`,
and that was a mistake: a directory whose name starts with a dot is hidden by
default in most file browsers, so the fallback channel I'd added for a broken
terminal was itself invisible on the one device that needed it. `.cache/` keeps
`manifest.json` and `state.json` — machine state I never read by hand. Anything
meant for a person goes where a person will see it.

```
build status — 2026-09-10 21:14
  done     assets, home, notes
  pending  writing, series, projects, flat, enjoying, products, feeds
  3 of 10 groups, 8 files written
  resume with: node build.js render --resume
```

Both open in an editor pane. `node build.js status` prints the same block and
refreshes the file, without building anything — so I can ask "did that finish?"
without re-running work.

And when none of that explains it, **`node build.js doctor`** writes
`build-doctor.txt`: node version and platform, whether stdout is a TTY, `argv`
verbatim with any non-ASCII named, whether the repo root and `.cache/` are
actually writable, and the current git branch and commit — that last one so I can
confirm the device is running the code I think it is, and not an older
`build.js`. If the terminal shows nothing, that file is the record.

**What's left is on the last line.** It used to print above the summary, and only
for `--group` runs. Now it rides on the final `done` line, for any incomplete run:

```
[render] done       4 files     29ms  (4 written, 0 unchanged)  — 9 left: assets, home, writing, series, projects, flat, enjoying, products, feeds
```

If the terminal shows you one line, that's the line worth having.

## `step` rebuilds what you changed

The first version of `step` had a flaw worth writing down, because the symptom
was "I edited a file, ran the build, and `dist/` didn't change" — which sounds
like a broken build and was actually a bad decision on my part.

Editing a note and running `node build.js step` used to rebuild **`assets`**.
Here's the chain: the edit makes the manifest stale, so `render` re-scans; the
re-scan sees a new fingerprint and clears the checkpoint (correct — the old
progress described different inputs); `step` therefore sees all ten groups
pending and takes the first one; and the first one, in presentation order, is
`assets`. The CSS bundle gets rewritten and the note doesn't. You'd have to run
`step` three more times to reach it, with nothing in the output saying so.

Presentation order — assets, homepage, sections, feeds — is right for a cold
build. It's wrong for the case I'm in most of the time, which is "I changed one
file and want to see it".

So each group now declares what it reads:

```js
module.exports = {
  id: 'notes',
  label: '/notes/ and note permalinks',
  inputs: ['notes'],
  run: function (ctx) { … },
};
```

`render` diffs the old manifest against the new one (both are already in hand
during a re-scan, so this costs nothing), works out which groups are affected,
and renders the most specific one first:

```
[render] sources changed: notes
[render] next up: notes — 3 of 10 groups affected
[render] notes      4 files     2ms
```

"Most specific" means fewest declared inputs. Editing a note affects `notes`,
but also `home` (it digests the latest four) and `feeds` — and "show me my note"
means the page, not the digest. `notes` reads one section, `home` reads three,
`feeds` reads nine, so `notes` wins.

Two deliberate exceptions. On a **cold build** there's no diff, so the order is
unchanged — ten `step` runs still walk assets → … → feeds and still produce a
byte-identical site. And when a **layout or site-wide config** moves, every group
is affected, so there's no "the page you edited" to surface and it stays in
presentation order too.

One more thing that used to be silent: clearing the checkpoint. It now says so,
and says what caused it, because a run that was nine-tenths finished quietly
becoming zero-tenths finished deserves a line:

```
[scan] sources changed (notes) — previous build progress reset
```

## Is dist up to date?

`node build.js status` answers it directly now:

```
build status — 2026-09-23 22:44
  done     assets, home, notes, writing, series, projects, flat, enjoying, products, feeds
  pending  (none)
  10 of 10 groups, 64 files written
  dist     STALE — sources changed since that build: notes
  next     node build.js step   (renders notes first)
```

or, when there's nothing to do:

```
  dist     current
```

"Which groups finished" and "is what I'm looking at current" are different
questions, and only the second one matters when you've just edited something and
can't see your change. A complete build goes stale the moment you touch a source
file, and nothing used to say so.

## Command reference

| Command | What it does |
| ------- | ------------ |
| `node build.js` | scan + render everything (what CI runs) |
| `node build.js scan` | gather inputs into `.cache/manifest.json` |
| `node build.js render` | render the manifest into `dist/` |
| `node build.js clean` | prune `dist/` against the last complete build |
| `node build.js step` | render the next pending group, then stop |
| `node build.js resume` | continue an interrupted run |
| `node build.js status` | what's done and what's left, without building |
| `node build.js doctor` | write a diagnostic report to `build-doctor.txt` |

`step` used to be called `next`. That was a bad name in a JavaScript project —
it reads as Next.js at a glance, which this has nothing to do with. `next` still
works as an undocumented alias so nothing already typed breaks.
| `node serve.js` | dev server with live reload |

| Flag | What it does |
| ---- | ------------ |
| `--group <id>` | render one group only (or just `render <id>`) |
| `--step` | render only the next pending group |
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
  args.js                   argv parser — normalises iOS smart punctuation
  log.js                    progress reporting — synchronous, also to a file
  status.js                 the .cache/status.txt snapshot
  fsx.js                    write-then-prune writer  ← the durability fix
  manifest.js               scan: gather inputs
  state.js                  render checkpoint
  context.js                the derive step  ← what makes groups independent

  parse/                    frontmatter, markdown, components, content files
  render/                   escape, template engine, layouts, nav, helpers,
                            plus the shared writing / notes / series blocks
  net/                      the opt-in HTTP client and image grabber
  pages/                    one module per output group; index.js is the registry
  commands/                 scan, render, build, clean, status, doctor
  watch-poll.js             the fs.watch fallback
```

Every file has a header saying what it is and why it exists. If you're following
the flow for the first time: `build.js` → `lib/commands/build.js` →
`lib/commands/render.js` → `lib/context.js` → `lib/pages/index.js`.

## Adding a page group

1. Write `lib/pages/<name>.js` exporting `{ id, label, inputs, run(ctx) }`.
2. Add `require('./<name>')` to the array in `lib/pages/index.js`.

`inputs` lists the manifest sections the group reads — the nine content
collection keys plus `layouts`, `components`, `css`, `js`, `data`, `assets`.
Getting it right is what lets `step` pick this group when the relevant source
changes; getting it wrong only costs targeting, never correctness, since a full
build renders everything regardless.

That's it. It gets a checkpoint, a progress line, and `--group` support for free.
`ctx.emit(relPath, layoutName, data)` renders through the inner layout and
`base.html` and writes the result.
