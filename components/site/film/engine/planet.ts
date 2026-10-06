// The planet (handoff-home-film §3.5): our own, in raw WebGL2, no library. Land is fine dots taken from a land
// mask; our suppliers are warm lights at their real cells, sized by count, each breathing on its own phase; a soft
// rim of atmosphere; a far layer of dust that shifts with the pointer. It drifts slowly and always keeps
// Bangladesh in view, turns under a drag and springs back, and the scroll brings the camera in.
//
// Plain TypeScript, no React: the pure parts (`landPoints`, `facing`, `project`) run under `node --test`, and a
// plain HTML harness can load the whole file. Colours are read from the CSS variables of the canvas's own scope,
// so a night scene and a theme change need no code. A shader that fails to compile returns `null`: the caller
// keeps its still.

export type Cell = readonly [lng: number, lat: number, count: number];
export type Mask = { width: number; height: number; data: ArrayLike<number>; channels?: number };
export type Frame = { cx: number; cy: number; r: number };

const RAD = Math.PI / 180;
/** Where the camera rests: over Bangladesh. */
export const HOME = { lng: 90.4, lat: 23.7 } as const;

/** A place as a unit vector: y is north, +z faces longitude 0 on the equator. */
export function toVec(lng: number, lat: number): [number, number, number] {
  const a = lng * RAD;
  const b = lat * RAD;
  return [Math.cos(b) * Math.sin(a), Math.sin(b), Math.cos(b) * Math.cos(a)];
}

/** Is this place land? The mask is an equirectangular bitmap, north up, longitude -180 at its left edge. */
export function isLand(mask: Mask, lng: number, lat: number): boolean {
  const x = Math.min(mask.width - 1, Math.max(0, Math.floor(((lng + 180) / 360) * mask.width)));
  const y = Math.min(mask.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * mask.height)));
  return (mask.data[(y * mask.width + x) * (mask.channels ?? 4)] ?? 0) > 127;
}

/** `n` points spread evenly over the sphere (a Fibonacci lattice), keeping the ones on land: x, y, z each. */
export function landPoints(mask: Mask, n: number): Float32Array {
  const out: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const t = golden * i;
    const x = Math.sin(t) * r;
    const z = Math.cos(t) * r;
    if (isLand(mask, Math.atan2(x, z) / RAD, Math.asin(y) / RAD)) out.push(x, y, z);
  }
  return new Float32Array(out);
}

/** The rotation (row-major 3x3) that brings a place to face the viewer: turn about the axis, then tip. */
export function facing(lng: number, lat: number): number[] {
  const a = -lng * RAD;
  const b = lat * RAD;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return [ca, 0, sa, sa * sb, cb, -ca * sb, -sa * cb, sb, ca * cb];
}

/** Where a place lands on screen under a rotation and a frame; `front` is false on the far side. */
export function project(rot: number[], frame: Frame, lng: number, lat: number): { x: number; y: number; front: boolean } {
  const [x, y, z] = toVec(lng, lat);
  const px = rot[0]! * x + rot[1]! * y + rot[2]! * z;
  const py = rot[3]! * x + rot[4]! * y + rot[5]! * z;
  const pz = rot[6]! * x + rot[7]! * y + rot[8]! * z;
  return { x: frame.cx + px * frame.r, y: frame.cy - py * frame.r, front: pz > 0 };
}

/** A light's size on the sphere: it grows with the square root of the count, so area follows the count. */
export const lightSize = (count: number): number => Math.min(10, 2.2 + Math.sqrt(count) * 0.6);

/**
 * The plan's composition: the planet large at the right, Bangladesh facing; `p` 0 to 1 brings the camera in. On an
 * upright screen it sits above the words instead, smaller, with Bangladesh still on screen.
 */
export function defaultFrame(p: number, w: number, h: number): Frame {
  const e = p * p * (3 - 2 * p);
  if (h > w) return { cx: w * 0.66, cy: h * 0.17, r: w * 0.5 * (1 + 1.2 * e) };
  const r0 = Math.max(h * 0.62, w * 0.36);
  return { cx: w * (0.74 - 0.24 * e), cy: h * (0.58 - 0.08 * e), r: r0 * (1 + 2.4 * e) };
}

