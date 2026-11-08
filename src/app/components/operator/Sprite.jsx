/**
 * Sprite.jsx: one screen out of an atlas.
 *
 * The archive ships thirty WebP files, one per machine, each a 4-wide grid of
 * every 480 x 220 frame that machine has. A page that wants one frame shows the
 * whole atlas inside a box the size of one cell and shifts it by whole cells,
 * so the browser fetches and decodes each atlas once however many of its
 * frames appear. The shift is in percentages of the box, which is why the box
 * can be any width and the frame still lands exactly: a cell is always 1/cols
 * of the atlas wide and 1/rows of it tall.
 *
 * `width` and `height` on the image are the atlas's real pixel size, so the
 * browser knows the ratio before anything loads; the CSS then overrides both.
 */

import { CELL, assetUrl } from '../../opxy.js';

export function Sprite({ machine, cell, alt, lazy = true, className = '' }) {
  const { cols, rows, file } = machine.atlas;
  const col = cell.i % cols;
  const row = Math.floor(cell.i / cols);

  return (
    <span
      className={`sprite${className ? ` ${className}` : ''}`}
      style={{ '--cols': cols, '--rows': rows, '--col': col, '--row': row }}
    >
      <img
        src={assetUrl(file)}
        alt={alt != null ? alt : cell.alt}
        width={CELL.w * cols}
        height={CELL.h * rows}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
      />
    </span>
  );
}

/**
 * One row of the before/after strip, which stacks eight strips of differing
 * widths in one file. Same trick, one dimension: the box is one strip tall,
 * the image is `rows` strips tall, shifted up by whole strips.
 */
export function Strip({ sheet, alt, lazy = true }) {
  return (
    <span
      className="sprite sprite--strip"
      style={{ '--rows': sheet.rows, '--row': sheet.row, aspectRatio: `${sheet.cellW} / ${sheet.cellH}` }}
    >
      <img
        src={assetUrl(sheet.file)}
        alt={alt != null ? alt : sheet.alt}
        width={sheet.cellW}
        height={sheet.cellH * sheet.rows}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
      />
    </span>
  );
}

/** A sheet that is its own file: a contact sheet or a one-off comparison. */
export function Sheet({ sheet, alt, lazy = true }) {
  return (
    <img
      className="sheet"
      src={assetUrl(sheet.file)}
      alt={alt != null ? alt : sheet.alt}
      width={sheet.w}
      height={sheet.h}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
    />
  );
}

/**
 * One clip out of a category's video.
 *
 * The nineteen GIFs became three H.264 files, one per category, and the index
 * records where each clip starts and how long it runs. A media fragment on the
 * URL plays just that span, so the page never downloads the other machines'
 * clips to show one. Silent by design: the GIFs had no sound either.
 */
export function Motion({ clip, label }) {
  const end = Math.round((clip.start + clip.dur) * 100) / 100;
  return (
    <video
      className="motion"
      src={`${assetUrl(clip.file)}#t=${clip.start},${end}`}
      controls
      muted
      playsInline
      preload="none"
      width={CELL.w}
      height={CELL.h}
      aria-label={label || clip.alt}
    />
  );
}
