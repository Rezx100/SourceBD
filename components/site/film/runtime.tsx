"use client";

// The film's one client piece. It renders nothing: after hydration it reads the tier the inline script set before
// the first paint and starts the film (`engine/start.ts`) over the server-rendered scenes. The map library is
// asked for only when the film asks, which is when the dive nears on the full tier.

import { useEffect } from "react";
import type { MapLib } from "./engine/map";
import { startFilm } from "./engine/start";
import type { Tier } from "./engine/tier";

export function FilmRuntime() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("main[data-film]");
    const tier = document.documentElement.dataset.filmTier as Tier | undefined;
    if (!root || !tier) return;
    return startFilm(root, tier, async () => (await import("bkoi-gl")) as unknown as MapLib);
  }, []);
  return null;
}
