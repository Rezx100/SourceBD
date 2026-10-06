// The map (handoff-home-film §3.6): our own cartography of Bangladesh, live, with the camera driven by the
// scroll. One map carries three scenes: the country with its four districts (02), the close on Gazipur with one
// green light (03), and the tilt down to Kashimpur (06). It is drawn by the map library the app already has
// (`bkoi-gl`, which runs a style of our own with no key and no tiles: verified 6 Oct 2026), from our own data:
// the districts, the great rivers, the neighbours' land, and our supplier cells as light. Labels are DOM, never
// map glyphs. Paint comes from the CSS variables of the container's scope, so a theme change is `recolor()`.
//
// Plain TypeScript with the library passed in: the pure parts (`unpack`, `toGeo`, `cameraAt`, `column`) run under
// `node --test`, and the scene loads the library only when the dive nears.

import { HOME, type Cell } from "./planet";

export type BdData = { credit: string; unit: number; box: number[]; districts: { name: string; rings: number[][] }[]; around: number[][]; rivers: { w: number; line: number[] }[] };
type Position = [number, number];
type Feature = { type: "Feature"; properties: Record<string, string | number>; geometry: { type: string; coordinates: unknown } };
type Collection = { type: "FeatureCollection"; features: Feature[] };
export type Camera = { center: Position; zoom: number; pitch: number; bearing: number };

/** The slice of the map library this file uses, so a test can pass a stand-in. */
export type GlMap = {
  on(event: string, handler: () => void): void;
  jumpTo(camera: Camera & { padding?: Record<string, number> }): void;
  project(at: Position): { x: number; y: number };
  setPaintProperty(layer: string, name: string, value: unknown): void;
  resize(): void;
  remove(): void;
};
export type MapLib = { Map: new (options: Record<string, unknown>) => GlMap };

/** A ring from `bd.json`: integers in 1/`unit` of a degree, the first point whole, the rest steps. */
export function unpack(flat: number[], unit: number): Position[] {
  const out: Position[] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i]!;
    y += flat[i + 1]!;
    out.push([x / unit, y / unit]);
  }
  return out;
}

const collect = (features: Feature[]): Collection => ({ type: "FeatureCollection", features });
const closed = (ring: Position[]): Position[] => (ring.length && (ring[0]![0] !== ring.at(-1)![0] || ring[0]![1] !== ring.at(-1)![1]) ? [...ring, ring[0]!] : ring);

/** The four districts of the story, as counted on 3 Oct 2026 from the suppliers' register addresses. */
export const DISTRICTS = [
  { key: "Dhaka", label: "Dhaka district", count: 4421, at: [90.36, 23.8] },
  { key: "Gazipur", label: "Gazipur", count: 1819, at: [90.42, 24.03] },
  { key: "Narayanganj", label: "Narayanganj", count: 1628, at: [90.53, 23.66] },
  { key: "Chittagong", label: "Chattogram", count: 1080, at: [91.83, 22.4] },
] as const satisfies readonly { key: string; label: string; count: number; at: readonly [number, number] }[];

const METRES_PER_SUPPLIER = 16;

/** A six-sided column standing on a place: its footprint in degrees, its height in metres from the count. */
export function column(at: Position, count: number, km = 4.5): Feature {
  const ring: Position[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ring.push([at[0] + (Math.cos(a) * km) / (111.32 * Math.cos((at[1] * Math.PI) / 180)), at[1] + (Math.sin(a) * km) / 110.57]);
  }
  return { type: "Feature", properties: { height: count * METRES_PER_SUPPLIER }, geometry: { type: "Polygon", coordinates: [ring] } };
}

export function toGeo(bd: BdData, cells: readonly Cell[]) {
  const poly = (rings: number[][]) => ({ type: "MultiPolygon", coordinates: rings.map((r) => [closed(unpack(r, bd.unit))]) });
  return {
    districts: collect(bd.districts.map((d) => ({ type: "Feature", properties: { name: d.name }, geometry: poly(d.rings) }))),
    around: collect([{ type: "Feature", properties: {}, geometry: poly(bd.around) }]),
    rivers: collect(bd.rivers.map((r) => ({ type: "Feature", properties: { w: r.w }, geometry: { type: "LineString", coordinates: unpack(r.line, bd.unit) } }))),
    cells: collect(cells.map(([lng, lat, count]) => ({ type: "Feature", properties: { count }, geometry: { type: "Point", coordinates: [lng, lat] } }))),
    columns: collect(DISTRICTS.map((d) => {
      const c = column([...d.at], d.count);
      return { ...c, properties: { ...c.properties, name: d.key } };
    })),
  };
}

