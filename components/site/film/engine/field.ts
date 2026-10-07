// The field (founder's video, 7 Oct 2026: "our dashboard with animated visuals, animated card background, high
// contrast visuals"): the moving ground under the product's own pieces. One fragment shader of our own in raw
// WebGL2: a slow, domain-warped drift of the brand's green and one cool tone over the night, a soft light that
// follows the pointer, a vignette and a little grain. No text, no shape that could pass for data. Colours are read
// from the CSS variables of the canvas's own scope (a night scene). It draws only while its stage is on screen;
// `startFields` makes one when a stage nears and gives its context back when it is far, so at most two run.
//
// Plain TypeScript, no React, no library. A shader that fails to compile returns `null`: the stage keeps the CSS
// ground drawn under the canvas, which is what the still tier shows.

const VS = `#version 300 es
in vec2 aXY; void main() { gl_Position = vec4(aXY, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform float uP; uniform vec2 uMouse;
uniform vec3 uBase; uniform vec3 uGreen; uniform vec3 uCool; uniform vec3 uWarm;
out vec4 o;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1.0, 0.0)), u.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime * 0.035;
  // The drift: the noise is warped by itself, so the light moves like cloth in air, never like a pattern.
  vec2 w = vec2(fbm(q * 1.2 + vec2(t, -t)), fbm(q * 1.2 + vec2(-t * 0.7, t * 0.9) + 5.2));
  float f = fbm(q * 1.7 + w * 1.7 + vec2(uP * 0.8, 0.0));
  vec3 col = uBase;
  col = mix(col, uGreen * 0.5, smoothstep(0.45, 0.88, f) * 0.62);
  float c = smoothstep(0.55, 0.95, fbm(q * 2.4 - w + 3.0 - t));
  col = mix(col, uCool * 0.42, c * 0.22);
  // A soft light where the pointer is.
  vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col += uWarm * 0.06 * exp(-dot(q - m, q - m) * 2.5);
  col *= 1.0 - 0.38 * pow(length(uv - 0.5) * 1.25, 2.0);
  col += (h(gl_FragCoord.xy + fract(uTime * 0.37) * 91.0) - 0.5) * 0.018;
  o = vec4(col, 1.0);
}`;

function program(gl: WebGL2RenderingContext): WebGLProgram | null {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, FS]] as const) {
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

function cssColor(el: Element, name: string): [number, number, number] {
  const v = getComputedStyle(el).getPropertyValue(name).trim().split(/\s+/).map(Number);
  return [(v[0] ?? 0) / 255, (v[1] ?? 0) / 255, (v[2] ?? 0) / 255];
}

export type Field = { setProgress(p: number): void; destroy(): void };

/** One field on `canvas`. It draws at most at a pixel ratio of 1: it is soft by nature, and a full-screen shader at 2 costs four times as much for nothing. */
export function createField(canvas: HTMLCanvasElement): Field | null {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, powerPreference: "low-power" });
  if (!gl) return null;
  const prog = program(gl);
  if (!prog) return null;
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aXY");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (name: string) => gl.getUniformLocation(prog, name);
  const u = { res: U("uRes"), time: U("uTime"), p: U("uP"), mouse: U("uMouse"), base: U("uBase"), green: U("uGreen"), cool: U("uCool"), warm: U("uWarm") };
  gl.useProgram(prog);
  gl.uniform3fv(u.base, cssColor(canvas, "--ds-surface"));
  gl.uniform3fv(u.green, cssColor(canvas, "--ds-brand-ink"));
  gl.uniform3fv(u.cool, cssColor(canvas, "--ds-info"));
  gl.uniform3fv(u.warm, cssColor(canvas, "--ds-map-light"));

  let p = 0, raf = 0, dead = false, seen = false;
  let mx = 0.5, my = 0.5, sx = 0.5, sy = 0.5;
  const draw = (now: number) => {
    raf = 0;
    if (dead || !seen || document.hidden) return;
    const w = Math.max(1, Math.round(canvas.clientWidth)), h = Math.max(1, Math.round(canvas.clientHeight));
    if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });
    sx += (mx - sx) * 0.05;
    sy += (my - sy) * 0.05;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(u.res, w, h);
    gl.uniform1f(u.time, now / 1000);
    gl.uniform1f(u.p, p);
    gl.uniform2f(u.mouse, sx, 1 - sy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(draw);
  };
  const wake = () => {
    if (!raf && !dead) raf = requestAnimationFrame(draw);
  };
  const move = (e: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    mx = (e.clientX - box.left) / Math.max(1, box.width);
    my = (e.clientY - box.top) / Math.max(1, box.height);
  };
  const watched = new IntersectionObserver(([e]) => {
    seen = e?.isIntersecting ?? false;
    wake();
  });
  watched.observe(canvas);
  addEventListener("pointermove", move, { passive: true });
  document.addEventListener("visibilitychange", wake);
  return {
    setProgress(v) {
      p = v;
    },
    destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      watched.disconnect();
      removeEventListener("pointermove", move);
      document.removeEventListener("visibilitychange", wake);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/**
 * Every `canvas[data-field]` under `root`: a field is made only when its stage first comes within a screen of
 * view (a page read to its middle never makes the last ones), and draws only while it is on screen. A context once
 * lost cannot be asked for again on the same canvas, so a field is kept, idle, rather than given back and remade.
 * `progress` passes a scene's scroll to the field inside it (its light drifts with the story).
 */
export function startFields(root: HTMLElement): { progress(scene: string, p: number): void; stop(): void } {
  const canvases = [...root.querySelectorAll<HTMLCanvasElement>("canvas[data-field]")];
  const live = new Map<HTMLCanvasElement, Field>();
  const near = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const canvas = e.target as HTMLCanvasElement;
        if (!e.isIntersecting || live.has(canvas)) continue;
        const field = createField(canvas);
        if (field) live.set(canvas, field);
        near.unobserve(canvas);
      }
    },
    { rootMargin: "100% 0px" },
  );
  for (const c of canvases) near.observe(c);
  return {
    progress(scene, p) {
      for (const [canvas, field] of live) if (canvas.closest<HTMLElement>("[data-scene]")?.dataset.scene === scene) field.setProgress(p);
    },
    stop() {
      near.disconnect();
      for (const field of live.values()) field.destroy();
      live.clear();
    },
  };
}
