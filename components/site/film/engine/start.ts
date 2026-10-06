// Starts the film over the server-rendered scenes (handoff-home-film §5): the director, the planet, and on the
// full tier the map, which lies under the planet and takes over from it in one move, and later becomes the ground
// of scene 06 (the one map, moved into that scene's stage). Plain TypeScript: `runtime.tsx` calls it after
// hydration, and the local harness calls it on a static page. It draws nothing of its own and returns the function
// that stops it.

import { siteAt, startChapters, type Point } from "./chapters";
import { all, clamp, createDirector, fit, span } from "./director";
import { DISTRICTS, STOPS, cameraAt, createMap, siteStops, tileScale, type BdData, type FilmMap, type MapLib } from "./map";
import { HOME, blendFrame, createPlanet, defaultFrame, frameFor, project, type Cell, type Mask, type Planet } from "./planet";
import type { Tier } from "./tier";

/**
 * The dated file of supplier lights, `public/site/film/cells.json` (handoff §6.1): one row per square kilometre
 * with published suppliers, the two counts the page prints ("mapped of suppliers have a mapped register address"), and
 * `chosen`, the story's one place from the record's own dated geocode. Built by scripts/film/build-cells.mjs;
 * never an address, a name or an id.
 */
export type CellFile = { date: string; what: string; mapped: number; suppliers: number; cells: Cell[]; chosen?: [number, number] };

