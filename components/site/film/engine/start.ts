// Starts the film over the server-rendered scenes (handoff-home-film §5): the director, the planet, and on the
// full tier, only once the dive nears, the map. Plain TypeScript: `runtime.tsx` calls it after hydration, and the
// local harness calls it on a static page. It draws nothing of its own and returns the function that stops it.

import { createDirector } from "./director";
import { DISTRICTS, STOPS, createMap, type BdData, type FilmMap, type MapLib } from "./map";
import { HOME, createPlanet, project, type Cell, type Mask, type Planet } from "./planet";
import type { Tier } from "./tier";

/**
 * The dated file of supplier lights, `public/site/film/cells.json`. Today it holds the four district counts of
 * 3 Oct 2026; the cells read from production (handoff §6.1) replace its rows, and `chosen` arrives with them.
 */
export type CellFile = { date: string; what: string; cells: Cell[]; chosen?: [number, number] };

const DATA = "/site/film/";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
/** Where each label sits from the cluster, in pixels: a fan, so four places a few pixels apart can each be read. */
const FAN: readonly [number, number][] = [[150, -70], [128, -128], [168, -12], [150, 46]];

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
  const paths = (selector: string) => [...root.querySelectorAll<SVGPathElement>(`${selector} path`)].slice(0, 2);
  const fit = (svg: SVGSVGElement | null | undefined, w: number, h: number) => svg?.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const cells = loadCells();
  let dead = false;
  let planet: Planet | null = null;
  let map: FilmMap | null = null;
  let mapAsked = false;
  let mapP = 0;
  let planetP = 0;
  // Without a planet there is no film: the page goes back to the still tier, which is the stacked page.
  const giveUp = () => {
    html.dataset.filmTier = "still";
    stop();
  };

  // 01 · the planet
  const canvas = $<HTMLCanvasElement>("canvas[data-planet]");
  const callouts = [...root.querySelectorAll<HTMLElement>("[data-planet-callouts] > *")];
  const leads = [...root.querySelectorAll<SVGPathElement>("[data-planet-leads] path")];
  const planetThread = paths("[data-planet-thread]");
  void Promise.all([loadMask(), cells]).then(([mask, file]) => {
    if (dead || !canvas) return;
    planet = createPlanet(canvas, {
      mask,
      cells: file.cells,
      samples: tier === "full" ? 60000 : 16000,
      maxDpr: tier === "full" ? 2 : 1.5,
      onLost: giveUp,
      onFrame(rot, f) {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const at = project(rot, f, HOME.lng, HOME.lat);
        const far = clamp(1 - (f.r / (h * 0.66) - 1) * 3);
        fit(planetThread[0]?.ownerSVGElement, w, h);
        fit(leads[0]?.ownerSVGElement, w, h);
        const d = `M${at.x} ${at.y + 6}C${at.x - 8} ${at.y + 150} ${at.x - 96} ${at.y + 250} ${at.x - 110} ${h}`;
        for (const p of planetThread) p.setAttribute("d", d);
        DISTRICTS.forEach((place, i) => {
          const from = project(rot, f, place.at[0], place.at[1]);
          const x = at.x + FAN[i]![0], y = at.y + FAN[i]![1];
          const show = from.front ? String(far) : "0";
          if (callouts[i]) Object.assign(callouts[i].style, { transform: `translate(${x}px, ${y - 16}px)`, opacity: show });
          leads[i]?.setAttribute("d", `M${from.x} ${from.y}L${x - 8} ${y}`);
          if (leads[i]) leads[i].style.opacity = show;
        });
      },
    });
    // What the scroll said while the planet was still loading.
    if (planet) planet.setProgress(planetP);
    else giveUp();
  }, giveUp);

  // 02 and 03 · the map, loaded only when the dive nears and only on the full tier
  const stage = $<HTMLElement>("[data-map]");
  const acts = { districts: $<HTMLElement>('[data-act="districts"]'), record: $<HTMLElement>('[data-act="record"]') };
  const steps = [...root.querySelectorAll<HTMLElement>("[data-steps] > li")];
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
    map?.setProgress(p);
    map?.setDistrict(DISTRICTS[step]!.key);
    map?.setChosen(clamp((p - 0.74) / 0.14));
  };
  const wantMap = () => {
    if (mapAsked || tier !== "full" || !stage) return;
    mapAsked = true;
    void Promise.all([loadMapLib(), fetch(`${DATA}bd.json`).then((r) => r.json() as Promise<BdData>), cells]).then(([lib, bd, file]) => {
      if (dead) return;
      map = createMap(lib, stage, {
        bd,
        cells: file.cells,
        chosen: file.chosen,
        // The country sits right of the words; for the close on one factory the light moves to the gap between
        // the words and the record.
        padding: () => {
          const k = clamp((mapP - 0.7) / 0.3), w = stage.clientWidth;
          return { left: Math.round(w * (0.38 - 0.2 * k)), right: Math.round(w * 0.16 * k), top: 0, bottom: 0 };
        },
        onMove(proj) {
          const pane = acts.record?.querySelector("figure")?.getBoundingClientRect();
          const box = stage.getBoundingClientRect();
          if (!file.chosen || !pane) return;
          fit(mapThread[0]?.ownerSVGElement, box.width, box.height);
          const at = proj(file.chosen), x = pane.left - box.left, y = pane.top - box.top + 96;
          const d = `M${at.x + 10} ${at.y}C${at.x + 150} ${at.y} ${x - 130} ${y} ${x} ${y}`;
          for (const p of mapThread) p.setAttribute("d", d);
        },
      });
      showMap(mapP);
    }, () => {});
  };

  const director = createDirector(root, (name, p) => {
    if (name === "planet") {
      planetP = p;
      planet?.setProgress(p);
      if (p > 0.35) wantMap();
    }
    // Only the full tier holds the map scene; on a phone it is a stacked section and nothing in it may move.
    if (name === "map" && tier === "full") {
      // One drawing context at work at a time: the planet rests while the map runs.
      if (p > 0) planet?.park();
      else planet?.resume();
      if (p > 0) wantMap();
      showMap(p);
    }
  });

  function stop() {
    dead = true;
    director.destroy();
    planet?.destroy();
    map?.destroy();
    for (const act of Object.values(acts)) if (act) act.style.opacity = "";
  }
  return stop;
}
