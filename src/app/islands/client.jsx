/**
 * client.jsx: hydrate the page's islands, and nothing else.
 *
 * Loaded by main.jsx only when a prerendered page has a [data-island] in it.
 * Each island is hydrated as its own React root with the tree and id prefix
 * the server rendered it with (see island.jsx and entry-server.jsx), so React
 * attaches to the markup that's already there instead of redrawing it.
 *
 * Islands come in groups, one module per group, loaded once however many of
 * its figures a page has. A group module exports:
 *
 *   islands    { Name: Component }, the components its islands name
 *   prepare    optional: (elements) => Promise<data | null>, run before any
 *              of the group's islands hydrate. Minty uses it to fetch its
 *              measurements. Islands that `need` the data stay static if it
 *              doesn't arrive, which is the figure as prerendered: the whole
 *              record, just not interactive.
 *   needsData  optional: (name) => boolean, which islands those are
 */

import { hydrateRoot } from 'react-dom/client';

import { IslandTree } from './island';

// Extensionless on purpose: CodePen compiles .jsx to .js before Vite runs.
const GROUPS = {
  demos: () => import('../components/demos'),
  minty: () => import('../components/minty/live'),
};

function readProps(el) {
  try {
    return JSON.parse(el.getAttribute('data-props') || '{}');
  } catch (e) {
    return null;
  }
}

function hydrate(el, Component, data) {
  const props = readProps(el);
  if (!Component || !props) return;
  hydrateRoot(
    el,
    <IslandTree route={el.getAttribute('data-route') || '/'} base={el.getAttribute('data-base') || './'} data={data}>
      <Component {...props} />
    </IslandTree>,
    { identifierPrefix: `${el.getAttribute('data-island-id')}-` },
  );
}

export function mountIslands(root = document) {
  const byGroup = {};
  root.querySelectorAll('[data-island]').forEach((el) => {
    const [group, name] = (el.getAttribute('data-island') || '').split('/');
    if (!GROUPS[group] || !name) return;
    if (!byGroup[group]) byGroup[group] = [];
    byGroup[group].push({ el, name });
  });

  return Promise.all(Object.entries(byGroup).map(([group, items]) => GROUPS[group]()
    .then((mod) => {
      const needs = mod.needsData || (() => false);
      const wanted = items.some(({ name }) => needs(name));
      const ready = wanted && mod.prepare ? mod.prepare(items.map((it) => it.el)) : Promise.resolve(null);
      return ready.catch(() => null).then((data) => {
        items.forEach(({ el, name }) => {
          if (needs(name) && !data) return; // stays as prerendered
          hydrate(el, mod.islands[name], data);
        });
      });
    })
    // A group that fails to load leaves its figures as prerendered; the rest
    // of the page is unaffected.
    .catch(() => {})));
}
