/**
 * base.js — the depth prefix for the page being rendered.
 *
 * Context rather than a prop drilled through every component: it's set once per
 * page from the entry's data-base attribute and never changes during a render.
 */

import { createContext, useContext } from 'react';

export const BaseContext = createContext('./');
export const useBase = () => useContext(BaseContext);
