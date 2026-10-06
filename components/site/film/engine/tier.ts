// The film's tier and its flag (handoff-home-film §5). The tier is decided once, on load, from what the device
// can carry: `full` (a desktop with a fine pointer and WebGL2), `lite` (phones and tablets: short holds, the planet
// at low density, stills for the maps and the atmosphere, solid panes), `still` (reduced motion, data saver or no
// WebGL2: today's stacked page). The flag keeps the film off `/` until the founder turns it on.

export type Tier = "full" | "lite" | "still";
export type Device = { width: number; finePointer: boolean; webgl2: boolean; reducedMotion: boolean; saveData: boolean };

export function pickTier(d: Device): Tier {
  if (d.reducedMotion || d.saveData || !d.webgl2) return "still";
  return d.width >= 1024 && d.finePointer ? "full" : "lite";
}

/** The film mounts when the address carries `?film=1` (`param` is that value), or the build set NEXT_PUBLIC_HOME_FILM=1. Nothing else turns it on. */
export function filmOn(param: unknown, env: string | undefined): boolean {
  return env === "1" || param === "1";
}

export function readDevice(): Device {
  const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return {
    width: innerWidth,
    finePointer: matchMedia("(pointer: fine)").matches,
    webgl2: !!document.createElement("canvas").getContext("webgl2"),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: saver,
  };
}

/**
 * The tier, set on the root before the first paint: the page never draws stacked and then jumps into the film.
 * It is the two functions above, as source, so there is one rule and not a second copy written as a string;
 * `film.test.ts` runs this text against a stand-in browser.
 */
export const TIER_SCRIPT = `document.documentElement.dataset.filmTier=(${pickTier})((${readDevice})())`;
