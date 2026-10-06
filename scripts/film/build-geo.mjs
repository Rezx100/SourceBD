// Builds the home film's geography (handoff-home-film §6.2) from open data, once, into public/site/film/:
//
//   land.png  the planet's land mask: 720x360, equirectangular, white = land. Natural Earth 1:50m land.
//   bd.json   the map of Bangladesh: its 64 districts (their union is the country), the great rivers, and the
//             neighbours' land for context. Coordinates are integers in 1/1000 of a degree, each ring delta-coded.
//
// Sources, licences and the date read are recorded in ops/plans/home-film-data.md and credited on
// /legal/data-sources. Usage: node scripts/film/build-geo.mjs [cache-dir]   (files are fetched when missing)

import { deflateSync, crc32 } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const SOURCES = {
  "ne_50m_land.geojson": NE + "ne_50m_land.geojson", // public domain
  "ne_50m_admin_0_countries.geojson": NE + "ne_50m_admin_0_countries.geojson", // public domain
  "ne_10m_rivers_lake_centerlines.geojson": NE + "ne_10m_rivers_lake_centerlines.geojson", // public domain
  // Bangladesh Bureau of Statistics and OCHA ROAP, CC BY 3.0 IGO, through geoBoundaries (gbOpen, build 9469f09).
  "bgd-adm2-s.geojson": "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/BGD/ADM2/geoBoundaries-BGD-ADM2_simplified.geojson",
};
const cache = process.argv[2] ?? path.join(tmpdir(), "sourcebd-film-geo");
const out = path.join(process.cwd(), "public/site/film");
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

async function read(name) {
  const file = path.join(cache, name);
  if (!existsSync(file)) writeFileSync(file, Buffer.from(await (await fetch(SOURCES[name])).arrayBuffer()));
  return JSON.parse(readFileSync(file, "utf8"));
}
const polygons = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
const lines = (g) => (g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []);

// --- the land mask -----------------------------------------------------------------------------------------
const W = 720, H = 360;
const land = await read("ne_50m_land.geojson");
const rings = land.features.flatMap((f) => polygons(f.geometry).flat());
const gray = Buffer.alloc((W + 1) * H); // each row: a filter byte, then W pixels
for (let y = 0; y < H; y++) {
  const lat = 90 - ((y + 0.5) / H) * 180;
  const xs = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[i], [x2, y2] = ring[j];
      if (y1 > lat !== y2 > lat) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const from = Math.max(0, Math.ceil(((xs[k] + 180) / 360) * W - 0.5));
    const to = Math.min(W - 1, Math.floor(((xs[k + 1] + 180) / 360) * W - 0.5));
    for (let x = from; x <= to; x++) gray[y * (W + 1) + 1 + x] = 255;
  }
}
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4), sum = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  sum.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, sum]);
};
const head = Buffer.alloc(13);
head.writeUInt32BE(W, 0);
head.writeUInt32BE(H, 4);
head.set([8, 0, 0, 0, 0], 8); // 8-bit greyscale
writeFileSync(path.join(out, "land.png"), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(gray, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));

// --- the map of Bangladesh ---------------------------------------------------------------------------------
const BOX = [76.0, 12.0, 104.0, 33.0]; // further than the camera ever looks, so the box's own edge is never seen
const UNIT = 1000;

/** Douglas-Peucker: drop the points that move the line less than `tol` degrees. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    let worst = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      // A closed ring starts and ends on one point: measure from the point, not from a line of no length.
      const d = len ? Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len : Math.hypot(pts[i][0] - ax, pts[i][1] - ay);
      if (d > worst) (worst = d), (at = i);
    }
    if (worst > tol) stack.push([a, at], [at, b]);
    if (worst > tol) keep[at] = 1;
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (ring) => Math.abs(ring.reduce((s, [x, y], i) => s + x * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * y, 0)) / 2;
/** Integers, the first point whole and the rest as steps from the one before. */
function pack(pts) {
  const flat = [];
  let px = 0, py = 0;
  for (const [x, y] of pts) {
    const qx = Math.round(x * UNIT), qy = Math.round(y * UNIT);
    if (flat.length && qx === px && qy === py) continue;
    flat.push(qx - px, qy - py);
    (px = qx), (py = qy);
  }
  return flat;
}
/** Sutherland-Hodgman against the box: enough for land that is only context. */
function clip(ring) {
  const edges = [[0, BOX[0], 1], [0, BOX[2], -1], [1, BOX[1], 1], [1, BOX[3], -1]];
  let pts = ring;
  for (const [axis, at, sign] of edges) {
    const inside = (p) => (p[axis] - at) * sign >= 0;
    const next = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (inside(a) !== inside(b)) {
        const t = (at - a[axis]) / (b[axis] - a[axis]);
        next.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
      if (inside(b)) next.push(b);
    }
    pts = next;
  }
  return pts;
}

const adm2 = await read("bgd-adm2-s.geojson");
const districts = adm2.features
  .map((f) => ({
    name: f.properties.shapeName,
    rings: polygons(f.geometry)
      .map((poly) => poly[0]) // outer rings; a hole in a district is a river island we do not need
      .filter((r) => area(r) > 2e-5)
      .map((r) => pack(simplify(r, 0.0025)))
      .filter((r) => r.length >= 8),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const countries = await read("ne_50m_admin_0_countries.geojson");
const around = countries.features
  .filter((f) => f.properties.ADM0_A3 !== "BGD")
  .flatMap((f) => polygons(f.geometry).map((poly) => clip(poly[0])))
  .filter((r) => r.length > 3 && area(r) > 0.01)
  .map((r) => pack(simplify(r, 0.01)));

// The three great rivers by their Natural Earth names: the Brahmaputra is the Jamuna here, the Ganges the
// Padma, and the Barak ("Balak" in the file) the Surma and the upper Meghna. The Tista joins the Jamuna.
const GREAT = { Brahmaputra: 3, Ganges: 3, Balak: 2, Tista: 1 };
const riversIn = await read("ne_10m_rivers_lake_centerlines.geojson");
const NEAR = [86.5, 20.0, 94.0, 27.2]; // the rivers only where they run through or beside the country
const inBox = ([x, y]) => x >= NEAR[0] && x <= NEAR[2] && y >= NEAR[1] && y <= NEAR[3];
const rivers = riversIn.features
  .filter((f) => f.geometry && f.properties.name in GREAT)
  .flatMap((f) => lines(f.geometry).map((l) => ({ w: GREAT[f.properties.name], pts: l.filter(inBox) })))
  .filter((r) => r.pts.length > 1)
  .map((r) => ({ w: r.w, line: pack(simplify(r.pts, 0.004)) }));

const bd = { unit: UNIT, box: BOX, districts, around, rivers };
writeFileSync(path.join(out, "bd.json"), JSON.stringify(bd));
const count = (list) => list.reduce((s, r) => s + r.length / 2, 0);
console.log(`land.png ${W}x${H}; bd.json: ${districts.length} districts (${count(districts.flatMap((d) => d.rings))} points), ${around.length} neighbour rings (${count(around)}), ${rivers.length} river lines (${count(rivers.map((r) => r.line))})`);
