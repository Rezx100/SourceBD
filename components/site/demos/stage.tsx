"use client";

// What every coded product demo on the site shares (handoff-mercury-m2-m3.md, M2; the founder's videos of 22 Oct 2026):
// `Demo` is a `DemoStage` drawn at the app's proportions inside the same desktop browser window as the recordings of
// the real app (`sections/browser.tsx`), its pause button in the window's corner and no caption under it. The app has
// no dark theme: `data-ground="day"` keeps the window light inside any tone. `typed` and `streamed` write the steps a
// scene needs to type a search or let rows arrive one at a time, at the motion tokens' pace.

import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { DemoStage, type CursorState, type Step } from "@/components/site/motion";
import { BrowserFrame, FitPage, PauseButton } from "@/components/site/sections/browser";
import { Stage, type StillName } from "@/components/site/sections/ui";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

/**
 * Where a demo sits on its page: `stage` puts its window on a photograph (a hero's or a row's) or straight on the night
 * ground (`night`); `eager` loads the photograph first (a hero's); `after` is a line under the window (the search
 * page's live count); `url` is what the window's address bar says.
 */
export type Frame = { className?: string; stage?: StillName | "night"; eager?: boolean; after?: ReactNode; url?: string };

/** Steps that type `text` one character at a time from `from` ms, each drawing what has been typed so far. */
export function typed<S>(text: string, from: number, draw: (typed: string) => S): Step<S>[] {
  return [...text].map((_, i) => ({ at: from + i * motion.typeMs, state: draw(text.slice(0, i + 1)) }));
}

/** Steps that let `n` rows arrive one at a time from `from` ms, `motion.streamMs` apart. */
export function streamed<S>(n: number, from: number, draw: (count: number) => S): Step<S>[] {
  return Array.from({ length: n }, (_, i) => ({ at: from + i * motion.streamMs, state: draw(i + 1) }));
}

/** When the last of `steps` starts. */
export const endOf = (steps: readonly Step<unknown>[]): number => steps[steps.length - 1]?.at ?? 0;

/** A product window: the app's light ground whatever the page's tone, the frame radius and a real edge, so it reads as a card on paper (critique 22 Oct, S4). */
export function Window({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-ground="day" className={cn("relative flex min-h-[420px] flex-col overflow-hidden rounded-frame border border-line-strong bg-surface text-base text-ink [container-type:inline-size]", className)}>
      {children}
    </div>
  );
}

/** A demo: its window in the browser, on its stage, with the pause button in the window's corner. */
export function Demo<S extends CursorState>({ steps, description, className, stage, eager = false, after, url = "sourcebd.net/app", children }: Frame & { steps: readonly Step<S>[]; description: string; children: (state: S) => ReactNode }) {
  const frame = (win: ReactNode, pause: { paused: boolean; toggle: () => void }) => {
    const browser = (
      <BrowserFrame url={url}>
        <FitPage>
          <div className="p-8">{win}</div>
        </FitPage>
        <PauseButton paused={pause.paused} onToggle={pause.toggle} label="Pause demo" />
      </BrowserFrame>
    );
    return stage && stage !== "night" ? (
      <Stage still={stage} eager={eager}>
        {browser}
      </Stage>
    ) : (
      browser
    );
  };
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <DemoStage steps={steps} description={description} frame={frame} windowClass="shadow-sm">
        {children}
      </DemoStage>
      {after}
    </div>
  );
}

/** The app's top bar inside a window: a title on the left, what the demo is doing on the right. */
export function Bar({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
      <p className="min-w-0 truncate text-base font-semibold text-ink">{title}</p>
      {children}
    </div>
  );
}

/** A filter chip as the kit's `FilterChip` draws it, its remove control drawn, not a link: nothing in a demo takes focus. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-0.5 rounded-md border border-line-strong bg-surface pl-2 text-sm font-medium text-ink">
      {children}
      <span className="flex size-6 shrink-0 items-center justify-center text-ink-2">
        <X size={12} aria-hidden />
      </span>
    </span>
  );
}

/** A field as the app draws it, with a caret while it is being typed into. */
export function Field({ label, value, placeholder, typing = false, className }: { label?: string; value: string; placeholder?: string; typing?: boolean; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      {label ? <span className="text-sm font-medium text-ink-2">{label}</span> : null}
      <span className={cn("flex h-control items-center rounded-sm border bg-surface px-2.5 text-base", typing ? "border-ink" : "border-line-strong")}>
        <span className={cn("min-w-0 truncate", value ? "text-ink" : "text-ink-3")}>{value || placeholder}</span>
        {typing ? <span aria-hidden className="ml-px h-4 w-px animate-pulse bg-ink" /> : null}
      </span>
    </div>
  );
}
