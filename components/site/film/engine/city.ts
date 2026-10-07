// The city (founder's video, 7 Oct 2026: "why not create an entire city with code and put it here with an
// animation, not this gimmick map"). The garment belt round Dhaka, drawn in raw WebGL2 from our own supplier cells:
// every square kilometre where suppliers are registered is a block of towers, and its tallest tower's height follows
// how many suppliers that kilometre holds. Nothing is drawn where we hold no supplier; the ground between is dark,
// lit only by the blocks' own glow, with the kilometre grid the cells are counted on, the district lines and the
// rivers. The story's factory's block is lit green and a beam stands on it. Night in either theme.
//
// It takes over from the planet in one move: its first camera looks straight down at the same scale the planet's
// dive ends on (`handoverFrame`), where the roofs are the planet's lights. Then the scroll flies the camera over
// Narayanganj, Dhaka and Gazipur to Kashimpur (`cameraAt`) while the towers rise.
//
// Plain TypeScript, no React, no library: the pure parts (`toLocal`, `towerHeight`, `blocks`, `cameraAt`,
// `viewProj`, `handoverFrame`) run under `node --test`. Colours are read from the CSS variables of the canvas's own
// scope. A shader that fails to compile returns `null`: the caller keeps its still.

import { HOME, frameFor, type Cell, type Frame } from "./planet";

const RAD = Math.PI / 180;
export type V3 = [number, number, number];
type LngLat = readonly [number, number];

/** The city's own origin, the middle of the belt; x is east and z is south, in kilometres, y is up. */
export const ORIGIN = { lng: 90.4, lat: 23.85 } as const;
const KX = 111.32 * Math.cos(ORIGIN.lat * RAD);
const KZ = 110.57;
export const toLocal = (lng: number, lat: number): [number, number] => [(lng - ORIGIN.lng) * KX, -(lat - ORIGIN.lat) * KZ];
/** The belt and a margin round it: the cells drawn as towers, and the lines kept. */
export const BOX = { west: 89.9, south: 23.3, east: 90.95, north: 24.5 } as const;
const inBox = (lng: number, lat: number) => lng > BOX.west && lng < BOX.east && lat > BOX.south && lat < BOX.north;

/**
 * The three districts the camera flies over, in the order it meets them: each count as of 3 Oct 2026 from the
 * suppliers' register addresses, and `at` the middle of the district's towers (the cells inside its lines, weighted
 * by count, from cells.json of 6 Oct 2026), so the camera looks at the towers rather than the district's empty middle.
 */
export const DISTRICTS = [
  { key: "Narayanganj", label: "Narayanganj", count: 1628, at: [90.5, 23.652] },
  { key: "Dhaka", label: "Dhaka district", count: 4421, at: [90.366, 23.826] },
  { key: "Gazipur", label: "Gazipur", count: 1819, at: [90.367, 24.015] },
] as const satisfies readonly { key: string; label: string; count: number; at: LngLat }[];
/** The fourth, down the coast and out of the city's frame: said in words. */
export const CHATTOGRAM = { key: "Chittagong", label: "Chattogram", count: 1080 } as const;

/** How tall a block's tallest tower stands, in kilometres: it grows with the log of the count, so one dense kilometre does not dwarf the rest. */
export const towerHeight = (count: number): number => 0.03 + 0.085 * Math.log2(1 + Math.max(0, count));

