/**
 * Build the OP-XY screen assets and their index.
 *
 *   node scripts/opxy-assets.mjs <images-dir> <operator-design-repo> <out-dir>
 *
 * The images arrive as 474 files (455 PNG, 19 GIF, 22 MB): every frame, pass
 * variant and sheet for thirty machines, all at the device's 480 x 220. That
 * is too many files to hand to a host and too many bytes to ask a reader for,
 * so this packs them:
 *
 *   m-<machine>.webp     every 480 x 220 frame and variant of one machine in a
 *                        4-wide grid, lossless, pixel-identical to the PNGs.
 *                        Thirty files, about 2 MB in total, the largest ~10 MB
 *                        of pixels once decoded. One per machine rather than
 *                        one per category because a category atlas is 3840 px
 *                        wide and costs ~50 MB of memory to show one screen.
 *   contact-<m>.webp     the twelve contact sheets, one file each: they are
 *                        1536 x 1374 and twelve of them in one grid would
 *                        decode to 100 MB.
 *   before-after.webp    the eight before/after strips stacked in one file.
 *   <m>-<name>.webp      the six remaining one-off sheets.
 *   motion-<cat>.mp4     the nineteen GIFs as H.264, concatenated per category,
 *                        with each clip's start and duration in the index so a
 *                        page can play just its own with a media fragment.
 *                        8.6 MB of GIF becomes 0.9 MB.
 *
 * and writes src/opxy/manifest.json: where each image sits, what it is, and
 * the text the agent wrote to make it, pulled from the operator-design repo
 * (machine.json, definition.json, brief.md, pass.json, candidate.json). That
 * index is what the screens page searches. A short machine list also goes to
 * src/content/screens.json for the route list and page titles.
 *
 * Why lossless: these are one-bit-ish line drawings on black. Lossy WebP
 * smears the greys the device palette depends on, and lossless is already
 * about 12% of the PNGs' size because an atlas shares one dictionary across
 * every cell.
 *
 * Needs ImageMagick (montage, convert, compare, identify) and ffmpeg/ffprobe.
 * Pass filenames as arguments, never as an @list: ImageMagick's default
 * security policy refuses @files, and when montage cannot open an input it
 * writes the result to the LAST argument, which once overwrote three source
 * PNGs with atlases. Inputs first, output last, every time.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [IMAGES, REPO, OUT] = process.argv.slice(2).map((p) => p && path.resolve(p));
if (!IMAGES || !REPO || !OUT) {
  console.error('usage: node scripts/opxy-assets.mjs <images-dir> <operator-design-repo> <out-dir>');
  process.exit(2);
}
const SCREENS = path.join(REPO, 'screens');
const MANIFEST = path.resolve(import.meta.dirname, '..', 'src', 'opxy', 'manifest.json');
const INDEX = path.resolve(import.meta.dirname, '..', 'src', 'content', 'screens.json');
const CELL = { w: 480, h: 220 };
const COLS = 4;

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const dims = (file) => run('identify', ['-format', '%wx%h', `${file}[0]`]).trim();
const kb = (file) => Math.round(statSync(file).size / 1024);
const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
};
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const firstSentence = (s) => (s || '').split(/(?<=\.)\s/)[0].replace(/\.$/, '');

/** `| Concept | text |` rows from the intake table in brief.md. */
function intake(brief) {
  const rows = {};
  for (const m of brief.matchAll(/^\|\s*([^|]+?)\s*\|\s*(.+?)\s*\|\s*$/gm)) rows[m[1]] = m[2];
  return rows;
}

/**
 * The parts of brief.md the session replay narrates: the phase 0 subject
 * sentence, what lint_definition reported, and the phase 2 scores.
 */
