"use client";

// Spec M6a — Hero particle field. Light-weight canvas decoration that
// underlays the dark hero. Honours `prefers-reduced-motion`, pauses
// on tab blur, disables itself entirely under 720px viewport (per
// M6 JC #8). ≤50 particles, no external library.

import { useEffect, useRef } from "react";

type Particle = { x: number; y: number; vx: number; vy: number; r: number; a: number };

export function HeroParticles() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 720px)").matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const particles: Particle[] = [];

    function size() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function seed() {
      if (!canvas) return;
      particles.length = 0;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const count = Math.min(50, Math.floor((w * h) / 28000));
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18,
          vy: (Math.random() - 0.5) * 0.18,
          r: 0.6 + Math.random() * 1.2,
          a: 0.18 + Math.random() * 0.32,
        });
      }
    }
    function tick() {
      if (!running || !canvas || !ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        if (p.y < -8) p.y = h + 8;
        if (p.y > h + 8) p.y = -8;
        ctx.beginPath();
        ctx.fillStyle = `rgba(140, 188, 157, ${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = window.requestAnimationFrame(tick);
    }
    function onVisibility() {
      if (document.hidden) {
        running = false;
        window.cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = window.requestAnimationFrame(tick);
      }
    }
    function onResize() {
      size();
      seed();
    }

    size();
    seed();
    raf = window.requestAnimationFrame(tick);
    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="mkt-hero-canvas" aria-hidden="true" />;
}
