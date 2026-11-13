/**
 * hooks.js: what every live Minty figure shares.
 *
 * Kept free of anything that reads the site's content (src/app/minty.js does,
 * for the audio host), because these run in the browser and the content is
 * the one thing the islands exist to keep out of it.
 */

import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import serverData from '../../minty-data';
import { IslandData } from '../../islands/island';

/** Width every chart is prerendered at, and the first width it hydrates at. */
export const SSR_WIDTH = 640;

/**
 * Minty's measurements: from the island's loaded data in the browser, from
 * the server-only module during the prerender. Null when neither has them.
 */
export function useMinty() {
  return useContext(IslandData) || serverData;
}

/**
 * False on the server and on the first client render, true once hydrated.
 * Controls render `hidden` until then, so without JavaScript nobody is shown
 * knobs that can't do anything, and hydration matches the prerendered markup.
 */
export function useLive() {
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);
  return live;
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The element's width, for drawing a chart at its real size. Starts at the
 * prerender width so the first client render matches the server's, then
 * follows the element, settling for 120 ms first so a window drag doesn't
 * redraw on every pixel.
 */
export function useWidth(ref) {
  const [width, setWidth] = useState(SSR_WIDTH);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => { if (el.clientWidth) setWidth(el.clientWidth); };
    measure();
    if (!window.ResizeObserver) return undefined;
    let timer = null;
    const ro = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(measure, reduceMotion() ? 0 : 120);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, [ref]);
  return width;
}

/**
 * What a figure's live region says. `say` is immediate; `sayLater` waits for
 * input to settle, so a dragged slider is announced once where it stops
 * rather than at every step.
 */
export function useAnnouncer() {
  const [said, setSaid] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const say = useCallback((text) => {
    clearTimeout(timer.current);
    if (text) setSaid(text);
  }, []);
  const sayLater = useCallback((text) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (text) setSaid(text); }, 400);
  }, []);
  return { said, say, sayLater };
}
