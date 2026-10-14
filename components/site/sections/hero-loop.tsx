"use client";

// The hero's cloth: the cotton still, and over it the 8 s loop (public/site/home/hero-loop-720.*, PROVENANCE.md) once
// the page has loaded. The video is not in the server's HTML: it is added after load, so the first paint is the still
// alone, and never under reduced motion, Save-Data or below 768 px. It sits behind the screen, muted, looping, inline,
// with the still as its poster, and fades in when it can play. A 44 px pause button stands beside it for as long as it
// plays (WCAG 2.2.2); it is outside the cloth box, so the hero's scroll scrub (M3) zooms the cloth and not the button.

import { Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Still, ring } from "./ui";

export function HeroLoop() {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const saver = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    // A phone's stage is a thin border of cloth around the screen: not worth 340 KB.
    if (saver || still.matches || matchMedia("(max-width: 767px)").matches) return;
    const start = () => setOn(true);
    // Reduced motion switched on while the page is open stops the loop at once.
    const stop = (e: MediaQueryListEvent) => e.matches && setOn(false);
    still.addEventListener("change", stop);
    const id = document.readyState === "complete" ? window.setTimeout(start, 300) : undefined;
    if (id === undefined) window.addEventListener("load", start, { once: true });
    return () => {
      still.removeEventListener("change", stop);
      window.clearTimeout(id);
      window.removeEventListener("load", start);
    };
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  return (
    <>
      <div className="mk-hero-cloth absolute inset-0">
        <Still name="hero-cotton" eager />
        {on ? (
          <video
            ref={video}
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
        ) : null}
      </div>
      {on ? (
        <button
          type="button"
          aria-label="Pause background video"
          aria-pressed={paused}
          onClick={toggle}
          className={cn("absolute bottom-3 left-3 z-raised flex size-11 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-menu hover:bg-sunken", ring)}
        >
          {paused ? <Play size={16} weight="fill" aria-hidden /> : <Pause size={16} weight="fill" aria-hidden />}
        </button>
      ) : null}
    </>
  );
}
