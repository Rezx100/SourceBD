// Starts the film over the server-rendered scenes (handoff-home-film §5): the director, the planet, and on the
// full tier the map, which lies under the planet and takes over from it in one move; the planet comes back as the
// ground of the close. Plain TypeScript: `runtime.tsx` calls it after hydration, and the local harness calls it on
// a static page. It draws nothing of its own and returns the function that stops it.

import { startChapters } from "./chapters";
import { all, clamp, createDirector, span } from "./director";
import { DISTRICTS, STOPS, createMap, tileScale, type BdData, type FilmMap, type MapLib } from "./map";
import { blendFrame, createPlanet, defaultFrame, frameFor, type Cell, type Frame, type Mask, type Planet } from "./planet";
import type { Tier } from "./tier";

/**
 * The dated file of supplier lights, `public/site/film/cells.json` (handoff §6.1): one row per square kilometre
 * with published suppliers, the two counts the page prints ("mapped of suppliers have a mapped register address"), and
 * `chosen`, the story's one place from the record's own dated geocode. Built by scripts/film/build-cells.mjs;
 * never an address, a name or an id.
 */
export type CellFile = { date: string; what: string; mapped: number; suppliers: number; cells: Cell[]; chosen?: [number, number] };

const DATA = "/site/film/";
/** The share of the stage's width the words keep at the left of the map; the camera centres in the rest. */
const WORDS_PAD = 0.38;
/** The close: the planet large at the right behind the words, Bangladesh facing, as the opening first drew it. */
export const closeFrame = (_p: number, w: number, h: number): Frame => ({ cx: w * 0.76, cy: h * 0.6, r: Math.max(h * 0.62, w * 0.36) });

/**
 * The opening's one scroll, 0 to 1 (§3.5, §4), as four stretches: the planet dives, the words leave, the planet
 * gives way to the map in place, then the map's own scroll (`STOPS`) runs. Each is 0 before its start and 1
 * after its end. The dive is done, and the planet still, before it starts to give way: the two countries are one
 * through the whole crossfade. The map waits at its first mark until the planet has gone.
 */
export const OPENING = { dive: [0, 0.18], words: [0.08, 0.18], hand: [0.18, 0.28], map: [0.28, 1] } as const;
export const openingAt = (p: number) => ({ dive: span(OPENING.dive, p), words: span(OPENING.words, p), hand: span(OPENING.hand, p), map: span(OPENING.map, p) });

/** Where the dive ends: Bangladesh at the map's first camera, at its centre and its scale, so the map takes over in place. */
export function handoverFrame(w: number, h: number) {
  const first = STOPS[0]!;
  return frameFor(tileScale(first.zoom), first.center[1], (w * (1 + WORDS_PAD)) / 2, h / 2);
}

async function loadMask(): Promise<Mask> {
  const img = new Image();
  img.src = `${DATA}land.png`;
  await img.decode();
  const canvas = Object.assign(document.createElement("canvas"), { width: img.width, height: img.height });
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}

const loadCells = async (): Promise<CellFile> => (await (await fetch(`${DATA}cells.json`)).json()) as CellFile;