/** A seeded random stream (mulberry32): the same cells always raise the same city. */
function stream(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Floats per tower: x, z, width, depth, height, seed, kind (1 is the story's block), how many windows are lit. */
export const STRIDE = 8;
/** Floats per glow: x, z, height, size, kind. */
export const GLOW_STRIDE = 5;

export type Blocks = { towers: Float32Array; glows: Float32Array; chosen: [number, number] | null; count: number };

/**
 * The towers for every cell in the box. A cell is a kilometre square cut in four by four lots; it raises two to
 * sixteen towers by its count, the first the tallest. With `chosen` (the story's own dated geocode), the cell
 * nearest to it, within a kilometre and a half, is the story's block.
 */
export function blocks(cells: readonly Cell[], chosen?: LngLat): Blocks {
  const towers: number[] = [];
  const glows: number[] = [];
  let pick = -1;
  if (chosen) {
    const [cx, cz] = toLocal(chosen[0], chosen[1]);
    let best = 1.5;
    cells.forEach(([lng, lat], i) => {
      const [x, z] = toLocal(lng, lat);
      const d = Math.hypot(x - cx, z - cz);
      if (d < best) {
        best = d;
        pick = i;
      }
    });
  }
  let count = 0;
  cells.forEach(([lng, lat, n], i) => {
    if (!inBox(lng, lat)) return;
    const [cx, cz] = toLocal(lng, lat);
    const rnd = stream(Math.round(lng * 1000) * 73856093 ^ Math.round(lat * 1000) * 19349663);
    const kind = i === pick ? 1 : 0;
    const many = Math.min(16, Math.max(2, Math.round(2 + 2 * Math.sqrt(n))));
    const lots = Array.from({ length: 16 }, (_, k) => k).sort(() => rnd() - 0.5).slice(0, many);
    const top = towerHeight(n);
    const lit = Math.min(0.92, 0.3 + Math.sqrt(n) / 9);
    lots.forEach((lot, k) => {
      const x = cx + ((lot % 4) - 1.5) * 0.22 + (rnd() - 0.5) * 0.05;
      const z = cz + (Math.floor(lot / 4) - 1.5) * 0.22 + (rnd() - 0.5) * 0.05;
      const h = top * (k === 0 ? 1 : 0.22 + rnd() * 0.62);
      towers.push(x, z, 0.07 + rnd() * 0.08, 0.07 + rnd() * 0.08, h, rnd(), kind, lit);
      if (k === 0) glows.push(x, z, h, 10 + Math.sqrt(n) * 5, kind);
      count++;
    });
  });
  return { towers: new Float32Array(towers), glows: new Float32Array(glows), chosen: pick >= 0 && chosen ? toLocal(chosen[0], chosen[1]) : null, count };
}

/** A camera mark: what it looks at, how far back, how far it leans from straight down (degrees), and which way it faces (0 is north). */
export type Mark = { at: number; target: LngLat | "chosen"; dist: number; pitch: number; heading: number; shift: number };
/**
 * The flight: straight down over the belt, then Narayanganj, Dhaka, Gazipur, then down to the story's block in
 * Kashimpur. `shift` is how far right of the middle the subject sits (a lens shift, as a share of half the width),
 * clear of the words at the left; the story's block, wide when close, sits further right.
 */
export const MARKS: readonly Mark[] = [
  { at: 0, target: [ORIGIN.lng, ORIGIN.lat], dist: 95, pitch: 0.5, heading: 0, shift: 0.3 },
  { at: 0.24, target: DISTRICTS[0].at, dist: 11, pitch: 60, heading: 8, shift: 0.32 },
  { at: 0.46, target: DISTRICTS[1].at, dist: 9.5, pitch: 64, heading: -6, shift: 0.34 },
  { at: 0.68, target: DISTRICTS[2].at, dist: 8.5, pitch: 66, heading: -22, shift: 0.36 },
  { at: 0.92, target: "chosen", dist: 3.6, pitch: 66, heading: -38, shift: 0.46 },
  { at: 1, target: "chosen", dist: 3.2, pitch: 67, heading: -42, shift: 0.48 },
];
/** The towers rise over this stretch of the city's scroll, from the planet's lights. */
export const RISE: readonly [number, number] = [0.03, 0.34];
/** The field of view. */
export const FOV = 32;

const smooth = (t: number) => t * t * (3 - 2 * t);

export type Camera = { eye: V3; target: V3; dist: number; shift: number };

/** The camera at `p` of the city's scroll: eye and target in kilometres, the distance between them, and the lens shift. */
export function cameraAt(p: number, chosen: LngLat = [90.3218, 23.9819]): Camera {
  const q = Math.max(0, Math.min(1, p));
  let i = 0;
  while (i < MARKS.length - 2 && q > MARKS[i + 1]!.at) i++;
  const a = MARKS[i]!, b = MARKS[i + 1]!;
  const t = smooth(Math.max(0, Math.min(1, (q - a.at) / (b.at - a.at))));
  const place = (m: Mark) => (m.target === "chosen" ? chosen : m.target);
  const [la, lb] = [place(a), place(b)];
  const [tx, tz] = toLocal(la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t);
  const dist = a.dist * (b.dist / a.dist) ** t;
  const pitch = (a.pitch + (b.pitch - a.pitch) * t) * RAD;
  const heading = (a.heading + (b.heading - a.heading) * t) * RAD;
  const back = dist * Math.sin(pitch);
  return { eye: [tx - Math.sin(heading) * back, dist * Math.cos(pitch), tz + Math.cos(heading) * back], target: [tx, 0, tz], dist, shift: a.shift + (b.shift - a.shift) * t };
}

// Column-major 4x4 matrices, as WebGL reads them.
function perspective(fovy: number, aspect: number, near: number, far: number, shift: number): number[] {
  const f = 1 / Math.tan(fovy / 2);
  // m[8] shifts the picture sideways in the frame without turning the camera, so straight down stays straight down.
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, -shift, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
}

function lookAt(eye: V3, target: V3): number[] {
  const f = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const s = norm(cross(f, [0, 1, 0]));
  const u = cross(s, f);
  return [s[0], u[0], -f[0], 0, s[1], u[1], -f[1], 0, s[2], u[2], -f[2], 0, -dot(s, eye), -dot(u, eye), dot(f, eye), 1];
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
function multiply(a: number[], b: number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return out;
}

/** The camera's matrix for a stage `w` by `h`; near and far follow the distance, so the depth holds from 95 km down to 3. */
export function viewProj(cam: Camera, w: number, h: number): number[] {
  return multiply(perspective(FOV * RAD, w / Math.max(1, h), cam.dist * 0.02, cam.dist * 6 + 80, cam.shift), lookAt(cam.eye, cam.target));
}

/** Where a point in the city lands on a stage `w` by `h`; `front` is false behind the camera. */
export function projectWith(m: number[], w: number, h: number, p: V3): { x: number; y: number; front: boolean } {
  const x = m[0]! * p[0] + m[4]! * p[1] + m[8]! * p[2] + m[12]!;
  const y = m[1]! * p[0] + m[5]! * p[1] + m[9]! * p[2] + m[13]!;
  const cw = m[3]! * p[0] + m[7]! * p[1] + m[11]! * p[2] + m[15]!;
  return { x: ((x / cw + 1) / 2) * w, y: ((1 - y / cw) / 2) * h, front: cw > 0 };
}

/**
 * Where the planet's dive must end for the city to take over in place: the planet's frame that draws the planet's
 * home where the city's first camera draws it, at the same number of pixels to the kilometre.
 */
export function handoverFrame(w: number, h: number): Frame {
  const first = cameraAt(0);
  const perKm = h / 2 / (first.eye[1] * Math.tan((FOV * RAD) / 2));
  const [hx, hz] = toLocal(HOME.lng, HOME.lat);
  const at = projectWith(viewProj(first, w, h), w, h, [hx, 0, hz]);
  return frameFor(perKm * 111.32 * Math.cos(HOME.lat * RAD), HOME.lat, at.x, at.y);
}

/** A line set from `bd.json`: every ring or line as degrees, steps from the first point in 1/`unit`. */
export function unpack(flat: number[], unit: number): [number, number][] {
  const out: [number, number][] = [];
  let x = 0, y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i]!;
    y += flat[i + 1]!;
    out.push([x / unit, y / unit]);
  }
  return out;
}

export type BdData = { credit: string; unit: number; box: number[]; districts: { name: string; rings: number[][] }[]; around: number[][]; rivers: { w: number; line: number[] }[] };

/** The district lines and the rivers inside the box, as segments on the ground (x, z, x, z), for `gl.LINES`. */
export function groundLines(bd: BdData): { districts: Float32Array; rivers: Float32Array } {
  const segs = (pts: [number, number][], out: number[]) => {
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1]!, pts[i]!];
      if (!inBox(a[0], a[1]) && !inBox(b[0], b[1])) continue;
      out.push(...toLocal(a[0], a[1]), ...toLocal(b[0], b[1]));
    }
  };
  const d: number[] = [], r: number[] = [];
  for (const district of bd.districts) for (const ring of district.rings) segs(unpack(ring, bd.unit), d);
  for (const river of bd.rivers) segs(unpack(river.line, bd.unit), r);
  return { districts: new Float32Array(d), rivers: new Float32Array(r) };
}

