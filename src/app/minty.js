/**
 * minty.js: Minty's measurements and audio, read through one place.
 *
 * `data` is src/minty/data.json, present only during the server render (see
 * minty-data.js). The audio renders live on a separate host, configured with
 * every other project's in src/content/assets.json (see assets.js).
 */

import data from './minty-data';
import { assetsBaseFor } from './assets.js';

export const minty = data;

export const mintyAssetsBase = assetsBaseFor('minty');
export const mintyAsset = (file) => mintyAssetsBase + file;
