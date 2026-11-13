/**
 * opxy.js: the OP-XY screen archive, read through one place.
 *
 * `manifest` is the index scripts/opxy-assets.mjs writes: every machine, every
 * frame's position in its atlas, and the text the design passes produced. It is
 * only populated during the server render (see opxy-manifest.js), so everything
 * exported here tolerates it being null and the pages check `opxy` before they
 * render anything that needs it.
 *
 * The images themselves live on a separate host, configured with every other
 * project's in src/content/assets.json (see assets.js).
 */

import manifest from './opxy-manifest';
import { assetsBaseFor } from './assets.js';

export const opxy = manifest;

/** Always ends with a slash, so `assetUrl` is plain concatenation. */
export const assetsBase = assetsBaseFor('opxy');

export const assetUrl = (file) => assetsBase + file;

/** The device screen, in pixels. */
export const CELL = (manifest && manifest.canvas) || { w: 480, h: 220 };

export const machines = () => (manifest ? manifest.machines : []);

export const machineById = (id) => machines().find((m) => m.id === id) || null;

/** A control's display label, falling back to its id. */
export function controlLabel(machine, id) {
  const c = (machine.controls || []).find((x) => x.id === id);
  return c ? c.label : id;
}

export const KIND_LABELS = {
  frame: 'Finished frames',
  pass: 'Pass variants',
  cleaned: 'Cleaned picks',
  kept: 'Kept variants',
};

/** The short mono label under a thumbnail. */
export function cellLabel(machine, c) {
  if (c.kind === 'frame') return c.control ? `${controlLabel(machine, c.control)} ${c.value}` : c.name;
  if (c.kind === 'pass') return `pass ${c.passNumber} · ${c.variant}`;
  if (c.kind === 'cleaned') return `cleaned · ${c.variant}`;
  if (c.kind === 'kept') return `kept · ${c.variant}${c.reason ? ` · ${c.reason}` : ''}`;
  return c.name || c.file;
}

/** candidate.json fields arrive as a list or a single string; always a list here. */
export const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/** Totals for the ledes, so no page states a number the record has outgrown. */
export function totals() {
  const ms = machines();
  return {
    machines: ms.length,
    screens: ms.reduce((n, m) => n + m.cells.length, 0),
    passes: ms.reduce((n, m) => n + m.cells.filter((c) => c.kind === 'pass').length, 0),
    sheets: ms.reduce((n, m) => n + m.sheets.length, 0),
    clips: ms.reduce((n, m) => n + m.motion.length, 0),
  };
}
