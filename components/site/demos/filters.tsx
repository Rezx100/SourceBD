"use client";

// Filters (critique 22 Oct: the search page's filter row, and the sourcing page's Find, were 3 Oct screenshots): the
// filter pane open over a search for "knit", as the app draws it (components/search/filter-panel.tsx and the words of
// filter-model.ts): Certificates open with its four schemes and the status that waits for one to be ticked, Location
// closed, Clear all and the button that says how many suppliers the draft will show. The cursor ticks GOTS and the
// button counts: the figure is the snapshot's own search, "knit" with GOTS held, as read on the snapshot's day. The
// pane's controls are drawn, not real inputs: nothing in a demo takes focus.

import { CaretDown, Check } from "@phosphor-icons/react";
import { FilterChip, buttonClass } from "@/components/kit";
import { CERT_NAME, CERT_ORDER, CERT_STATES, showLabel } from "@/components/search/filter-model";
import type { CursorState, Step } from "@/components/site/motion";
import { formatCount } from "@/lib/dashboard/facts";
import { motion } from "@/lib/design/tokens";
import { SNAPSHOT } from "@/lib/marketing/demo-snapshot";
import { cn } from "@/lib/utils";
import { Bar, Demo, Window, type Frame } from "./stage";

const { search } = SNAPSHOT;

type S = CursorState & { gots: boolean };
export const STEPS: Step<S>[] = [
  { at: 0, state: { gots: false } },
  { at: 700, state: { gots: false, cursor: "cert-gots" } },
  { at: 700 + motion.cursorMs, state: { gots: false, cursor: "cert-gots", click: true } },
  { at: 700 + motion.cursorMs + motion.clickMs, state: { gots: true, cursor: "cert-gots" } },
  { at: 700 + 2 * motion.cursorMs + motion.clickMs + 400, state: { gots: true, cursor: "show" } },
];

/** A checkbox as the kit draws one, unticked or ticked. */
function Box({ on }: { on: boolean }) {
  return (
    <span className={cn("relative inline-flex size-4 shrink-0 items-center justify-center rounded-sm border", on ? "border-ink bg-ink text-surface" : "border-line-strong bg-surface")}>
      {on ? <Check size={12} weight="bold" aria-hidden /> : null}
    </span>
  );
}

/** A group's header as the pane draws it from 768: its name, semibold when open, and the caret. */
function Head({ title, open }: { title: string; open: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-5">
      <span className={cn("text-base text-ink", open ? "font-semibold" : "font-medium")}>{title}</span>
      <CaretDown size={16} className={cn("shrink-0 text-ink-2", open && "rotate-180")} aria-hidden />
    </div>
  );
}

export function DemoFilters(frame: Frame) {
  return (
    <Demo {...frame} steps={STEPS} description={`The filter pane open over a search for knit: GOTS is ticked under Certificates and the button counts ${formatCount(search.total) ?? "the"} suppliers before the filter is applied.`}>
      {(s) => (
        <Window>
          <Bar title="Filters" />
          <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
            <FilterChip removeHref="#" removeLabel="Remove knit">
              knit
            </FilterChip>
            {s.gots ? (
              <span className="animate-swap-in motion-reduce:animate-none">
                <FilterChip removeHref="#" removeLabel="Remove GOTS">
                  GOTS
                </FilterChip>
              </span>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col">
            <section className="border-b border-line">
              <Head title="Certificates" open />
              <div className="flex flex-col gap-2 px-5 pb-3.5">
                {CERT_ORDER.map((k) => (
                  <span key={k} data-cursor={`cert-${k}`} className="inline-flex min-h-7 w-fit items-center gap-2.5 text-base text-ink">
                    <Box on={k === "gots" && s.gots} />
                    {CERT_NAME[k]}
                  </span>
                ))}
                <p className="pt-1 text-xs font-semibold text-ink-3">Certificate status</p>
                <span className={cn("inline-flex w-fit gap-0.5 rounded-sm bg-sunken p-0.5", !s.gots && "opacity-60")}>
                  {CERT_STATES.map((o) => (
                    <span key={o.value} className={cn("flex h-7 items-center rounded-sm px-3 text-base font-medium", o.value === "any" ? "border border-line-strong bg-surface text-ink" : "text-ink-2")}>
                      {o.label}
                    </span>
                  ))}
                </span>
                {s.gots ? null : <p className="text-xs text-ink-3">Tick a certificate to choose its status.</p>}
              </div>
            </section>
            <section className="border-b border-line">
              <Head title="Location" open={false} />
            </section>
            <section className="border-b border-line">
              <Head title="Workers and founding year" open={false} />
            </section>
          </div>
          <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-t border-line px-5">
            <span className="text-base font-medium text-ink-2 underline decoration-1">Clear all</span>
            <span data-cursor="show" className={buttonClass({ kind: "primary", size: "lg" })}>
              {showLabel(s.gots ? search.total : null)}
            </span>
          </div>
        </Window>
      )}
    </Demo>
  );
}
