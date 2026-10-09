// The film's stage and the product's own pieces on it (founder's video, 7 Oct 2026: "think about the dashboard,
// our dashboard with animated visuals with card background, animated card background, high contrast visuals"). A
// stage is a night panel with the moving field under it (engine/field.ts; a still CSS ground on the tiers that do
// not draw it). On it stands one window of the app, light in either theme as the app is, drawn from the kit's own
// parts: the source marks, the certificate and fact chips, the record's head. Nothing floats beside a scene and
// nothing pops: the window holds still and what is in it changes. Server components.

import type { ReactNode } from "react";
import { SourceMark } from "@/components/patterns/source-mark";
import { LINE_FULL, NAME, SOURCES } from "@/components/site/film/record";
import { cn } from "@/lib/utils";

/** A night panel with the moving field under what it holds. */
export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-ground="night" className={cn("film-stage relative isolate overflow-hidden rounded-[28px] bg-surface text-ink max-sm:rounded-pane-phone", className)}>
      <canvas data-field aria-hidden className="absolute inset-0 hidden size-full film:block" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** One window of the app: its bar (the mark, where you are, and what the bar holds at the right), then its body. Light in either theme. */
export function AppWindow({ where, aside, children, className, label }: { where: string; aside?: ReactNode; children: ReactNode; className?: string; label: string }) {
  return (
    <figure data-ground="day" aria-label={label} className={cn("app-window overflow-hidden rounded-[12px] bg-surface text-ink shadow-dialog", className)}>
      <div className="flex h-11 items-center justify-between gap-3 border-b border-line px-4">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand font-mono text-[11px] font-semibold text-brand-on">
            SB
          </span>
          <span className="truncate text-sm font-medium text-ink-2">{where}</span>
        </span>
        {aside}
      </div>
      {children}
    </figure>
  );
}

/** The record's head as the app draws it: the initials on the top source's rank, the name on one line, the place, the marks in a row. */
export function RecordHead({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 px-5 pb-4 pt-5", className)}>
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md bg-tier-1 font-mono text-sm font-medium text-tier-1-on">
        MF
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-xl font-medium tracking-[-0.01em] text-ink">{NAME}</p>
        <p className="text-sm text-ink-3">{LINE_FULL}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {SOURCES.marks?.map((s) => <SourceMark key={s} source={s} lazy />)}
          <span className="pl-1.5 text-sm text-ink-2">{SOURCES.value}</span>
        </div>
      </div>
    </div>
  );
}
