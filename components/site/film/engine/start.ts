// Starts the film over the server-rendered scenes (handoff-home-film §5): the director, the planet, and on the
// full tier the city, which lies under the planet and takes over from it in one move; the planet comes back as the
// ground of the close. Plain TypeScript: `runtime.tsx` calls it after hydration, and the local harness calls it on
// a static page. It draws nothing of its own and returns the function that stops it.

import { startChapters } from "./chapters";
import { DISTRICTS, createCity, handoverFrame, toLocal, type BdData, type City, type V3 } from "./city";
import { all, createDirector, span } from "./director";
import { blendFrame, createPlanet, defaultFrame, type Cell, type Frame, type Mask, type Planet } from "./planet";
import type { Tier } from "./tier";

/**
 * The dated file of supplier lights, `public/site/film/cells.json` (handoff §6.1): one row per square kilometre
 * with published suppliers, the two counts the page prints ("mapped of suppliers have a mapped register address"), and
 * `chosen`, the story's one place from the record's own dated geocode. Built by scripts/film/build-cells.mjs;
 * never an address, a name or an id.
 */
export type CellFile = { date: string; what: string; mapped: number; suppliers: number; cells: Cell[]; chosen?: [number, number] };

const DATA = "/site/film/";
/** The close: the planet large at the right behind the words, Bangladesh facing, as the opening first drew it. */
export const closeFrame = (_p: number, w: number, h: number): Frame => ({ cx: w * 0.76, cy: h * 0.6, r: Math.max(h * 0.62, w * 0.36) });

/**
 * The opening's one scroll, 0 to 1 (§3.5, §4), as four stretches: the planet dives, the words leave, the planet
 * gives way to the city in place, then the city's own scroll runs (engine/city.ts). Each is 0 before its start and
 * 1 after its end. The dive is done, and the planet still, before it starts to give way: the planet's lights and
 * the city's roofs are one through the whole crossfade.
 */
export const OPENING = { dive: [0, 0.16], words: [0.05, 0.14], hand: [0.16, 0.23], city: [0.23, 1] } as const;
export const openingAt = (p: number) => ({ dive: span(OPENING.dive, p), words: span(OPENING.words, p), hand: span(OPENING.hand, p), city: span(OPENING.city, p) });

