// Locations (`03 Patterns · 12`, RC-09 and RC-10): one clean address per site beside the map,
// each saying its kind and precision in words, so the legend is never needed to read the page.
// The map itself is the existing Barikoi capture (B4 wires it and the two-way selection: the
// selected address is tint and a bar, its pin gets a brand ring). No spelling variants and no
// geocoding at runtime. Server-safe.

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SITE_WORDS, type SiteKind } from "./words";

/** The numbered pin: brand for a factory pinned to its address, ink for an office, a white ring for approximate. */
export function Pin({ n, kind, ring, className }: { n: number; kind: SiteKind; ring?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        kind === "factory-exact" && "bg-brand-ink text-surface",
        kind === "office" && "bg-ink-2 text-surface",
        kind === "factory-approx" && "border-2 border-ink bg-surface text-ink",
        ring && "[box-shadow:0_0_0_3px_theme(colors.surface),0_0_0_5px_theme(colors.brand-ink)]",
        className,
      )}
      aria-hidden
    >
      {n}
    </span>
  );
}

export type Site = {
  n: number;
  kind: SiteKind;
  address: string;
  /** "From BGMEA, BKMEA and OEKO-TEX", or for an approximate one "The pin marks the area, not the building." */
  note: string;
  /** Selecting a site is a link (`?site=2`), so it works with no script. */
  href?: string;
  /** The kind line when `SITE_WORDS` would claim too much (a factory with no pin is not "pinned to the address"). */
  words?: string;
};

/**
 * `onSelect` lets a page that holds the selection (the map beside the list) take the click instead
 * of navigating: a plain click selects, a modified one (new tab) still follows the link.
 */
export function SiteList({ sites, selected, onSelect, className }: { sites: Site[]; selected?: number; onSelect?: (n: number) => void; className?: string }) {
  return (
    <ul className={cn("flex flex-col overflow-clip rounded-lg border border-line", className)}>
      {sites.map((s) => {
        const on = s.n === selected;
        const body = (
          <>
            <Pin n={s.n} kind={s.kind} />
            <span className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-ink-2">{s.words ?? SITE_WORDS[s.kind]}</span>
              <span className="text-base font-medium text-ink">{s.address}</span>
              <span className="text-xs text-ink-3">{s.note}</span>
            </span>
          </>
        );
        const cls = cn("flex gap-3 border-b border-l-2 border-line px-3.5 py-3 last:border-b-0", on ? "border-l-brand-ink bg-brand-tint" : "border-l-transparent");
        return (
          <li key={s.n} aria-current={on ? "true" : undefined}>
            {s.href ? (
              <Link
                href={s.href}
                scroll={false}
                onClick={
                  onSelect
                    ? (e) => {
                        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        onSelect(s.n);
                      }
                    : undefined
                }
                className={cn(cls, "hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus", on && "hover:bg-brand-tint")}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const LEGEND: [SiteKind, string][] = [
  ["factory-exact", "Factory, pinned to the address"],
  ["office", "Office: registered or mailing address"],
  ["factory-approx", "Approximate: matched to the area, not the building"],
];

export function PinLegend() {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg bg-subtle p-4">
      <p className="text-xs font-semibold text-ink-2">Pins</p>
      {LEGEND.map(([k, words]) => (
        <p key={k} className="flex items-center gap-2.5 text-sm text-ink">
          <span className={cn("size-5 shrink-0 rounded-full", k === "factory-exact" && "bg-brand-ink", k === "office" && "bg-ink-2", k === "factory-approx" && "border-2 border-ink bg-surface")} aria-hidden />
          {words}
        </p>
      ))}
    </div>
  );
}

/** Phone: a card with the map and the count of sites; it opens the map full screen. */
export function MapCard({ count, summary, href, map }: { count: number; summary: string; href: string; map: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="text-md font-semibold text-ink">Sites · {count}</h3>
        <Link href={href} className="rounded-sm text-base font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
          Open map
        </Link>
      </header>
      <div className="aspect-[356/163] overflow-clip rounded-md border border-line">{map}</div>
      <p className="text-base text-ink-2">{summary}</p>
    </section>
  );
}
