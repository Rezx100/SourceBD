"use client";

// The hero's 8 s cotton loop (public/site/home/hero-loop-720.*, PROVENANCE.md) over the still. It is not in the
// server's HTML: the video element is added once the page has loaded, so the first paint is the still alone, and it
// is never added under reduced motion or Save-Data. It sits behind the screen, muted, looping, inline, with the
// still as its poster, and fades in when it can play, so there is no jump and no layout shift (it fills a box that
// already has its size).

import { useEffect, useState } from "react";

export function HeroLoop() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (saver || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = () => setOn(true);
    if (document.readyState === "complete") {
      const id = window.setTimeout(start, 300);
      return () => window.clearTimeout(id);
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  if (!on) return null;
  return (
    <video
      aria-hidden
      tabIndex={-1}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      poster="/site/home/hero-cotton-1600.webp"
      onCanPlay={() => setReady(true)}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-reveal ${ready ? "opacity-100" : "opacity-0"}`}
    >
      <source src="/site/home/hero-loop-720.webm" type="video/webm" />
      <source src="/site/home/hero-loop-720.mp4" type="video/mp4" />
    </video>
  );
}