function briefFacts(brief) {
  const subject = (brief.match(/^- Subject in one sentence:\s*(.+)$/m) || [])[1] || null;
  const lint = (brief.match(/lint_definition\.py[^\n]*?→\s*([^\n]+)/) || [])[1] || null;
  const scores = [];
  const section = (brief.split(/^## 2[^\n]*$/m)[1] || '').split(/^## /m)[0];
  for (const m of section.matchAll(/^\|\s*(\d+)\s+([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(\d)\s*\|\s*$/gm)) {
    scores.push({ control: m[2], effect: m[3], score: Number(m[4]) });
  }
  return { subject, lintDefinition: lint && lint.replace(/\*\*/g, '').trim(), scores };
}

/** `1. v3: why` lines under "## Ranking" in a pass's notes.md. */
function ranking(notes) {
  const section = (notes.split(/^## Ranking[^\n]*$/m)[1] || '').split(/^## /m)[0];
  return [...section.matchAll(/^\d+\.\s*(v\d)\s*[:·.]\s*(.+)$/gm)].map((m) => ({ variant: m[1], note: m[2].trim() }));
}

/** The first real paragraph of a markdown file (after the title, skipping build notes). */
function firstParagraph(md) {
  return md.split(/\n\s*\n/).map((p) => p.trim())
    .find((p) => p && !p.startsWith('#') && !/^Everything here comes from/.test(p)) || null;
}

mkdirSync(OUT, { recursive: true });
mkdirSync(path.dirname(MANIFEST), { recursive: true });

const CATEGORIES = {
  engines: { label: 'Engines', singular: 'engine', description: 'A voice that makes the sound: oscillators, filters, folders, physical models. Its screen shows the mechanism or the signal path, reshaped by each control.' },
  effects: { label: 'Effects', singular: 'effect', description: 'Processes another track\'s audio: delay, reverb, distortion, filter, dynamics. Its screen shows what happens to the signal on the way through.' },
  players: { label: 'Players', singular: 'player', description: 'Generates notes for another engine. Its screen shows the rule that picks the notes, drawn as something with the same shape.' },
};

const manifest = { version: 1, canvas: CELL, categories: CATEGORIES, machines: [], motion: {} };
let accounted = 0;

// ------------------------------------------------------------ per machine
for (const category of Object.keys(CATEGORIES)) {
  for (const id of readdirSync(path.join(IMAGES, category)).sort()) {
    const dir = path.join(IMAGES, category, id);
    if (!statSync(dir).isDirectory()) continue;
    const rec = path.join(SCREENS, id);
    const machineJson = readJson(path.join(rec, 'machine.json')) || {};
    const definition = readJson(path.join(rec, 'definition.json')) || {};
    const brief = existsSync(path.join(rec, 'brief.md')) ? readFileSync(path.join(rec, 'brief.md'), 'utf8') : '';
    const intakeRows = intake(brief);
    const facts = briefFacts(brief);
    const motionMd = existsSync(path.join(rec, 'frames', 'motion.md')) ? readFileSync(path.join(rec, 'frames', 'motion.md'), 'utf8') : '';
    const name = definition.name || id[0].toUpperCase() + id.slice(1);
    const controls = (definition.parameters || []).map((p) => ({ id: p.id, label: p.label || p.id }));
    const labelOf = (cid) => controls.find((c) => c.id === cid)?.label || cid;

    // Text per pass and per variant, from the repo.
    const passes = {};
    const passesDir = path.join(rec, 'passes');
    if (existsSync(passesDir)) {
      for (const step of readdirSync(passesDir).sort()) {
        const pj = readJson(path.join(passesDir, step, 'pass.json')) || {};
        const variants = {};
        for (const v of readdirSync(path.join(passesDir, step)).filter((d) => /^v\d$/.test(d))) {
          const c = readJson(path.join(passesDir, step, v, 'candidate.json')) || {};
          const dir = (pj.directions || []).find((d) => d.variant === v) || {};
          variants[v] = {
            subject: c.subject || '', controls: c.controls || [], risks: c.risks || '',
            pattern: c.pattern || dir.pattern || null,
            patternName: dir.patternName || null,
            drawingLanguage: c.drawing_language || dir.drawingLanguage || null,
            angle: c.angle || null,
          };
        }
        const notesMd = existsSync(path.join(passesDir, step, 'notes.md')) ? readFileSync(path.join(passesDir, step, 'notes.md'), 'utf8') : '';
        passes[step] = {
          number: pj.number ?? Number(step.split('-')[0]),
          kind: pj.kind || step.split('-')[1],
          state: pj.state || null,
          focus: pj.focus || null,
          created: pj.created || null,
          // What design_pass_start handed out before anything was drawn.
          directions: (pj.directions || []).map((d) => ({
            variant: d.variant, angle: d.angle || null, pattern: d.pattern || null, patternName: d.patternName || null,
            drawingLanguage: d.drawingLanguage || null, stretch: Boolean(d.stretch),
            composition: d.composition || null, camera: d.camera || null, emphasis: d.emphasis || null,
          })),
          // What design_pass_submit measured.
          uniqueness: pj.uniqueness ? { pairs: pj.uniqueness.pairs || [], problems: pj.uniqueness.problems || [], checked: pj.uniqueness.checked || null } : null,
          // The reviewer's or designer's ranking from notes.md; never the pick.
          ranking: ranking(notesMd),
          // The decision the person made at the end of the pass, in their words.
          pick: pj.selection ? { variant: pj.selection.variant, reason: pj.selection.reason || '', chosenBy: pj.selection.chosenBy || null, at: pj.selection.at || null } : null,
          rejected: pj.rejection ? { reason: pj.rejection.reason || '', chosenBy: pj.rejection.chosenBy || null, at: pj.rejection.at || null } : null,
          variants,
        };
      }
    }

    const files = walk(dir).sort();
    const standard = []; const sheets = []; const gifs = [];
    for (const f of files) {
      if (f.endsWith('.gif')) { gifs.push(f); continue; }
      if (!f.endsWith('.png')) continue;
      (dims(f) === `${CELL.w}x${CELL.h}` ? standard : sheets).push(f);
    }

    // Order cells: the finished frames first (rest leading), then cleaned,
    // kept, then every pass in order. The order is recorded, so it only has
    // to be stable.
    const rank = (f) => {
      const rel = path.relative(dir, f);
      if (rel.startsWith('frames/')) return rel.endsWith('/rest.png') ? '0' : `1${rel}`;
      if (rel.startsWith('cleaned/')) return `2${rel}`;
      if (rel.startsWith('kept/')) return `3${rel}`;
      return `4${rel}`;
    };
    standard.sort((a, b) => rank(a).localeCompare(rank(b)));

    const cells = standard.map((f, i) => {
      const rel = path.relative(dir, f).replace(/\.png$/, '');
      const [folder, ...rest] = rel.split('/');
      const stem = rest[rest.length - 1];
      const cell = { i, file: rel, kind: folder === 'frames' ? 'frame' : folder === 'passes' ? 'pass' : folder };
      if (cell.kind === 'frame') {
        const m = stem.match(/^(.+)-(0|50|100)$/);
        if (stem === 'rest') { cell.name = 'rest'; cell.alt = `${name} at rest`; }
        else if (stem === 'playing') { cell.name = 'playing'; cell.alt = `${name} while playing`; }
        else if (m) { cell.name = stem; cell.control = m[1]; cell.value = Number(m[2]); cell.alt = `${name}, ${labelOf(m[1])} at ${m[2]}%`; }
        else { cell.name = stem; cell.alt = `${name}: ${stem.replace(/-/g, ' ')}`; }
      } else if (cell.kind === 'pass') {
        const [step, variant] = rest;
        const p = passes[step] || { number: Number(step.split('-')[0]), kind: step.split('-')[1], variants: {} };
        const t = p.variants[variant] || {};
        Object.assign(cell, { pass: step, passNumber: p.number, passKind: p.kind, passState: p.state || null, variant, ...t });
        if (p.pick && p.pick.variant === variant) cell.picked = true;
        cell.alt = `${name}, pass ${p.number} (${p.kind}), variant ${variant.slice(1)}${t.subject ? `: ${firstSentence(t.subject)}` : ''}`;
      } else if (cell.kind === 'cleaned') {
        // Cleaned variants come from the first subject pass of the same number.
        const variant = stem;
        const from = Object.keys(passes).find((s) => s.startsWith('01-')) || null;
        const t = (from && passes[from].variants[variant]) || {};
        Object.assign(cell, { variant, fromPass: from, ...t });
        const cleanMd = from ? path.join(passesDir, from, variant, 'clean.md') : null;
        if (cleanMd && existsSync(cleanMd)) cell.cleanNote = firstParagraph(readFileSync(cleanMd, 'utf8'));
        cell.alt = `${name}, cleaned variant ${variant.slice(1)}${t.subject ? `: ${firstSentence(t.subject)}` : ''}`;
      } else if (cell.kind === 'kept') {
        const [folder2] = rest; // e.g. v4-reference, v1-sequencer
        const variant = folder2.split('-')[0]; const reason = folder2.split('-').slice(1).join(' ');
        const from = Object.keys(passes).find((s) => passes[s].variants[variant]) || null;
        const t = (from && passes[from].variants[variant]) || {};
        Object.assign(cell, { variant, reason, fromPass: from, ...t });
        cell.alt = `${name}, variant ${variant.slice(1)} kept as ${reason}`;
      }
      return cell;
    });

    // The atlas. Inputs first, output last.
    const atlasFile = `m-${id}.webp`;
    const rows = Math.ceil(standard.length / COLS);
    run('montage', [...standard, '-tile', `${COLS}x`, '-geometry', `${CELL.w}x${CELL.h}+0+0`, '-background', 'white',
      '-define', 'webp:lossless=true', '-define', 'webp:method=6', path.join(OUT, atlasFile)]);

    // Sheets: contact sheets and one-offs as single files; before/after strips are packed below.
    const sheetRecs = [];
    for (const f of sheets) {
      const stem = path.basename(f, '.png');
      const [w, h] = dims(f).split('x').map(Number);
      if (stem === 'before-after') { sheetRecs.push({ kind: 'before-after', src: f, w, h }); continue; }
      const file = stem === 'contact' ? `contact-${id}.webp` : `${id}-${stem}.webp`;
      run('convert', [f, '-define', 'webp:lossless=true', '-define', 'webp:method=6', path.join(OUT, file)]);
      const alt = stem === 'contact' ? `${name} contact sheet: rest, playing and every control at 0, 50 and 100`
        : `${name}: ${stem.replace(/-/g, ' ')}${/sheet$/.test(stem) ? '' : ' sheet'}`;
      sheetRecs.push({ kind: stem, file, w, h, alt });
    }

    accounted += standard.length + sheets.length + gifs.length;
    manifest.machines.push({
      id, name, category, kind: machineJson.kind || CATEGORIES[category].singular,
      description: machineJson.description || '', concept: intakeRows.Concept || '', soundsLike: intakeRows['Sounds like'] || '',
      controls,
      intake: { subject: facts.subject, controlSource: intakeRows['Control source'] || null, lintDefinition: facts.lintDefinition },
      scores: facts.scores,
      passes: Object.fromEntries(Object.entries(passes).map(([k, { variants: _v, ...v }]) => [k, v])),
      frames: motionMd ? { lint: (motionMd.match(/Lint: ([^.\n(]*)/) || [])[1]?.trim() || null, summary: firstParagraph(motionMd) } : null,
      atlas: { file: atlasFile, cols: COLS, rows, count: standard.length },
      cells, sheets: sheetRecs, gifs,
    });
    console.log(`${category}/${id}: ${standard.length} cells -> ${atlasFile} ${kb(path.join(OUT, atlasFile))} KB, ${sheets.length} sheets, ${gifs.length} clips`);
  }
}

// ------------------------------------------------------ before/after strip
{
  const strips = manifest.machines.flatMap((m) => m.sheets.filter((s) => s.kind === 'before-after').map((s) => ({ m, s })));
  if (strips.length) {
    const W = Math.max(...strips.map(({ s }) => s.w)); const H = Math.max(...strips.map(({ s }) => s.h));
    run('montage', [...strips.map(({ s }) => s.src), '-tile', '1x', '-geometry', `${W}x${H}+0+0`, '-gravity', 'NorthWest', '-background', 'white',
      '-define', 'webp:lossless=true', '-define', 'webp:method=6', path.join(OUT, 'before-after.webp')]);
    strips.forEach(({ m, s }, i) => { Object.assign(s, { file: 'before-after.webp', row: i, rows: strips.length, cellW: W, cellH: H, alt: `${m.name}: before and after` }); delete s.src; });
    manifest.beforeAfter = { file: 'before-after.webp', rows: strips.length, w: W, h: H };
    console.log(`before/after: ${strips.length} strips -> before-after.webp ${kb(path.join(OUT, 'before-after.webp'))} KB`);
  }
}

// ----------------------------------------------------------------- motion
for (const category of Object.keys(CATEGORIES)) {
  const clips = manifest.machines.filter((m) => m.category === category).flatMap((m) => m.gifs.map((g) => ({ m, g })));
  if (!clips.length) continue;
  const tmp = path.join(OUT, '.clips'); mkdirSync(tmp, { recursive: true });
  const list = []; let t = 0; const entries = [];
  for (const { m, g } of clips) {
    const stem = path.basename(g, '.gif');
    const clip = path.join(tmp, `${m.id}-${stem}.mp4`);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', g, '-vf', `scale=${CELL.w}:${CELL.h},fps=25,format=yuv420p`, '-c:v', 'libx264', '-crf', '23', '-movflags', 'faststart', clip]);
    const dur = Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', clip]).trim());
    list.push(`file '${clip.replace(/'/g, "'\\''")}'`);
    const where = path.relative(path.join(IMAGES, category, m.id), g).replace(/\.gif$/, '');
    entries.push({ machine: m.id, name: stem, where, start: Number(t.toFixed(2)), dur: Number(dur.toFixed(2)), alt: `${m.name}: ${stem.replace(/-/g, ' ')}` });
    t += dur;
  }
  writeFileSync(path.join(tmp, `${category}.txt`), `${list.join('\n')}\n`);
  const file = `motion-${category}.mp4`;
  run('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, `${category}.txt`), '-c', 'copy', '-movflags', 'faststart', path.join(OUT, file)]);
  manifest.motion[category] = { file, duration: Number(t.toFixed(2)), clips: entries };
  // Only this category's machines: the loop runs once per category, and
  // assigning to every machine here wiped the previous category's clips.
  for (const m of manifest.machines.filter((x) => x.category === category)) {
    m.motion = entries.filter((e) => e.machine === m.id).map(({ machine, ...e }) => ({ file, ...e }));
  }
  console.log(`motion/${category}: ${clips.length} clips -> ${file} ${kb(path.join(OUT, file))} KB, ${t.toFixed(1)}s`);
}
for (const m of manifest.machines) { delete m.gifs; if (!m.motion) m.motion = []; }

writeFileSync(MANIFEST, `${JSON.stringify(manifest)}\n`);

// A small index beside the site's other content JSON. The route list and the
// page titles need to know which machines exist, and they are computed by
// code that runs in the browser too, where the full manifest would be half a
// megabyte of text nobody asked for. This is the part of it that is cheap to
// carry everywhere.
writeFileSync(INDEX, `${JSON.stringify({
  _comment: 'Generated by scripts/opxy-assets.mjs from src/opxy/manifest.json. Do not edit by hand.',
  machines: manifest.machines.map((m) => ({ id: m.id, name: m.name, category: m.category, kind: m.kind, description: m.description })),
}, null, 2)}\n`);

const total = walk(OUT).filter((f) => !f.includes('/.clips/')).reduce((a, f) => a + statSync(f).size, 0);
console.log(`\n${accounted} source images accounted for; ${walk(OUT).filter((f) => !f.includes('/.clips/')).length} output files, ${(total / 1048576).toFixed(1)} MB; manifest ${kb(MANIFEST)} KB -> ${path.relative(process.cwd(), MANIFEST)}`);
