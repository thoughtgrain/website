/**
 * island.jsx: interactive figures that React drives on their own.
 *
 * Every page on this site is prerendered, and most of it never changes after
 * that. The parts that do are figures: a knob redraws a chart, a radio button
 * swaps an example. Hydrating the whole page to drive one figure means
 * shipping <App>, every page component and the site's content to the browser
 * for nothing the reader can see change. An island is the alternative: each
 * figure is its own small React root, and the page around it stays plain HTML.
 *
 * How one works, end to end:
 *
 *   1. Content uses the wrapped component as normal: <TransferCurve caption="…" />.
 *   2. During the server render, the wrapper doesn't render the figure in
 *      place. It registers the figure with the collector entry-server
 *      provides, and leaves a placeholder in a <div data-island>.
 *   3. After the page renders, entry-server renders each registered figure as
 *      a root of its own and drops it into its placeholder. Rendering it apart
 *      from the page matters: useId derives ids from a component's position in
 *      the tree, so the server has to render exactly the tree the browser will
 *      hydrate, starting at the figure, or the ids won't match.
 *   4. In the browser, islands/client.jsx finds each [data-island], loads its
 *      group's components, and hydrates that one element with the same tree.
 *
 * Props cross from server to browser as JSON in data-props, so they have to be
 * plain data. That's also the point where a figure can be handed values that
 * only the server can work out (anything derived from the site's content),
 * through the `props` option, so the browser never has to load that content.
 *
 * Without a collector (`vite dev`, where nothing is prerendered and the whole
 * page renders in the browser) the wrapper renders the figure in place.
 */

import { createContext, useContext } from 'react';

import { BaseContext } from '../base.js';

/** Provided by entry-server: an array the page's islands register into. */
export const IslandCollector = createContext(null);

/**
 * Data an island group loads before hydrating (Minty's measurements), handed
 * to its components. Null during the server render, where they read the same
 * data from the server-only module instead.
 */
export const IslandData = createContext(null);

/**
 * The tree an island renders, on the server and in the browser alike. Both
 * sides must build exactly this, provider for provider, for hydration to match.
 */
export function IslandTree({ route, base, data = null, children }) {
  return (
    <BaseContext.Provider value={{ route, base }}>
      <IslandData.Provider value={data}>{children}</IslandData.Provider>
    </BaseContext.Provider>
  );
}

/**
 * Wrap a component as an island.
 *
 *   name   "group/Component": the group names the module client.jsx loads,
 *          the component is looked up in that module's `islands` map
 *   props  optional, server side only: (props) => the props to render with
 *          and to serialise, for values the browser shouldn't have to compute
 *   when   optional: () => false to render the component in place, not as an
 *          island (Minty's figures when its measurements are missing)
 */
export function island(name, Component, { props: serverProps, when } = {}) {
  function Island(given) {
    const collector = useContext(IslandCollector);
    const { route, base } = useContext(BaseContext);
    if (when && !when()) return <Component {...given} />;

    const props = serverProps ? serverProps(given) : given;
    const tree = (
      <IslandTree route={route} base={base}>
        <Component {...props} />
      </IslandTree>
    );

    if (!collector) return <div className="island" data-island={name}>{tree}</div>;

    const index = collector.length;
    collector.push(tree);
    return (
      <div
        className="island"
        data-island={name}
        data-island-id={`i${index}`}
        data-route={route}
        data-base={base}
        data-props={JSON.stringify(props)}
        dangerouslySetInnerHTML={{ __html: placeholder(index) }}
      />
    );
  }
  Island.displayName = `Island(${name})`;
  return Island;
}

/** The marker entry-server swaps for an island's own render. */
export const placeholder = (index) => `<!--island:${index}-->`;
