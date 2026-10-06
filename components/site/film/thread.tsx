// The thread and the rail (handoff-home-film §3.4). The thread is one green path from the first dot to the RFQ:
// solid when it leads, stitched (dash 9 6) when it joins, a bartack where it ends (the short dense zigzag that
// ends a seam; never a circle, which read as a magnifying glass). It draws with the scroll: the scene writes `--p`
// from 0 to 1 and the path's mask follows; with no `--p` it is whole. The rail is the nine chapters at the left
// edge, each tick a link, the green dot on the current one; on a phone it is a thin progress line. Server components.

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The layer threads are drawn on, in the scene's own coordinates. Decoration: the words carry the story. */
export function ThreadLayer({ viewBox, className, children }: { viewBox: string; className?: string; children: ReactNode }) {
  return (
    <svg aria-hidden viewBox={viewBox} className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}>
      {children}
    </svg>
  );
}

export function Thread({ d, join, end }: { d: string; join?: boolean; end?: { x: number; y: number; angle?: number } }) {
  const id = useId();
  return (
    <g>
      {/* The mask is the same path, solid, drawn by `--p`: it uncovers a stitched thread stitch by stitch. White is the mask's "show", not a colour. */}
      <mask id={id} maskUnits="userSpaceOnUse">
        <path d={d} pathLength={1} className="thread-draw" fill="none" stroke="white" strokeWidth={5} strokeLinecap="round" />
      </mask>
      <path d={d} mask={`url(#${id})`} className={cn("thread", join && "thread-join")} />
      {end ? <path d="M-5 -3.5 -3 3.5 -1 -3.5 1 3.5 3 -3.5 5 3.5" transform={`translate(${end.x} ${end.y}) rotate(${end.angle ?? 0})`} className="thread thread-end" /> : null}
    </g>
  );
}

export type RailChapter = { id: string; n: string; label: string };

/** `current` is the chapter's id. The film's director moves `aria-current` as the page scrolls; nothing here counts. */
export function Rail({ chapters, current, className }: { chapters: RailChapter[]; current?: string; className?: string }) {
  return (
    <nav aria-label="Chapters" className={className}>
      <ol className="flex h-full flex-col justify-between border-l border-line max-lg:hidden">
        {chapters.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`} aria-current={c.id === current ? "step" : undefined} className="group -ml-px flex h-6 items-center gap-2 font-mono text-xs text-ink-3 hover:text-ink aria-[current]:font-semibold aria-[current]:text-ink">
              <span aria-hidden className="h-px w-2.5 bg-line-strong group-aria-[current]:-ml-1 group-aria-[current]:size-2.5 group-aria-[current]:rounded-full group-aria-[current]:bg-brand-ink" />
              {c.n}
              <span className="sr-only"> {c.label}</span>
            </a>
          </li>
        ))}
      </ol>
      <span aria-hidden className="fixed inset-x-0 top-0 z-sticky h-0.5 origin-left bg-brand-ink [transform:scaleX(var(--film-p,0))] lg:hidden" />
    </nav>
  );
}