/** The city's scroll: which district's figure is up (one at a time, whole), and when the words give way to the story's factory. */
export const CITY_STEPS = { figures: [0.35, 0.57], factory: 0.8 } as const;
export function cityAt(p: number) {
  const figure = CITY_STEPS.figures.filter((at) => p >= at).length;
  return { figure, factory: p >= CITY_STEPS.factory };
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

export function startFilm(root: HTMLElement, tier: Tier): () => void {
  if (tier === "still") return () => {};
  const html = root.ownerDocument.documentElement;
  const $ = <T extends Element>(selector: string) => root.querySelector<T>(selector);
  const cells = loadCells();
  let dead = false;
  let planet: Planet | null = null;
  let city: City | null = null;
  let cityAsked = false;
  let cityP = -1;
  // Without a planet, or without the city it gives way to, there is no film: the page goes back to the still tier,
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
      // On the full tier the dive ends where the city begins; on a phone the planet keeps its own composition.
      frame: tier === "full" ? (p, w, h) => blendFrame(defaultFrame(0, w, h), handoverFrame(w, h), p) : undefined,
      onLost: giveUp,
    });
    if (!planet) return giveUp();
    // A planet that comes up once the close has its canvas takes the close's composition at once.
    placePlanet();
    // What the scroll said while the planet was still loading, on whichever scene is its clock.
    director.replay();
  }).catch(giveUp);

  // The city, under the planet, loaded as the dive begins and only on the full tier.
  const cityCanvas = $<HTMLCanvasElement>("canvas[data-city]");
  const acts = { planet: $<HTMLElement>('[data-act="planet"]'), hero: $<HTMLElement>("[data-hero]"), districts: $<HTMLElement>('[data-act="districts"]'), record: $<HTMLElement>('[data-act="record"]') };
  const steps = all<HTMLElement>(root, "[data-steps] > li");
  const places = all<HTMLElement>(root, "[data-city-labels] [data-place]");
  const factory = $<HTMLElement>("[data-city-factory]");
  let shownFigure = -1;
  let shownFactory: boolean | null = null;
  const showCity = (p: number) => {
    cityP = p;
    const at = cityAt(p);
    if (at.figure !== shownFigure) {
      shownFigure = at.figure;
      steps.forEach((li, i) => li.toggleAttribute("data-on", i === at.figure));
    }
    // Opacity only: both acts stay in the page for a screen reader, which does not scroll in step.
    if (at.factory !== shownFactory) {
      shownFactory = at.factory;
      if (acts.districts) acts.districts.style.opacity = at.factory ? "0" : "1";
      if (acts.record) acts.record.style.opacity = at.factory ? "1" : "0";
    }
    city?.setProgress(p);
  };
  // The names stand on the ground where each place is, written on the frame the city drew, so they move with it.
  let chosenAt: V3 | null = null;
  // A name over the words' column at the left would sit on the headline: it fades out before it gets there.
  const label = (el: HTMLElement | null | undefined, to: { x: number; y: number; front: boolean } | null, opacity: number) => {
    if (!el) return;
    const clear = to ? Math.max(0, Math.min(1, (to.x / (cityCanvas?.clientWidth || 1) - 0.47) / 0.06)) : 0;
    const o = to?.front ? (opacity * clear).toFixed(2) : "0";
    if (el.style.opacity !== o) el.style.opacity = o;
    if (o !== "0" && to) el.style.transform = `translate(${Math.round(to.x)}px, ${Math.round(to.y)}px)`;
  };
  const wantCity = () => {
    if (cityAsked || !cityCanvas) return;
    cityAsked = true;
    void Promise.all([fetch(`${DATA}bd.json`).then((r) => r.json() as Promise<BdData>), cells]).then(([bd, file]) => {
      if (dead) return;
      if (file.chosen) {
        const [x, z] = toLocal(file.chosen[0], file.chosen[1]);
        // Above the block, in the beam, clear of the towers' windows.
        chosenAt = [x, 0.7, z];
      }
      city = createCity(cityCanvas, {
        bd,
        cells: file.cells,
        chosen: file.chosen,
        maxDpr: 2,
        onLost: giveUp,
        onFrame(project) {
          const p = Math.max(0, cityP);
          const names = p > 0.06 && p < 0.84 ? 1 : 0;
          places.forEach((el, i) => {
            const d = DISTRICTS[i];
            if (!d) return;
            const [x, z] = toLocal(d.at[0], d.at[1]);
            label(el, project([x, 0, z]), names * (i === cityAt(p).figure ? 1 : 0.5));
          });
          label(factory, chosenAt ? project(chosenAt) : null, span([0.8, 0.88], p));
        },
      });
      // Without the city (a second drawing context refused, a shader that did not compile) the planet would give
      // way to an empty stage: the page goes back to the stacked one, with its pictures. A throw while making the
      // city lands here too, which `.then(ok, fail)` would have let through.
      if (!city) return giveUp();
      if (openingAt(openingP).hand <= 0) city.park();
      showCity(Math.max(0, cityP));
    }).catch(giveUp);
  };

  // The same planet, resumed as the ground of the close (§3.5: one instance, brought back). Its canvas is moved
  // into that scene's stage the moment the scene before it has run its hold, and back when it has not; at rest there
  // it takes the opening's first composition and drifts again.
  const closeStage = $<HTMLElement>("[data-planet-close]");
  /** The scene before the close in the film's own order is its cue: once that one has run its hold, the close is near. */
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
    // One drawing context at work at a time: the planet rests once the city has the screen, and the city rests
    // until the planet starts to give way.
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

  /** The opening at `p` on the full tier: the dive, the words, the handover, then the city. */
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
    if (p > 0.03) wantCity();
    if (at.hand > 0) city?.resume();
    else city?.park();
    // Only when the city's own scroll moved: while the planet dives the city waits, at its first camera, under it.
    if (at.city !== cityP) showCity(at.city);
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
    city?.destroy();
    // Everything written on the page is put back, so a page the film has left is the stacked page again.
    if (planetOwner === "close" && canvas && canvasHome?.parent) canvasHome.parent.insertBefore(canvas, canvasHome.next);
    for (const act of Object.values(acts)) if (act) Object.assign(act.style, { opacity: "", transform: "" });
    for (const el of [...places, factory]) if (el) Object.assign(el.style, { opacity: "", transform: "" });
    acts.hero?.removeAttribute("data-gone");
    acts.planet?.removeAttribute("data-past");
  }
  return stop;
}