export function startFilm(root: HTMLElement, tier: Tier, loadMapLib: () => Promise<MapLib>): () => void {
  if (tier === "still") return () => {};
  const html = root.ownerDocument.documentElement;
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const cells = loadCells();
  let dead = false;
  let planet: Planet | null = null;
  let map: FilmMap | null = null;
  let mapAsked = false;
  let mapP = 0;
  // Without a planet, or without the map it gives way to, there is no film: the page goes back to the still tier,
  // which is the stacked page. Once the film has stopped nothing that arrives late may stop it again or change the tier.
  const giveUp = () => {
    if (dead) return;
    html.dataset.filmTier = "still";
    stop();
  };

  // The planet
  const canvas = $<HTMLCanvasElement>("canvas[data-planet]");
  void Promise.all([loadMask(), cells]).then(([mask, file]) => {
    if (dead || !canvas) return;
    planet = createPlanet(canvas, {
      mask,
      cells: file.cells,
      samples: tier === "full" ? 60000 : 16000,
      maxDpr: tier === "full" ? 2 : 1.5,
      // On the full tier the dive ends where the map begins; on a phone the planet keeps its own composition.
      frame: tier === "full" ? (p, w, h) => blendFrame(defaultFrame(0, w, h), handoverFrame(w, h), p) : undefined,
      onLost: giveUp,
    });
    if (!planet) return giveUp();
    // A planet that comes up once the close has its canvas takes the close's composition at once.
    placePlanet();
    // What the scroll said while the planet was still loading, on whichever scene is its clock.
    director.replay();
  }).catch(giveUp);

  // The map, under the planet, loaded as the dive begins and only on the full tier
  const stage = $<HTMLElement>("[data-map]");
  const acts = { planet: $<HTMLElement>('[data-act="planet"]'), hero: $<HTMLElement>("[data-hero]"), districts: $<HTMLElement>('[data-act="districts"]'), record: $<HTMLElement>('[data-act="record"]') };
  const steps = all<HTMLElement>(root, "[data-steps] > li");
  const marks = STOPS.slice(1, 1 + DISTRICTS.length).map((s) => s.p);
  const showMap = (p: number) => {
    mapP = p;
    // A district's figure shows while the camera travels to its mark; past the last mark the last one holds.
    const next = marks.findIndex((m) => p < m);
    const step = next < 0 ? DISTRICTS.length - 1 : next;
    steps.forEach((li, i) => li.toggleAttribute("data-on", i === step));
    const second = p > 0.76;
    // Opacity only: both acts stay in the page for a screen reader, which does not scroll in step.
    if (acts.districts) acts.districts.style.opacity = second ? "0" : "1";
    if (acts.record) acts.record.style.opacity = second ? "1" : "0";
    // The map keeps its own state and paints only what changed, whether it was up for this step or came up later.
    map?.setProgress(p);
    map?.setDistrict(DISTRICTS[step]!.key);
    map?.setChosen(clamp((p - 0.74) / 0.14));
  };
  const wantMap = () => {
    if (mapAsked || !stage) return;
    mapAsked = true;
    void Promise.all([loadMapLib(), fetch(`${DATA}bd.json`).then((r) => r.json() as Promise<BdData>), cells]).then(([lib, bd, file]) => {
      if (dead) return;
      map = createMap(lib, stage, {
        bd,
        cells: file.cells,
        chosen: file.chosen,
        // Whatever scene has the map once it is up says its camera again, and the threads that wait on it are laid.
        onReady: () => director.replay(),
        // The country sits right of the words; for the close on one factory the light moves to the gap between
        // the words and the record.
        padding: () => {
          const k = clamp((mapP - 0.7) / 0.3), w = stage.clientWidth;
          return { left: Math.round(w * (WORDS_PAD - 0.2 * k)), right: Math.round(w * 0.16 * k), top: 0, bottom: 0 };
        },
      });
      showMap(mapP);
      // Without the map (the library, its data, or a second drawing context refused) the planet would give way to
      // an empty stage: the page goes back to the stacked one, with its pictures. A throw while making the map
      // lands here too, which `.then(ok, fail)` would have let through.
    }).catch(giveUp);
  };

  // The same planet, resumed as the ground of the close (§3.5: one instance, brought back). Its canvas is moved
  // into that scene's stage the moment the scene before it has run its hold, and back when it has not; at rest there
  // it takes the opening's first composition and drifts again.
  const closeStage = $<HTMLElement>("[data-planet-close]");
  /** The scene before the close in the film's own order is its cue: once that one has run its hold, the close is just below the screen. */
  const sceneNames = all<HTMLElement>(root, "[data-scene]").map((el) => el.dataset.scene ?? "");
  const closeCue = sceneNames[sceneNames.indexOf(closeStage?.closest<HTMLElement>("[data-scene]")?.dataset.scene ?? "") - 1] ?? null;
  const canvasHome = canvas ? { parent: canvas.parentElement, next: canvas.nextSibling } : null;
  let planetOwner: "opening" | "close" = "opening";
  let openingP = 0;
  /** The planet as whichever scene has it asks: the close's rest, or the opening's dive, parked once it has given way. */
  const placePlanet = () => {
    if (!planet) return;
    if (planetOwner === "close") {
      planet.setFrame(closeFrame);
      planet.setProgress(0);
      planet.resume();
      return;
    }
    planet.setFrame(null);
    const at = openingAt(openingP);
    planet.setProgress(at.dive);
    // One drawing context at work at a time: the planet rests once the map has the screen.
    if (at.hand >= 1) planet.park();
    else planet.resume();
  };
  const ownPlanet = (want: typeof planetOwner) => {
    if (want === planetOwner || !canvas || !canvasHome?.parent || !closeStage) return;
    planetOwner = want;
    if (want === "close") closeStage.appendChild(canvas);
    else canvasHome.parent.insertBefore(canvas, canvasHome.next);
    placePlanet();
  };

  /** The opening at `p` on the full tier: the dive, the words, the handover, then the map. */
  const show = (p: number) => {
    if (tier !== "full") return;
    openingP = p;
    const at = openingAt(p);
    if (planetOwner === "opening") placePlanet();
    // The words leave and the planet's act gives way: written on the two of them, not as a property the whole
    // scene would inherit (and restyle for) on every frame. What has gone also lets the pointer through (app/ds.css).
    if (acts.hero) Object.assign(acts.hero.style, { opacity: String(1 - at.words), transform: `translateY(${-40 * at.words}px)` });
    if (acts.planet) acts.planet.style.opacity = String(1 - at.hand);
    acts.hero?.toggleAttribute("data-gone", at.words >= 1);
    acts.planet?.toggleAttribute("data-past", at.hand >= 1);
    if (p > 0.04) wantMap();
    // Only when the map's own scroll moved: while the planet dives the map waits, unplaced again, under it.
    if (at.map !== mapP) showMap(at.map);
  };

  // The chapters that hold on the full tier (engine/chapters.ts).
  const chapters = startChapters(root, tier);
  const director = createDirector(root, (name, p) => {
    if (name === "opening") show(p);
    if (name === closeCue && tier === "full") ownPlanet(p >= 1 ? "close" : "opening");
    // On a phone the planet holds while it turns and the rest is stacked: its own section is its clock.
    if (name === "planet" && tier === "lite") planet?.setProgress(p);
    chapters.onScene(name, p);
  });

  function stop() {
    if (dead) return;
    dead = true;
    director.destroy();
    chapters.stop();
    planet?.destroy();
    map?.destroy();
    // Everything written on the page is put back, so a page the film has left is the stacked page again.
    if (planetOwner === "close" && canvas && canvasHome?.parent) canvasHome.parent.insertBefore(canvas, canvasHome.next);
    for (const act of Object.values(acts)) if (act) Object.assign(act.style, { opacity: "", transform: "" });
    acts.hero?.removeAttribute("data-gone");
    acts.planet?.removeAttribute("data-past");
  }
  return stop;
}