const POINT_VS = `#version 300 es
in vec3 aPos; in float aSize; in float aPhase; in float aKind;
uniform mat3 uRot; uniform vec2 uCenter; uniform vec2 uRes; uniform float uRadius; uniform float uScale;
uniform float uTime; uniform float uDpr; uniform vec2 uShift; uniform mediump float uBloom;
out float vAlpha; out float vKind;
void main() {
  vec3 p = uRot * aPos;
  vec2 px = uCenter + vec2(p.x, -p.y) * uRadius;
  float a;
  float size = aSize;
  if (aKind < 0.5) {            // land
    float lit = 0.7 + 0.3 * clamp(dot(normalize(p), normalize(vec3(-0.45, 0.5, 0.75))), 0.0, 1.0);
    a = smoothstep(0.0, 0.22, p.z) * lit;
    size *= mix(1.0, 1.9, clamp((uScale - 1.0) / 2.4, 0.0, 1.0));
  } else if (aKind < 1.5) {     // a supplier light, breathing on its own phase
    // From far away a district is many lights in a few pixels: each one is faint there, so the cluster glows
    // without burning out, and they come apart as the camera comes in.
    float near = clamp((uScale - 1.0) / 2.4, 0.0, 1.0);
    a = smoothstep(-0.02, 0.12, p.z) * (0.72 + 0.28 * sin(uTime * (0.7 + fract(aPhase) * 0.9) + aPhase * 6.2831)) * mix(0.14, 0.3, near);
    size *= mix(0.75, 0.95, near) * uBloom;
  } else {                      // dust, far behind, shifting with the pointer and the scroll
    px = uRes * 0.5 + vec2(p.x, -p.y) * max(uRes.x, uRes.y) * 0.75 + uShift * (0.4 + fract(aPhase) * 1.2);
    a = (0.25 + 0.75 * fract(aPhase * 7.0)) * (0.6 + 0.4 * sin(uTime * 0.35 + aPhase * 6.2831));
  }
  vAlpha = a; vKind = aKind;
  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
  gl_Position.y = -gl_Position.y;
  gl_PointSize = max(1.0, size * uDpr);
}`;

const POINT_FS = `#version 300 es
precision mediump float;
in float vAlpha; in float vKind;
uniform vec3 uLand; uniform vec3 uLight; uniform float uLights; uniform float uBloom;
out vec4 o;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (vKind > 0.5 && vKind < 1.5) {
    float g = exp(-d * d * 3.2) * vAlpha * uLights * (uBloom > 1.5 ? 0.04 : 0.8);
    o = vec4(uLight * g, g * 0.6);
  } else {
    float a = (1.0 - smoothstep(0.55, 1.0, d)) * vAlpha * (vKind > 1.5 ? 0.35 : 0.9);
    o = vec4(uLand * a, a);
  }
}`;

const BODY_VS = `#version 300 es
in vec2 aXY; void main() { gl_Position = vec4(aXY, 0.0, 1.0); }`;

