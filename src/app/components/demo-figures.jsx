/**
 * demo-figures.jsx: the build series' interactive figures, as the server sees
 * them.
 *
 * The components are in demos.jsx and are hydrated in the browser as islands
 * (src/app/islands/). This module wraps each one, and works out what two of
 * them need from the site's content (the real route list and file counts)
 * here, on the server, so it travels to the browser as a few props instead
 * of the content itself.
 */

import { content, contentFileCount, dataFileCount } from '../content.js';
import { island } from '../islands/island';
import { routesFor } from '../lib/content-model.js';
import { BuildStepper, EXPLORER_ROUTES, FeedFormats, LoaderCompare, PathResolver, RouteExplorer } from './demos';

export const demoComponents = {
  RouteExplorer: island('demos/RouteExplorer', RouteExplorer, {
    props: () => ({ routes: routesFor(content).filter((r) => EXPLORER_ROUTES.includes(r)) }),
  }),
  PathResolver: island('demos/PathResolver', PathResolver),
  BuildStepper: island('demos/BuildStepper', BuildStepper, {
    props: () => ({ routeCount: routesFor(content).length, fileCount: contentFileCount, dataFileCount }),
  }),
  LoaderCompare: island('demos/LoaderCompare', LoaderCompare),
  FeedFormats: island('demos/FeedFormats', FeedFormats),
};