/** Pixels per degree of longitude at a zoom (512-pixel tiles): the scale the planet's dive ends at (§3.5). */
export const tileScale = (zoom: number): number => (512 * 2 ** zoom) / 360;

/**
 * The camera's marks along the map's own scroll, 0 to 1: the handover, each district in turn, then Gazipur. The
 * first mark is where the planet leaves off (`handoverFrame` in start.ts): north up, barely tilted, the country
 * small in its region, so the map takes over in place and the camera keeps coming in.
 */
export const STOPS: readonly (Camera & { p: number })[] = [
  { p: 0, center: [HOME.lng, HOME.lat], zoom: 5.5, pitch: 18, bearing: 0 },
  { p: 0.2, center: [90.36, 23.6], zoom: 6.35, pitch: 42, bearing: -8 },
  { p: 0.4, center: [90.42, 23.75], zoom: 6.5, pitch: 44, bearing: -4 },
  { p: 0.55, center: [90.53, 23.5], zoom: 6.5, pitch: 44, bearing: 2 },
  { p: 0.7, center: [91.0, 23.0], zoom: 6.5, pitch: 44, bearing: 8 },
  { p: 1, center: [90.33, 24.0], zoom: 9.4, pitch: 28, bearing: 0 },
];

/** The camera at `p`: eased between the two marks around it, so a step lands whole and a pause holds still. */
export function cameraAt(p: number, stops: readonly (Camera & { p: number })[] = STOPS): Camera {
  const v = Math.max(stops[0]!.p, Math.min(stops.at(-1)!.p, p));
  const i = Math.max(1, stops.findIndex((s) => s.p >= v));
  const a = stops[i - 1]!, b = stops[i]!;
  const t = b.p === a.p ? 1 : (v - a.p) / (b.p - a.p);
  const e = t * t * (3 - 2 * t);
  const mix = (x: number, y: number) => x + (y - x) * e;
  return { center: [mix(a.center[0], b.center[0]), mix(a.center[1], b.center[1])], zoom: mix(a.zoom, b.zoom), pitch: mix(a.pitch, b.pitch), bearing: mix(a.bearing, b.bearing) };
}

const color = (el: Element, name: string, alpha = 1) => {
  const [r, g, b] = getComputedStyle(el).getPropertyValue(name).trim().split(/\s+/);
  return `rgba(${r ?? 0},${g ?? 0},${b ?? 0},${alpha})`;
};

