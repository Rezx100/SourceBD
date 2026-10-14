"use client";

// A tablist over one demo stage (M4, handoff-mercury-m4-onward.md §4.1): the product records page's "Inside one
// record", where each tab opens the same record at another section. The tabs are buttons in a `tablist` (arrow
// keys, Home and End move between them); the shown demo swaps out over 200 ms with a blur, then the next swaps in
// over 320 ms with a rise, at once under reduced motion. The server draws the first tab, so the page reads complete
// with no script. Drawn as the record's own tab strip is (the home's "Inside one record" and the record pane).

import { useEffect, useId, useState, type ComponentType, type KeyboardEvent } from "react";
import { stillPreferred } from "@/components/site/motion";
import { motion } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import { ring } from "./ui";

export type DemoTab = { key: string; label: string; Demo: ComponentType<{ className?: string }> };

export function TabbedDemo({ tabs, label, className }: { tabs: readonly DemoTab[]; /** What the tabs choose between, for a screen reader. */ label: string; className?: string }) {
  const id = useId();
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // The demo swaps out (200 ms, blur) before the next swaps in (320 ms, rise); at once under reduced motion.
  useEffect(() => {
    if (active === shown) return;
    setLeaving(true);
    const t = window.setTimeout(
      () => {
        setShown(active);
        setLeaving(false);
      },
      stillPreferred() ? 0 : motion.swapOutMs,
    );
    return () => clearTimeout(t);
  }, [active, shown]);

  const keys = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = tabs.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
    if (to === null) return;
    e.preventDefault();
    setActive(to);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[to]?.focus();
  };

  const Shown = tabs[shown]!.Demo;
  return (
    <div className={cn("flex flex-col gap-8 md:gap-10", className)}>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t, i) => {
          const on = i === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${id}-tab-${t.key}`}
              aria-selected={on}
              aria-controls={`${id}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => keys(e, i)}
              className={cn("flex min-h-11 shrink-0 flex-col justify-end gap-2.5 px-3.5 pt-2 text-site-body font-medium", ring, on ? "text-ink-strong" : "text-ink-muted hover:text-ink-strong")}
            >
              {t.label}
              <span aria-hidden className={cn("h-0.5 rounded-sm", on ? "bg-ink-strong" : "bg-transparent")} />
            </button>
          );
        })}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-tab-${tabs[active]!.key}`}>
        <div key={shown} className={cn(leaving ? "animate-swap-out" : "animate-swap-in", "motion-reduce:animate-none")}>
          <Shown />
        </div>
      </div>
    </div>
  );
}
