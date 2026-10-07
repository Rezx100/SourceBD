"use client";

// The film's one client piece. It renders nothing: after hydration it reads the tier the inline script set before
// the first paint (or decides it, after a client-side navigation) and starts the film (`engine/start.ts`) over the
// server-rendered scenes. The planet and the city are our own WebGL2: no library is loaded.

import { useEffect } from "react";
import { startFilm } from "./engine/start";
import { pickTier, readDevice, type Tier } from "./engine/tier";

export function FilmRuntime() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("main[data-film]");
    if (!root) return;
    // The inline script sets the tier before the first paint. It does not run when the page is reached by a
    // client-side navigation, so the tier is decided here then, by the same rule.
    const tier = (document.documentElement.dataset.filmTier ??= pickTier(readDevice())) as Tier;
    return startFilm(root, tier);
  }, []);
  return null;
}