/** The glow on the ground, as a 256 x 256 grid of the box: each cell's count, spread by three passes of a box blur, square-rooted. */
export function glowGrid(cells: readonly Cell[], size = 256): { data: Uint8Array; box: [number, number, number, number] } {
  const [x0, z0] = toLocal(BOX.west, BOX.north);
  const [x1, z1] = toLocal(BOX.east, BOX.south);
  let g = new Float32Array(size * size);
  for (const [lng, lat, n] of cells) {
    if (!inBox(lng, lat)) continue;
    const [x, z] = toLocal(lng, lat);
    const i = Math.floor(((x - x0) / (x1 - x0)) * size), j = Math.floor(((z - z0) / (z1 - z0)) * size);
    if (i >= 0 && j >= 0 && i < size && j < size) g[j * size + i]! += n;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const horizontal of [true, false]) {
      const next = new Float32Array(size * size);
      for (let j = 0; j < size; j++)
        for (let i = 0; i < size; i++) {
          let sum = 0;
          for (let k = -3; k <= 3; k++) {
            const ii = horizontal ? i + k : i, jj = horizontal ? j : j + k;
            if (ii >= 0 && jj >= 0 && ii < size && jj < size) sum += g[jj * size + ii]!;
          }
          next[j * size + i] = sum / 7;
        }
      g = next;
    }
  }
  let max = 0;
  for (const v of g) max = Math.max(max, v);
  const data = new Uint8Array(size * size);
  for (let k = 0; k < g.length; k++) data[k] = Math.round(255 * Math.sqrt(max ? g[k]! / max : 0));
  return { data, box: [x0, z0, x1 - x0, z1 - z0] };
}