const BODY_FS = `#version 300 es
precision mediump float;
uniform vec2 uCenter; uniform float uRadius; uniform vec2 uRes; uniform vec3 uBody; uniform vec3 uRim; uniform float uDpr;
out vec4 o;
void main() {
  vec2 q = (vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) - uCenter) / uRadius;
  float d = length(q);
  vec3 light = normalize(vec3(-0.45, 0.5, 0.75));
  float side = 0.5 + 0.5 * dot(normalize(vec2(q.x, -q.y) + 1e-5), normalize(light.xy));
  if (d < 1.0) {
    vec3 n = vec3(q.x, -q.y, sqrt(1.0 - d * d));
    float lit = clamp(dot(n, light), 0.0, 1.0);
    float rim = pow(1.0 - n.z, 3.0);
    vec3 c = uBody * (0.55 + 0.6 * lit) + uRim * rim * (0.2 + 0.5 * side);
    float edge = 1.0 - smoothstep(1.0 - 1.5 * uDpr / uRadius, 1.0, d);
    o = vec4(c * edge, edge);
  } else {
    float g = exp(-(d - 1.0) * 9.0) * (0.1 + 0.3 * side);
    o = vec4(uRim * g, g);
  }
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

export type PlanetOptions = {
  mask: Mask;
  cells: readonly Cell[];
  /** Land samples before the mask: about 60,000 on the full tier, 16,000 on a phone. */
  samples?: number;
  /** The pixel-ratio cap: 2, or 1.5 on a phone. */
  maxDpr?: number;
  frame?: (p: number, w: number, h: number) => Frame;
  /** The browser took the drawing context away (a GPU reset, too many contexts): the caller puts its still back. */
  onLost?: () => void;
  /** Called after each drawn frame with the rotation and frame in use, so DOM callouts and the thread can follow. */
  onFrame?: (rot: number[], frame: Frame) => void;
};

export type Planet = {
  /** The scroll, 0 to 1: brings the camera in. */
  setProgress(p: number): void;
  /** Dim every light but the chosen cell's (0 to 1). */
  setLights(level: number): void;
  /** Read the colours again after a theme change. */
  recolor(): void;
  /** Stop drawing and keep the context (the map runs meanwhile); `resume` brings the same planet back. */
  park(): void;
  resume(): void;
  destroy(): void;
};

export function createPlanet(canvas: HTMLCanvasElement, opts: PlanetOptions): Planet | null {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "low-power" });
  if (!gl) return null;
  const points = program(gl, POINT_VS, POINT_FS);
  const body = program(gl, BODY_VS, BODY_FS);
  if (!points || !body) return null;

  // One buffer: land, then lights, then dust. x, y, z, size, phase, kind.
  const land = landPoints(opts.mask, opts.samples ?? 60000);
  const rows: number[] = [];
  for (let i = 0; i < land.length; i += 3) rows.push(land[i]!, land[i + 1]!, land[i + 2]!, 2.1, 0, 0);
  const landCount = land.length / 3;
  opts.cells.forEach(([lng, lat, count], i) => rows.push(...toVec(lng, lat), lightSize(count), (i * 0.618034) % 1, 1));
  const DUST = 260;
  for (let i = 0; i < DUST; i++) {
    const a = i * 2.399963, r = Math.sqrt((i + 0.5) / DUST);
    rows.push(Math.cos(a) * r, Math.sin(a) * r, 0, 1 + ((i * 7) % 3) * 0.5, (i * 0.754877) % 1, 2);
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rows), gl.STATIC_DRAW);
  ([["aPos", 3, 0], ["aSize", 1, 12], ["aPhase", 1, 16], ["aKind", 1, 20]] as const).forEach(([name, size, offset]) => {
    const loc = gl.getAttribLocation(points, name);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 24, offset);
  });
  const quad = gl.createVertexArray();
  gl.bindVertexArray(quad);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const xy = gl.getAttribLocation(body, "aXY");
  gl.enableVertexAttribArray(xy);
  gl.vertexAttribPointer(xy, 2, gl.FLOAT, false, 0, 0);
  // A uniform's place is looked up once: asking the driver by name on every frame is the slow way.
  const places = new Map<string, WebGLUniformLocation | null>();
  const U = (p: WebGLProgram, n: string) => {
    const key = (p === points ? "p:" : "b:") + n;
    if (!places.has(key)) places.set(key, gl.getUniformLocation(p, n));
    return places.get(key) ?? null;
  };

  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frameOf = opts.frame ?? defaultFrame;
  let colors = { land: [0, 0, 0], light: [0, 0, 0], body: [0, 0, 0], rim: [0, 0, 0] } as Record<string, [number, number, number]>;
  const recolor = () => {
    colors = { land: cssColor(canvas, "--ds-ink-3"), light: cssColor(canvas, "--ds-map-light"), body: cssColor(canvas, "--ds-subtle"), rim: cssColor(canvas, "--ds-line-strong") };
  };
  recolor();

  let p = 0, lights = 1, w = 0, h = 0, dpr = 1, raf = 0, parked = false, seen = true, dead = false;
  // A drag turns the planet; on release a spring brings Bangladesh back. Pointer only, never touch.
  let dragX = 0, dragY = 0, velX = 0, velY = 0, held = false, lastX = 0, lastY = 0, mouseX = 0, mouseY = 0;

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
    if (!held) {
      velX += (-dragX * 22 - velX * 7.5) / 60;
      velY += (-dragY * 22 - velY * 7.5) / 60;
      dragX += velX / 60;
      dragY += velY / 60;
    }
    const calm = still ? 0 : 1 - p;
    const rot = facing(HOME.lng + (Math.sin(t / 7.3) * 5.5 + Math.sin(t / 3.1) * 0.8) * calm - dragX, HOME.lat + Math.sin(t / 9.7) * 2.2 * calm + dragY);
    const f = frameOf(p, w, h);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);

    gl.useProgram(points);
    gl.bindVertexArray(vao);
    gl.uniformMatrix3fv(U(points, "uRot"), true, rot);
    gl.uniform2f(U(points, "uCenter"), f.cx * dpr, f.cy * dpr);
    gl.uniform2f(U(points, "uRes"), canvas.width, canvas.height);
    gl.uniform1f(U(points, "uRadius"), f.r * dpr);
    gl.uniform1f(U(points, "uScale"), f.r / frameOf(0, w, h).r);
    gl.uniform1f(U(points, "uTime"), still ? 0 : t);
    gl.uniform1f(U(points, "uDpr"), dpr);
    gl.uniform2f(U(points, "uShift"), (mouseX - 0.5) * -28 * dpr, ((mouseY - 0.5) * -18 - p * 90) * dpr);
    gl.uniform3fv(U(points, "uLand"), colors.land!);
    gl.uniform3fv(U(points, "uLight"), colors.light!);
    gl.uniform1f(U(points, "uLights"), lights);
    gl.uniform1f(U(points, "uBloom"), 1);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, landCount + opts.cells.length, DUST);

    gl.useProgram(body);
    gl.bindVertexArray(quad);
    gl.uniform2f(U(body, "uCenter"), f.cx * dpr, f.cy * dpr);
    gl.uniform2f(U(body, "uRes"), canvas.width, canvas.height);
    gl.uniform1f(U(body, "uRadius"), f.r * dpr);
    gl.uniform1f(U(body, "uDpr"), dpr);
    gl.uniform3fv(U(body, "uBody"), colors.body!);
    gl.uniform3fv(U(body, "uRim"), colors.rim!);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(points);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.POINTS, 0, landCount);
    // The lights twice: a wide faint bloom, then the lights themselves. Additive, so a dense district glows.
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform1f(U(points, "uBloom"), 7);
    gl.drawArrays(gl.POINTS, landCount, opts.cells.length);
    gl.uniform1f(U(points, "uBloom"), 1);
    gl.drawArrays(gl.POINTS, landCount, opts.cells.length);

    opts.onFrame?.(rot, f);
    if (!still || held || Math.abs(dragX) + Math.abs(dragY) > 0.01) wake();
  };
  const wake = () => {
    if (!raf && !dead) raf = requestAnimationFrame(draw);
  };

  const fine = matchMedia("(pointer: fine)").matches;
  const down = (e: PointerEvent) => {
    if (e.pointerType === "touch" || !fine) return;
    held = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    mouseX = e.clientX / innerWidth;
    mouseY = e.clientY / innerHeight;
    if (held) {
      dragX = Math.max(-70, Math.min(70, dragX + (e.clientX - lastX) * 0.18));
      dragY = Math.max(-35, Math.min(35, dragY + (e.clientY - lastY) * 0.18));
      lastX = e.clientX;
      lastY = e.clientY;
    }
    wake();
  };
  const up = () => {
    held = false;
    velX = velY = 0;
    wake();
  };
  const lost = (e: Event) => {
    e.preventDefault();
    dead = true;
    opts.onLost?.();
  };
  canvas.addEventListener("pointerdown", down);
  addEventListener("pointermove", move, { passive: true });
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
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
    setLights(v) {
      lights = v;
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
      canvas.removeEventListener("pointerdown", down);
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      canvas.removeEventListener("webglcontextlost", lost);
      document.removeEventListener("visibilitychange", wake);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
