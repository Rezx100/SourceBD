"use client";

// A scroll region with a short, faint handle instead of the browser's: the handle stays 32px
// however long the list is, slides with the scroll, darkens on hover and can be dragged. The
// browser's own bar is hidden; wheel, touch and keys scroll the region as before.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const THUMB = 32;

export function ShortScroll({ className, children }: { className?: string; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const place = () => {
      const room = el.scrollHeight - el.clientHeight;
      setTop(room > 1 ? (el.scrollTop / room) * (el.clientHeight - THUMB - 4) + 2 : null);
    };
    place();
    el.addEventListener("scroll", place, { passive: true });
    const ro = new ResizeObserver(place);
    ro.observe(el);
    ro.observe(el.firstElementChild!);
    return () => {
      el.removeEventListener("scroll", place);
      ro.disconnect();
    };
  }, []);

  function drag(e: ReactPointerEvent<HTMLSpanElement>) {
    const el = box.current;
    if (!el) return;
    e.preventDefault();
    const thumb = e.currentTarget;
    thumb.setPointerCapture(e.pointerId);
    const y0 = e.clientY;
    const s0 = el.scrollTop;
    const ratio = (el.scrollHeight - el.clientHeight) / Math.max(1, el.clientHeight - THUMB - 4);
    const move = (m: PointerEvent) => (el.scrollTop = s0 + (m.clientY - y0) * ratio);
    const up = () => {
      thumb.removeEventListener("pointermove", move);
      thumb.removeEventListener("pointerup", up);
    };
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", up);
  }

  return (
    <div className={cn("group/scroll relative min-h-0", className)}>
      <div ref={box} className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div>{children}</div>
      </div>
      {top !== null ? (
        <span
          aria-hidden
          onPointerDown={drag}
          style={{ top, height: THUMB }}
          className="absolute right-0.5 z-raised w-1 cursor-default rounded-full bg-line-strong opacity-30 transition-opacity hover:opacity-70 group-hover/scroll:opacity-50"
        />
      ) : null}
    </div>
  );
}