const TOWER_VS = `#version 300 es
in vec3 aPos; in vec3 aNorm; in vec4 aBox; in vec4 aMeta;
uniform mat4 uViewProj; uniform float uRise;
out vec3 vWorld; out vec3 vNorm; out vec2 vFace; out float vSeed; out float vKind; out float vLit; out float vH;
void main() {
  // Each tower rises on its own delay, eased out, from a roof on the ground (the planet's light) to its height.
  float r = clamp(uRise * 1.4 - aMeta.y * 0.4, 0.0, 1.0);
  r = 1.0 - pow(1.0 - r, 3.0);
  float h = max(0.003, aMeta.x * r);
  vec3 p = vec3(aBox.x + aPos.x * aBox.z, aPos.y * h, aBox.y + aPos.z * aBox.w);
  vWorld = p; vNorm = aNorm; vH = h;
  vFace = vec2(abs(aNorm.x) > 0.5 ? p.z : p.x, p.y);
  vSeed = aMeta.y; vKind = aMeta.z; vLit = aMeta.w;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

const TOWER_FS = `#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vNorm; in vec2 vFace; in float vSeed; in float vKind; in float vLit; in float vH;
uniform vec3 uEye; uniform vec3 uFog; uniform vec3 uBody; uniform vec3 uWarm; uniform vec3 uGreen; uniform float uTime; uniform float uFogK;
out vec4 o;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec3 n = normalize(vNorm);
  float side = 0.62 + 0.38 * max(dot(n, normalize(vec3(-0.55, 0.0, -0.8))), 0.0);
  vec3 col = uBody * (n.y > 0.5 ? 1.5 : side);
  vec3 lamp = vKind > 0.5 ? uGreen : uWarm;
  float up = vWorld.y / max(vH, 1e-4);
  if (n.y < 0.5) {
    // Windows: a grid of panes on every face, some lit. Where a pane is smaller than a few pixels the face shows
    // what a lit tower shows from afar instead: a warm wash that brightens up the tower, never speckle.
    vec2 g = vec2(vFace.x / 0.016, vFace.y / 0.0135);
    vec2 id = floor(g);
    vec2 f = fract(g);
    float lit = step(hash(id + vSeed * 91.7), vLit);
    float pane = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.78);
    float far = smoothstep(0.22, 0.55, max(fwidth(g.x), fwidth(g.y)));
    float wash = vLit * (0.04 + 0.2 * up * up);
    float w = mix(pane * lit, wash, far);
    float twinkle = 0.82 + 0.18 * sin(uTime * 0.6 + hash(id + 7.0) * 40.0);
    vec3 tone = vKind > 0.5 ? lamp : mix(lamp, lamp * vec3(0.78, 0.94, 1.12), step(0.8, hash(id + 3.1)) * (1.0 - far));
    col += tone * w * mix(twinkle, 1.0, far) * (vKind > 0.5 ? 1.5 : 0.95);
    // A thin light along the roofline, which draws each tower's edge against the night.
    col += lamp * 0.16 * smoothstep(0.95, 1.0, up);
  } else {
    // A roof glows, most of all while it still lies on the ground: then it is the planet's light.
    col += lamp * (0.07 + 0.75 * (1.0 - smoothstep(0.0, 0.04, vH)));
  }
  float fog = 1.0 - exp(-length(vWorld - uEye) * uFogK);
  o = vec4(mix(col, uFog, clamp(fog, 0.0, 1.0)), 1.0);
}`;

const GROUND_VS = `#version 300 es
in vec2 aXZ; uniform mat4 uViewProj; out vec3 vWorld;
void main() { vWorld = vec3(aXZ.x, 0.0, aXZ.y); gl_Position = uViewProj * vec4(vWorld, 1.0); }`;

const GROUND_FS = `#version 300 es
precision highp float;
in vec3 vWorld;
uniform sampler2D uGlow; uniform vec4 uBox; uniform vec3 uFog; uniform vec3 uGround; uniform vec3 uWarm; uniform vec3 uLine; uniform vec3 uEye; uniform float uFogK; uniform float uGrid;
out vec4 o;
void main() {
  vec2 uv = (vWorld.xz - uBox.xy) / uBox.zw;
  float g = texture(uGlow, uv).r;
  vec3 col = uGround + uWarm * (g * g * 0.3 + g * 0.05);
  // The kilometre grid the cells are counted on, near the camera only.
  vec2 k = vWorld.xz;
  vec2 d = abs(fract(k - 0.5) - 0.5) / max(fwidth(k), vec2(1e-4));
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  float dist = length(vWorld - uEye);
  col += uLine * line * 0.09 * uGrid * (1.0 - smoothstep(3.0, 30.0, dist));
  float fog = 1.0 - exp(-dist * uFogK);
  o = vec4(mix(col, uFog, clamp(fog, 0.0, 1.0)), 1.0);
}`;

const LINE_VS = `#version 300 es
in vec2 aXZ; uniform mat4 uViewProj; out vec3 vWorld;
void main() { vWorld = vec3(aXZ.x, 0.004, aXZ.y); gl_Position = uViewProj * vec4(vWorld, 1.0); }`;

const LINE_FS = `#version 300 es
precision highp float;
in vec3 vWorld; uniform vec3 uColor; uniform float uAlpha; uniform vec3 uEye; uniform float uFogK;
out vec4 o;
void main() {
  float a = uAlpha * exp(-length(vWorld - uEye) * uFogK);
  o = vec4(uColor * a, a);
}`;

const GLOW_VS = `#version 300 es
in vec2 aXZ; in float aH; in float aSize; in float aKind;
uniform mat4 uViewProj; uniform float uRise; uniform float uDpr; uniform float uScale;
out float vKind; out float vFade;
void main() {
  float r = clamp(uRise * 1.4 - 0.2, 0.0, 1.0);
  vec4 p = uViewProj * vec4(aXZ.x, aH * (1.0 - pow(1.0 - r, 3.0)) + 0.01, aXZ.y, 1.0);
  gl_Position = p;
  // By the square root of the distance: from straight above the belt a block is the planet's light, a few pixels
  // across; close to, a soft halo over its roof, never a disc that fills the screen.
  gl_PointSize = clamp(aSize * uScale * 3.9 / sqrt(max(p.w, 0.5)), 1.0, 110.0) * uDpr;
  vKind = aKind;
  vFade = 0.4 + 0.6 * smoothstep(2.0, 40.0, p.w);
}`;

const GLOW_FS = `#version 300 es
precision mediump float;
in float vKind; in float vFade; uniform vec3 uWarm; uniform vec3 uGreen; uniform float uLevel;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float g = exp(-d * d * 4.0) * uLevel * (vKind > 0.5 ? 0.9 : 0.32) * vFade;
  o = vec4((vKind > 0.5 ? uGreen : uWarm) * g, g);
}`;

const BEAM_VS = `#version 300 es
in vec2 aUV; uniform mat4 uViewProj; uniform vec3 uBase; uniform vec3 uRight; uniform float uHeight;
out vec2 vUV;
void main() { vUV = aUV; gl_Position = uViewProj * vec4(uBase + uRight * (aUV.x - 0.5) + vec3(0.0, aUV.y * uHeight, 0.0), 1.0); }`;

const BEAM_FS = `#version 300 es
precision mediump float;
in vec2 vUV; uniform vec3 uGreen; uniform float uLevel;
out vec4 o;
void main() {
  float across = 1.0 - abs(vUV.x - 0.5) * 2.0;
  float a = pow(across, 3.0) * pow(1.0 - vUV.y, 1.6) * uLevel;
  o = vec4(uGreen * a, a);
}`;

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram | null {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type);
    if (!s || !p) return null;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    gl.attachShader(p, s);
  }
  if (!p) return null;
  gl.linkProgram(p);
  return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
}

/** `--ds-ink-3` in the canvas's scope, as 0 to 1 channels. */
function cssColor(el: Element, name: string): [number, number, number] {
  const v = getComputedStyle(el).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return [(v[0] ?? 0) / 255, (v[1] ?? 0) / 255, (v[2] ?? 0) / 255];
}

/** A unit box standing on the ground, -0.5 to 0.5 across, 0 to 1 up: position and normal per corner, six faces, no floor. */
function unitBox(): Float32Array {
  const faces: [V3, V3[]][] = [
    [[0, 0, 1], [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]]],
    [[0, 0, -1], [[0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5]]],
    [[1, 0, 0], [[0.5, 0, 0.5], [0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5]]],
    [[-1, 0, 0], [[-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5]]],
    [[0, 1, 0], [[-0.5, 1, 0.5], [0.5, 1, 0.5], [0.5, 1, -0.5], [-0.5, 1, -0.5]]],
  ];
  const out: number[] = [];
  for (const [n, q] of faces) for (const k of [0, 1, 2, 0, 2, 3]) out.push(...q[k]!, ...n);
  return new Float32Array(out);
}

export type CityOptions = {
  cells: readonly Cell[];
  bd?: BdData;
  chosen?: LngLat;
  /** The pixel-ratio cap: 2 on the full tier. */
  maxDpr?: number;
  /** The subject in the middle of the frame (a picture with no words beside it), not right of it. */
  centred?: boolean;
  /** The browser took the drawing context away: the caller puts its still back. */
  onLost?: () => void;
  /** After each drawn frame, with the camera's matrix and the stage's size, so DOM labels can follow. */
  onFrame?: (project: (p: V3) => { x: number; y: number; front: boolean }) => void;
};

export type City = {
  /** The city's scroll, 0 to 1: the towers rise and the camera flies. */
  setProgress(p: number): void;
  recolor(): void;
  park(): void;
  resume(): void;
  destroy(): void;
};

export function createCity(canvas: HTMLCanvasElement, opts: CityOptions): City | null {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: "high-performance" });
  if (!gl) return null;
  const towersP = program(gl, TOWER_VS, TOWER_FS);
  const groundP = program(gl, GROUND_VS, GROUND_FS);
  const lineP = program(gl, LINE_VS, LINE_FS);
  const glowP = program(gl, GLOW_VS, GLOW_FS);
  const beamP = program(gl, BEAM_VS, BEAM_FS);
  if (!towersP || !groundP || !lineP || !glowP || !beamP) return null;

  const city = blocks(opts.cells, opts.chosen);
  const chosen = opts.chosen ?? null;
  const places = new Map<string, WebGLUniformLocation | null>();
  const U = (p: WebGLProgram, n: string) => {
    const key = `${[towersP, groundP, lineP, glowP, beamP].indexOf(p)}:${n}`;
    if (!places.has(key)) places.set(key, gl.getUniformLocation(p, n));
    return places.get(key) ?? null;
  };
  const attrib = (p: WebGLProgram, name: string, size: number, stride: number, offset: number, divisor = 0) => {
    const loc = gl.getAttribLocation(p, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(loc, divisor);
  };
  const buffer = (data: Float32Array) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  };

  // The towers: one box, drawn once per tower.
  const towerVao = gl.createVertexArray();
  gl.bindVertexArray(towerVao);
  buffer(unitBox());
  attrib(towersP, "aPos", 3, 24, 0);
  attrib(towersP, "aNorm", 3, 24, 12);
  buffer(city.towers);
  attrib(towersP, "aBox", 4, STRIDE * 4, 0, 1);
  attrib(towersP, "aMeta", 4, STRIDE * 4, 16, 1);

  // The ground: one quad well past the box; fog hides its edge.
  const groundVao = gl.createVertexArray();
  gl.bindVertexArray(groundVao);
  const R = 220;
  buffer(new Float32Array([-R, -R, R, -R, R, R, -R, -R, R, R, -R, R]));
  attrib(groundP, "aXZ", 2, 8, 0);
  const glow = glowGrid(opts.cells);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 256, 0, gl.RED, gl.UNSIGNED_BYTE, glow.data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // The district lines and the rivers.
  const lines = opts.bd ? groundLines(opts.bd) : { districts: new Float32Array(), rivers: new Float32Array() };
  const lineVaos = [lines.districts, lines.rivers].map((data) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    buffer(data);
    attrib(lineP, "aXZ", 2, 8, 0);
    return { vao, n: data.length / 2 };
  });

  // The roofs' glow: one soft light on each block's tallest tower.
  const glowVao = gl.createVertexArray();
  gl.bindVertexArray(glowVao);
  buffer(city.glows);
  attrib(glowP, "aXZ", 2, GLOW_STRIDE * 4, 0);
  attrib(glowP, "aH", 1, GLOW_STRIDE * 4, 0 + 8);
  attrib(glowP, "aSize", 1, GLOW_STRIDE * 4, 12);
  attrib(glowP, "aKind", 1, GLOW_STRIDE * 4, 16);
  const glowCount = city.glows.length / GLOW_STRIDE;

  // The beam on the story's block.
  const beamVao = gl.createVertexArray();
  gl.bindVertexArray(beamVao);
  buffer(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]));
  attrib(beamP, "aUV", 2, 8, 0);
  gl.bindVertexArray(null);

  let colors = { fog: [0, 0, 0], body: [0, 0, 0], warm: [0, 0, 0], green: [0, 0, 0], line: [0, 0, 0], water: [0, 0, 0] } as Record<string, [number, number, number]>;
  const recolor = () => {
    const sky = cssColor(canvas, "--ds-surface");
    const warm = cssColor(canvas, "--ds-map-light");
    // The haze over a lit city is a little lighter and warmer than the sky above it: the horizon glows.
    const fog = sky.map((c, i) => c + (warm[i]! - c) * 0.07) as [number, number, number];
    colors = {
      fog,
      ground: sky.map((c) => c * 0.72) as [number, number, number],
      body: cssColor(canvas, "--ds-sunken").map((c) => c * 0.6) as [number, number, number],
      warm,
      green: cssColor(canvas, "--ds-brand-ink"),
      line: cssColor(canvas, "--ds-ink-3"),
      water: cssColor(canvas, "--ds-info"),
    };
  };
  recolor();

  let p = 0, w = 0, h = 0, dpr = 1, raf = 0, parked = false, seen = true, dead = false;
  let mx = 0.5, my = 0.5, sx = 0.5, sy = 0.5;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, opts.maxDpr ?? 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };

  const draw = (now: number) => {
    raf = 0;
    if (dead || parked || !seen || document.hidden || !w) return;
    const t = now / 1000;
    // The pointer leans the camera a little; the lean eases, so the city answers without jumping.
    sx += (mx - sx) * 0.06;
    sy += (my - sy) * 0.06;
    const flight = cameraAt(p, chosen ?? undefined);
    const cam = opts.centred ? { ...flight, shift: 0 } : flight;
    const lean = Math.min(1, p * 4) * cam.dist * 0.03;
    const eye: V3 = [cam.eye[0] + (sx - 0.5) * lean, cam.eye[1] + (sy - 0.5) * lean * 0.6, cam.eye[2]];
    const view = { ...cam, eye };
    const m = viewProj(view, w, h);
    const fogK = 1 / (cam.dist * 3.2);
    const rise = Math.max(0, Math.min(1, (p - RISE[0]) / (RISE[1] - RISE[0])));

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    gl.useProgram(groundP);
    gl.bindVertexArray(groundVao);
    gl.uniformMatrix4fv(U(groundP, "uViewProj"), false, m);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U(groundP, "uGlow"), 0);
    gl.uniform4fv(U(groundP, "uBox"), glow.box);
    gl.uniform3fv(U(groundP, "uFog"), colors.fog!);
    gl.uniform3fv(U(groundP, "uGround"), colors.ground!);
    gl.uniform3fv(U(groundP, "uWarm"), colors.warm!);
    gl.uniform3fv(U(groundP, "uLine"), colors.line!);
    gl.uniform3fv(U(groundP, "uEye"), eye);
    gl.uniform1f(U(groundP, "uFogK"), fogK);
    gl.uniform1f(U(groundP, "uGrid"), Math.min(1, Math.max(0, (p - 0.6) * 4)));
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(towersP);
    gl.bindVertexArray(towerVao);
    gl.uniformMatrix4fv(U(towersP, "uViewProj"), false, m);
    gl.uniform1f(U(towersP, "uRise"), rise);
    gl.uniform3fv(U(towersP, "uEye"), eye);
    gl.uniform3fv(U(towersP, "uFog"), colors.fog!);
    gl.uniform3fv(U(towersP, "uBody"), colors.body!);
    gl.uniform3fv(U(towersP, "uWarm"), colors.warm!);
    gl.uniform3fv(U(towersP, "uGreen"), colors.green!);
    gl.uniform1f(U(towersP, "uTime"), t);
    gl.uniform1f(U(towersP, "uFogK"), fogK);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 30, city.count);

    // What glows is added on top and writes no depth: lines, the roofs' lights, the beam.
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(lineP);
    gl.uniformMatrix4fv(U(lineP, "uViewProj"), false, m);
    gl.uniform3fv(U(lineP, "uEye"), eye);
    gl.uniform1f(U(lineP, "uFogK"), fogK * 0.6);
    lineVaos.forEach(({ vao, n }, i) => {
      if (!n) return;
      gl.bindVertexArray(vao);
      gl.uniform3fv(U(lineP, "uColor"), i ? colors.water! : colors.line!);
      gl.uniform1f(U(lineP, "uAlpha"), i ? 0.55 : 0.3);
      gl.drawArrays(gl.LINES, 0, n);
    });

    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(glowP);
    gl.bindVertexArray(glowVao);
    gl.uniformMatrix4fv(U(glowP, "uViewProj"), false, m);
    gl.uniform1f(U(glowP, "uRise"), rise);
    gl.uniform1f(U(glowP, "uDpr"), dpr);
    gl.uniform1f(U(glowP, "uScale"), h / 900);
    gl.uniform3fv(U(glowP, "uWarm"), colors.warm!);
    gl.uniform3fv(U(glowP, "uGreen"), colors.green!);
    // From straight above the glows are the planet's lights; among the risen towers they would read as dots.
    gl.uniform1f(U(glowP, "uLevel"), 1 - rise * 0.92);
    gl.drawArrays(gl.POINTS, 0, glowCount);

    if (city.chosen) {
      const [bx, bz] = city.chosen;
      const look = norm([eye[0] - bx, 0, eye[2] - bz]);
      const width = Math.max(0.12, cam.dist * 0.05);
      gl.useProgram(beamP);
      gl.bindVertexArray(beamVao);
      gl.uniformMatrix4fv(U(beamP, "uViewProj"), false, m);
      gl.uniform3fv(U(beamP, "uBase"), [bx, 0, bz]);
      gl.uniform3fv(U(beamP, "uRight"), [-look[2] * width, 0, look[0] * width]);
      gl.uniform1f(U(beamP, "uHeight"), Math.max(1.2, cam.dist * 0.7));
      gl.uniform3fv(U(beamP, "uGreen"), colors.green!);
      gl.uniform1f(U(beamP, "uLevel"), Math.max(0, Math.min(1, (p - 0.7) * 4)) * (0.75 + 0.25 * Math.sin(t * 1.6)));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.depthMask(true);
    gl.bindVertexArray(null);

    opts.onFrame?.((point) => projectWith(m, w, h, point));
    wake();
  };
  const wake = () => {
    if (!raf && !dead) raf = requestAnimationFrame(draw);
  };

  const move = (e: PointerEvent) => {
    mx = e.clientX / innerWidth;
    my = e.clientY / innerHeight;
  };
  const lost = (e: Event) => {
    e.preventDefault();
    dead = true;
    opts.onLost?.();
  };
  addEventListener("pointermove", move, { passive: true });
  canvas.addEventListener("webglcontextlost", lost);
  const sized = new ResizeObserver(() => {
    resize();
    wake();
  });
  sized.observe(canvas);
  const watched = new IntersectionObserver(([e]) => {
    seen = e?.isIntersecting ?? true;
    wake();
  });
  watched.observe(canvas);
  document.addEventListener("visibilitychange", wake);
  resize();
  wake();

  return {
    setProgress(v) {
      p = Math.max(0, Math.min(1, v));
      wake();
    },
    recolor() {
      recolor();
      wake();
    },
    park() {
      parked = true;
    },
    resume() {
      parked = false;
      wake();
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      sized.disconnect();
      watched.disconnect();
      removeEventListener("pointermove", move);
      canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", wake);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
