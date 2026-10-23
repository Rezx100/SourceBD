"use client";

// The home page's `<main>` since the founder's walkthrough of 23 Oct 2026 (mercury.com's page, to be matched exactly):
// the whole page stands on one ground at a time, night, warm or day (`homeGrounds`, lib/design/tokens.ts), and fades to
// the next as a section of another tone reaches the middle of the window, the bar and every word fading with it
// (mercury.com's, measured: the switch at the middle, half a second). Each section says its tone (`data-mk-tone`).
// With no script the sections stand on their own grounds, fixed, so the page reads the same without this.

import { useEffect, useRef, type ReactNode } from "react";
import type { HomeGround } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

/** The tone of the last section whose top has passed `line` (the window's middle), or the first section's before any has. */
export function toneAt(sections: readonly { top: number; tone: HomeGround }[], line: number): HomeGround | null {
  let tone = sections[0]?.tone ?? null;
  for (const s of sections) {
    if (s.top > line) break;
    tone = s.tone;
  }
  return tone;
}

export function HomeMain({ className, children }: { className?: string; children: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = main.current;
      if (!el) return;
      const sections = [...el.querySelectorAll<HTMLElement>(":scope > [data-mk-tone]")].map((s) => ({ top: s.getBoundingClientRect().top, tone: s.dataset.mkTone as HomeGround }));
      const tone = toneAt(sections, innerHeight / 2);
      if (tone && root.dataset.mkPage !== tone) root.dataset.mkPage = tone;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      delete root.dataset.mkPage;
    };
  }, []);
  return (
    <main ref={main} className={cn("text-ink", className)}>
      {children}
    </main>
  );
}
