// 13 · Sources ladder: the trust hierarchy, top rung first, with the framed marks on tiers 1 to 3. Tier 6 is set quiet:
// it never enters a record on its own (AGENTS.md rules 5 and 6). Since the founder's video 3 of 22 Oct 2026 ("a lot of
// space wasted, visually empty, it looks thin") the ladder fills the width: the heading over it, not in an empty column
// beside it, and six rungs that step down and in, each with its rank as a large figure, its name at heading size and
// the marks at 48 px. The rungs stack in one after another as the ladder comes into view; nothing pins.

import { SourceMark, hasSourceMark } from "@/components/patterns/source-mark";
import { cn } from "@/lib/utils";
import { TIERS } from "../sources";
import { Reveal } from "./reveal";
import { H2, Lede, TextLink, measure } from "./ui";

/** The methodology page's tiers (`sources.ts`), so the two pages cannot list different sources; approved marks on tiers 1–3 (`context/logos.lock.md`: no mark, no render). */
export const LADDER: { tier: string; name: string; what: string; marks: string[] }[] = [
  ...TIERS.map((t) => ({ tier: `Tier ${t.n}`, name: t.label, what: t.ladder.split(", ").join(" · "), marks: t.n <= 3 ? t.sources.map((s) => s.code).filter(hasSourceMark) : [] })),
  { tier: "Tier 6", name: "Cross-check only", what: "Never enters a record on its own", marks: [] },
];

/** Each rung steps in a little further than the one above it. */
const STEP = ["lg:ml-0", "lg:ml-[5%]", "lg:ml-[10%]", "lg:ml-[15%]", "lg:ml-[20%]", "lg:ml-[25%]"];

export function Ladder() {
  return (
    <section aria-labelledby="home-ladder" className={cn(measure, "flex flex-col gap-10 py-16 md:gap-14 lg:py-section")}>
      <div className="grid gap-5 lg:grid-cols-12 lg:items-end lg:gap-16">
        <H2 id="home-ladder" className="lg:col-span-6">
          Receipts, <span className="text-ink-subtle">not opinions.</span>
        </H2>
        <div className="flex flex-col gap-4 lg:col-span-6">
          <Lede>Government registers come first. A source lower down never overwrites one above it. There is no SourceBD score, grade or star.</Lede>
          <TextLink href="/methodology" className="w-fit">
            Read the methodology
          </TextLink>
        </div>
      </div>
      <Reveal as="ol" className="flex min-w-0 flex-col gap-2.5">
        {LADDER.map((r, i) => {
          const quiet = i === LADDER.length - 1;
          return (
            <li
              key={r.tier}
              style={{ transitionDelay: `${i * 90}ms` }}
              className={cn(
                "grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-5 gap-y-4 rounded-card px-5 py-5 transition-[opacity,transform] duration-reveal ease-reveal motion-reduce:transition-none group-data-[reveal=wait]/reveal:translate-y-4 group-data-[reveal=wait]/reveal:opacity-0 sm:grid-cols-[4rem_minmax(0,1fr)_auto] md:px-8 md:py-6",
                STEP[i],
                quiet ? "border border-dashed border-line" : "bg-surface",
              )}
            >
              <span aria-hidden className={cn("text-site-figure-sm font-light tabular-nums md:text-site-figure", quiet ? "text-ink-subtle" : "text-ink-strong")}>
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span className="sr-only">{r.tier}</span>
                <span className={cn("text-xl font-normal md:text-site-h3", quiet ? "text-ink-subtle" : "text-ink-strong")}>{r.name}</span>
                <span className={cn("text-site-body md:text-site-lede", quiet ? "text-ink-subtle" : "text-ink-muted")}>{r.what}</span>
              </div>
              {r.marks.length ? (
                <span className="col-span-2 flex flex-wrap gap-2.5 sm:col-span-1 sm:justify-end">
                  {r.marks.map((m) => (
                    <SourceMark key={m} source={m} className="size-12 border-ink-strong/10 [&>img]:max-h-[32px] [&>img]:max-w-[32px]" />
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </Reveal>
    </section>
  );
}