/** Every paint value that carries a colour, by layer, read from the tokens in the container's scope. */
function paint(el: Element, on: string | null) {
  const c = (name: string, alpha?: number) => color(el, `--ds-${name}`, alpha);
  // On a light ground a supplier's light is ink: a blurred mass of it reads as soot, so the glow stays faint
  // there and the cells carry the picture as dots. On a dark ground it is light and may bloom.
  const sum = (name: string) => getComputedStyle(el).getPropertyValue(`--ds-${name}`).trim().split(/\s+/).reduce((s, v) => s + Number(v), 0);
  const glow = sum("map-light") < sum("map-land") ? 0.22 : 1;
  return {
    sea: { "background-color": c("map-water") },
    around: { "fill-color": c("subtle") },
    halo: { "line-color": c("line-strong") },
    land: { "fill-color": c("map-land") },
    seams: { "line-color": c("map-land") },
    four: { "fill-color": c("sunken"), "fill-outline-color": c("line-strong", 0.6) },
    rivers: { "line-color": c("map-water") },
    glow: { "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, c("map-light", 0), 0.25, c("map-light", 0.28 * glow), 0.6, c("map-light", 0.6 * glow), 1, c("map-light", 0.92 * glow)] },
    cells: { "circle-color": c("map-light") },
    columns: { "fill-extrusion-color": ["case", ["==", ["get", "name"], on ?? ""], c("ink"), c("ink-3")] },
    chosen: { "circle-color": c("brand-ink"), "circle-stroke-color": c("surface") },
  } as Record<string, Record<string, unknown>>;
}

export type FilmMap = {
  /** The map's own scroll, 0 to 1 (see `STOPS`). */
  setProgress(p: number): void;
  /** The district whose column and outline stand out, by `DISTRICTS[].key`. */
  setDistrict(key: string | null): void;
  /** Dim the supplier lights and show the one green light at `chosen` (0 to 1). */
  setChosen(level: number): void;
  recolor(): void;
  destroy(): void;
};

export function createMap(lib: MapLib, container: HTMLElement, opts: {
  bd: BdData;
  cells: readonly Cell[];
  /** The place the story follows. It comes from the record's own dated geocode, passed in by the scene: never typed here. */
  chosen?: Position;
  padding?: () => Record<string, number>; onMove?: (project: (at: Position) => { x: number; y: number }) => void;
}): FilmMap {
  const geo = toGeo(opts.bd, opts.cells);
  const four = ["in", ["get", "name"], ["literal", DISTRICTS.map((d) => d.key)]];
  // A zoom ramp: `at` zoom, value pairs. `by` scales every value (a number, or an expression such as a feature's width).
  const byZoom = (stops: number[], by: unknown = 1) => ["interpolate", ["linear"], ["zoom"], ...stops.map((v, i) => (i % 2 ? (typeof by === "number" ? v * by : ["*", v, by]) : v))];
  let district: string | null = null;
  let chosen = 0;
  const colours = paint(container, district);
  const map = new lib.Map({
    container,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    ...cameraAt(0),
    style: {
      version: 8,
      sources: Object.fromEntries(Object.entries({ ...geo, chosen: collect(opts.chosen ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: opts.chosen } }] : []) }).map(([id, data]) => [id, { type: "geojson", data }])),
      layers: [
        { id: "sea", type: "background", paint: colours.sea },
        { id: "around", type: "fill", source: "around", paint: colours.around },
        { id: "halo", type: "line", source: "districts", paint: { ...colours.halo, "line-width": byZoom([5, 2.2, 10, 3.5]) } },
        { id: "land", type: "fill", source: "districts", paint: { ...colours.land, "fill-antialias": false } },
        { id: "seams", type: "line", source: "districts", paint: { ...colours.seams, "line-width": 1 } },
        { id: "four", type: "fill", source: "districts", filter: four, paint: colours.four },
        { id: "rivers", type: "line", source: "rivers", layout: { "line-cap": "round", "line-join": "round" }, paint: { ...colours.rivers, "line-width": byZoom([5, 0.9, 7, 2.2, 10, 6], ["get", "w"]) } },
        { id: "glow", type: "heatmap", source: "cells", maxzoom: 11, paint: { ...colours.glow, "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 1, 0.15, 40, 1], "heatmap-radius": byZoom([5, 5, 7, 12, 10, 34]), "heatmap-intensity": byZoom([5, 0.3, 7, 0.5, 10, 1.3]) } },
        { id: "cells", type: "circle", source: "cells", paint: { ...colours.cells, "circle-radius": byZoom([5, 0.7, 8, 1.2, 12, 4]), "circle-opacity": byZoom([5, 0.45, 9.5, 0.9]) } },
        { id: "columns", type: "fill-extrusion", source: "columns", maxzoom: 8.6, paint: { ...colours.columns, "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.92 } },
        { id: "chosen", type: "circle", source: "chosen", paint: { ...colours.chosen, "circle-radius": 7, "circle-stroke-width": 2, "circle-opacity": 0, "circle-stroke-opacity": 0 } },
      ],
    },
  });

  let ready = false;
  let p = 0;
  const place = () => {
    map.jumpTo({ ...cameraAt(p), padding: opts.padding?.() });
    opts.onMove?.((at) => map.project(at));
  };
  const apply = (set: Record<string, Record<string, unknown>>) => {
    for (const [layer, values] of Object.entries(set)) for (const [name, value] of Object.entries(values)) map.setPaintProperty(layer, name, value);
  };
  const dim = () => {
    if (!ready) return;
    map.setPaintProperty("glow", "heatmap-opacity", 1 - chosen * 0.75);
    map.setPaintProperty("cells", "circle-opacity", byZoom([5, 0.45, 9.5, 0.9], 1 - chosen * 0.75));
    map.setPaintProperty("chosen", "circle-opacity", chosen);
    map.setPaintProperty("chosen", "circle-stroke-opacity", chosen);
  };
  map.on("load", () => {
    ready = true;
    place();
    // What was asked for while the style was loading: the district, the colours of the theme, the one light.
    apply(paint(container, district));
    dim();
  });
  const sized = new ResizeObserver(() => {
    map.resize();
    if (ready) place();
  });
  sized.observe(container);

  return {
    setProgress(v) {
      p = v;
      if (ready) place();
    },
    // Each is a round of paint, so a value that has not changed is not set again; what was asked before the style
    // loaded is applied on `load`, so a map that comes up late still takes the scroll's current state.
    setDistrict(key) {
      if (key === district) return;
      district = key;
      if (ready) apply({ columns: paint(container, district).columns! });
    },
    setChosen(level) {
      if (level === chosen) return;
      chosen = level;
      dim();
    },
    recolor() {
      if (ready) apply(paint(container, district));
    },
    destroy() {
      sized.disconnect();
      map.remove();
    },
  };
}
