// The film's tier and its flag (handoff-home-film §5). The tier is decided once, on load, from what the device
// can carry: `full` (a desktop with a fine pointer and WebGL2), `lite` (phones and tablets: short holds, the planet
// at low density, stills for the maps and the atmosphere, solid panes), `still` (reduced motion, data saver or no
// WebGL2: today's stacked page). The flag (`filmOn`) is on; the build or the address can turn it off.

export type Tier = "full" | "lite" | "still";
export type Device = { width: number; finePointer: boolean; webgl2: boolean; reducedMotion: boolean; saveData: boolean };

export function pickTier(d: Device): Tier {
  if (d.reducedMotion || d.saveData || !d.webgl2) return "still";
  return d.width >= 1024 && d.finePointer ? "full" : "lite";
}

/**
 * The film is the home page (the flag went on with slice 6's last PR, 7 Oct 2026). A build that sets
 * NEXT_PUBLIC_HOME_FILM=0 turns it off; `?film=0` turns it off for one visit (today's stacked page, kept until
 * the founder calls the film permanent); `?film=1` turns it on whatever the build said.
 */
export function filmOn(param: unknown, env: string | undefined): boolean {
  if (param === "1") return true;
  if (param === "0") return false;
  return env !== "0";
}

export function readDevice(): Device {
  const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
  return {
    width: innerWidth,
    finePointer: matchMedia("(pointer: fine)").matches,
    // Whether the browser has WebGL2 at all. Making a context here, before the first paint, would cost a GPU
    // start-up; a device that has the API but cannot give a context falls back when the planet asks (start.ts).
    webgl2: typeof WebGL2RenderingContext !== "undefined",
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
