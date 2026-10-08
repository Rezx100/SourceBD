"use client";

// Two tabs over two panels that are BOTH in the page (Sourcing and Compliance, Paper chapter 7): the buttons only
// choose which is shown, so a search engine and a reader without script get both. The panels come in as props.

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function RoleTabs({ tabs }: { tabs: { key: string; label: string; panel: ReactNode }[] }) {
  const [on, setOn] = useState(tabs[0]!.key);
  const id = useId();
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Choose a role" className="flex w-fit gap-1 rounded-sm border border-line p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`${id}-${t.key}-tab`}
            aria-selected={on === t.key}
            aria-controls={`${id}-${t.key}`}
            onClick={() => setOn(t.key)}
            className={cn("h-9 rounded-sm px-4 text-base font-medium outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus max-sm:h-11", on === t.key ? "bg-ink text-surface" : "text-ink-2 hover:bg-sunken")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} id={`${id}-${t.key}`} role="tabpanel" aria-labelledby={`${id}-${t.key}-tab`} hidden={on !== t.key}>
          {t.panel}
        </div>
      ))}
    </div>
  );
}