const DATA = "/site/film/";
/** Where each label sits from the cluster, in pixels: a fan, so four places a few pixels apart can each be read. */
const FAN: readonly [number, number][] = [[150, -70], [128, -128], [168, -12], [150, 46]];
/** The share of the stage's width the words keep at the left of the map; the camera centres in the rest. */
const WORDS_PAD = 0.38;
/** Scene 06: the ring sits between the words and the record (the record takes the right 0.3 of the stage), a little above the middle. */
const SITE_PAD = { left: 0.4, right: 0.37, top: 0.2 } as const;

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
  const paths = (selector: string) => all<SVGPathElement>(root, `${selector} path`).slice(0, 2);
  const cells = loadCells();
  let dead = false;
  let planet: Planet | null = null;
  let map: FilmMap | null = null;
  let mapAsked = false;
  let mapP = 0;
  let chosen: [number, number] | undefined;
  // Without a planet, or without the map it gives way to, there is no film: the page goes back to the still tier,
  // which is the stacked page. Once the film has stopped nothing that arrives late may stop it again or change the tier.
  const giveUp = () => {
    if (dead) return;
    html.dataset.filmTier = "still";
    stop();
  };

  // 01 · the planet
  const canvas = $<HTMLCanvasElement>("canvas[data-planet]");
  const callouts = all<HTMLElement>(root, "[data-planet-callouts] > *");
  const leads = all<SVGPathElement>(root, "[data-planet-leads] path");
  const planetThread = paths("[data-planet-thread]");
  const shown: string[] = [];
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
      onFrame(rot, f) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const at = project(rot, f, HOME.lng, HOME.lat);
        const far = clamp(1 - (f.r / (h * 0.66) - 1) * 3);
        // Each write only when its value moved: a write of the same string still costs a style pass.
        fit(planetThread[0]?.ownerSVGElement, w, h);
        fit(leads[0]?.ownerSVGElement, w, h);
        const d = `M${at.x} ${at.y + 6}C${at.x - 8} ${at.y + 150} ${at.x - 96} ${at.y + 250} ${at.x - 110} ${h}`;
        for (const p of planetThread) p.setAttribute("d", d);
        DISTRICTS.forEach((place, i) => {
          const from = project(rot, f, place.at[0], place.at[1]);
          const x = at.x + FAN[i]![0], y = at.y + FAN[i]![1];
          const show = from.front ? String(far) : "0";
          // A label that has gone and stays gone is left alone.
          if (show === "0" && shown[i] === "0") return;
          shown[i] = show;
          if (callouts[i]) Object.assign(callouts[i].style, { transform: `translate(${x}px, ${y - 16}px)`, opacity: show });
          leads[i]?.setAttribute("d", `M${from.x} ${from.y}L${x - 8} ${y}`);
          if (leads[i]) leads[i].style.opacity = show;
        });
      },
    });
    if (!planet) return giveUp();
    // What the scroll said while the planet was still loading, on whichever scene is its clock.
    director.replay();
  }).catch(giveUp);

  // 02 and 03 · the map, under the planet, loaded as the dive begins and only on the full tier
  const stage = $<HTMLElement>("[data-map]");
  const acts = { planet: $<HTMLElement>('[data-act="planet"]'), hero: $<HTMLElement>("[data-hero]"), districts: $<HTMLElement>('[data-act="districts"]'), record: $<HTMLElement>('[data-act="record"]') };
  const steps = all<HTMLElement>(root, "[data-steps] > li");
  const mapThread = paths("[data-map-thread]");
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
    mapThread[0]?.parentElement?.style.setProperty("--p", String(clamp((p - 0.82) / 0.14)));
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
      chosen = file.chosen;
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
        onMove(proj) {
          // The thread draws from 0.82: until the camera nears, nothing to lay out; and nothing while scene 06 has
          // the map, whose every frame would otherwise lay out this thread off screen.
          if (mapP < 0.8 || owner === "site") return;
          const pane = acts.record?.querySelector("figure")?.getBoundingClientRect();
          const box = stage.getBoundingClientRect();
          if (!file.chosen || !pane) return;
          fit(mapThread[0]?.ownerSVGElement, box.width, box.height);
          const at = proj(file.chosen), x = pane.left - box.left, y = pane.top - box.top + 96;
          const d = `M${at.x + 10} ${at.y}C${at.x + 150} ${at.y} ${x - 130} ${y} ${x} ${y}`;
          for (const p of mapThread) p.setAttribute("d", d);
        },
      });
      if (owner === "site") placeSite();
      else showMap(mapP);
      // Without the map (the library, its data, or a second drawing context refused) the planet would give way to
      // an empty stage: the page goes back to the stacked one, with its pictures. A throw while making the map
      // lands here too, which `.then(ok, fail)` would have let through.
    }).catch(giveUp);
  };

  // 06 · the same map, as the ground of the scene on the factory's own area. Its stage is moved into that scene the
  // moment scene 05 has run its hold (the scene after it is then just below the screen), and back when it has not;
  // one drawing context serves both. The chapters' engine asks for the camera at each step (`site`) and ties its
  // thread to where the light is.
  const sitePlace = $<HTMLElement>("[data-map-site]");
  const home = stage ? { parent: stage.parentElement, next: stage.nextSibling } : null;
  let owner: "opening" | "site" = "opening";
  let siteP = 0;
  const placeSite = () => {
    if (!map || !chosen || !stage) return;
    const at = siteAt(siteP);
    map.setCamera(cameraAt(at.camera, siteStops(chosen)), () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      return { left: Math.round(w * SITE_PAD.left), right: Math.round(w * SITE_PAD.right), top: Math.round(h * SITE_PAD.top), bottom: 0 };
    });
    map.setChosen(1);
    map.setRing(at.ring);
  };
  const own = (want: typeof owner) => {
    if (want === owner || !stage || !home?.parent || !sitePlace) return;
    owner = want;
    if (want === "site") sitePlace.appendChild(stage);
    else home.parent.insertBefore(stage, home.next);
    if (!map) return;
    if (want === "site") placeSite();
    else {
      map.setRing(0);
      showMap(mapP);
    }
  };
  const site = (p: number): Point | null => {
    siteP = p;
    if (owner !== "site" || !map || !chosen) return null;
    placeSite();
    return map.project(chosen);
  };

  /** The opening at `p` on the full tier: the dive, the words, the handover, then the map. */
  const show = (p: number) => {
    if (tier !== "full") return;
    const at = openingAt(p);
    planet?.setProgress(at.dive);
    // The planet's thread draws with the dive: its act is laid over the stage here and has no scroll of its own.
    planetThread[0]?.parentElement?.style.setProperty("--p", String(at.dive));
    // The words leave and the planet's act gives way: written on the two of them, not as a property the whole
    // scene would inherit (and restyle for) on every frame. What has gone also lets the pointer through (app/ds.css).
    if (acts.hero) Object.assign(acts.hero.style, { opacity: String(1 - at.words), transform: `translateY(${-40 * at.words}px)` });
    if (acts.planet) acts.planet.style.opacity = String(1 - at.hand);
    acts.hero?.toggleAttribute("data-gone", at.words >= 1);
    acts.planet?.toggleAttribute("data-past", at.hand >= 1);
    // One drawing context at work at a time: the planet rests once the map has the screen.
    if (at.hand >= 1) planet?.park();
    else planet?.resume();
    if (p > 0.04) wantMap();
    // Only when the map's own scroll moved: while the planet dives the map waits, unplaced again, under it.
    if (at.map !== mapP) showMap(at.map);
  };

  // 04 onwards · the chapters that hold on the full tier (engine/chapters.ts).
  const chapters = startChapters(root, tier, { site });
  const director = createDirector(root, (name, p) => {
    if (name === "opening") show(p);
    if (name === "receipts" && tier === "full") own(p >= 1 ? "site" : "opening");
    // On a phone the planet holds while it turns and the rest is stacked: its own section is its clock, and its
    // thread draws with it.
    if (name === "planet" && tier === "lite") {
      planet?.setProgress(p);
      planetThread[0]?.parentElement?.style.setProperty("--p", String(p));
    }
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
    if (owner === "site" && stage && home?.parent) home.parent.insertBefore(stage, home.next);
    for (const act of Object.values(acts)) if (act) Object.assign(act.style, { opacity: "", transform: "" });
    acts.hero?.removeAttribute("data-gone");
    acts.planet?.removeAttribute("data-past");
  }
  return stop;
}
