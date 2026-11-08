/**
 * minty.js: Minty's measurements and audio, read through one place.
 *
 * `data` is src/minty/data.json, present only during the server render (see
 * minty-data.js). The audio renders live on a separate host named in
 * src/content/minty.json; VITE_MINTY_ASSETS_BASE overrides it for a local
 * build against a local copy of the files.
 */

import data from './minty-data';
import { content } from './content.js';

export const minty = data;

const configured = import.meta.env.VITE_MINTY_ASSETS_BASE
  || (content.data.minty && content.data.minty.assetsBase)
  || '';

export const mintyAssetsBase = configured && !configured.endsWith('/') ? `${configured}/` : configured;
export const mintyAsset = (file) => mintyAssetsBase + file;
