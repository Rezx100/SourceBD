// 10 · Start in a minute (Paper `1FVW-0` / `1FZE-0`): three cards, each topped by a crop of the app as shipped
// (the plan line in Settings, the search field with Ctrl K) or by the app's own shortcut list.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KeysCard } from "./keys-card";
import { H2, measure } from "./ui";

/** A window onto a 1440-wide screen at (x, y), the way the board crops it. */
function Crop({ name, x, y, alt }: { name: "settings-members" | "landing"; x: number; y: number; alt: string }) {
  return (
    <div className="relative h-[220px] overflow-hidden border-b border-line-subtle bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized in public/site/home (PROVENANCE.md) */}
      <img
        src={`/site/home/screen-${name}-1440.webp`}
        srcSet={`/site/home/screen-${name}-1440.webp 1x, /site/home/screen-${name}-2880.webp 2x`}
        alt={alt}
        width={1440}
        height={900}
        loading="lazy"
        decoding="async"
        style={{ left: -x, top: -y }}
        className="absolute h-[900px] w-[1440px] max-w-none"
      />
    </div>
  );
}

const CARDS: { title: string; body: string; top: ReactNode }[] = [
  { title: "Sign up with no card", body: "A work email is enough. Search is free while we are in beta, and the plan page says so in the app.", top: <Crop name="settings-members" x={150} y={60} alt="Settings in the app, showing the Free plan (beta)" /> },
  { title: "One search field, Ctrl K", body: "Supplier, product, certificate or HS code in one box, from any screen. Filters open from the results bar.", top: <Crop name="landing" x={1010} y={60} alt="The search field at the top of the app, with its Ctrl K hint" /> },
  { title: "Keys and the glossary", body: "The arrows walk the list and the record follows. Every defined term explains itself on hover; ? opens this sheet.", top: <KeysCard /> },
];

export function StartInAMinute() {
  return (
    <section aria-labelledby="home-start" className={cn(measure, "flex flex-col items-center gap-10 py-14 md:gap-14 md:py-[120px]")}>
      <H2 id="home-start" className="text-center">
        Start in a minute.
      </H2>
      <ul className="grid w-full gap-5 md:gap-8 lg:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.title} className="flex flex-col overflow-hidden rounded-[16px] border border-line bg-surface">
            {c.top}
            <div className="flex flex-col gap-2 px-6 pb-[26px] pt-[22px]">
              <h3 className="text-[20px] font-medium leading-6 text-ink-strong">{c.title}</h3>
              <p className="text-[15px] leading-[22px] text-ink-muted">{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
