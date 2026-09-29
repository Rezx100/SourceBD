"use client";

// The record's name in its bar once the head has scrolled away (the phone
// hand-off's D6; LinkedIn, Fresha and Google Maps do it): on a phone the bar
// is sticky and says whose record it is however far down the buyer reads.
// A copy for the eye only (`aria-hidden`): the head's heading is the name.

import { useEffect, useRef, useState } from "react";

export function BarTitle({ text, title }: { text: string; /** The whole name, on hover. */ title: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const head = ref.current?.closest("section")?.querySelector("[data-record-head]");
    if (!head || typeof IntersectionObserver === "undefined") return;
    // Shown once the head is wholly above the bar's foot (the bar is 52px).
    const io = new IntersectionObserver(([e]) => setShown(!e!.isIntersecting && e!.boundingClientRect.top < 0), { rootMargin: "-52px 0px 0px 0px" });
    io.observe(head);
    return () => io.disconnect();
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden
      data-name=""
      title={title}
      data-shown={shown ? "" : undefined}
      className="min-w-0 flex-1 truncate text-base font-medium text-ink-strong opacity-0 transition-opacity duration-fast data-[shown]:opacity-100 md:hidden"
    >
      {text}
    </span>
  );
}
