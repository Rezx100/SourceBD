// 13 · Sources ladder: the trust hierarchy, top rung first, with the framed marks on tiers 1 to 3. Tier 6 is set quiet:
// it never enters a record on its own (AGENTS.md rules 5 and 6). Since the founder's video of 22 Oct 2026 the rungs
// are larger and fewer words, the marks at 40 px, and the rungs step in one after another as the ladder scrolls in.

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

export function Ladder() {
  return (
    <section aria-labelledby="home-ladder" className={cn(measure, "flex flex-col gap-10 py-16 lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:py-section")}>
      <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:w-[400px] lg:shrink-0">
        <H2 id="home-ladder">
          Receipts, <span className="text-ink-subtle">not opinions.</span>
        </H2>
        <Lede>Government registers come first. A source lower down never overwrites one above it. There is no SourceBD score, grade or star.</Lede>
        <div className="pt-1">
          <TextLink href="/methodology">Read the methodology</TextLink>
        </div>
      </div>
      <Reveal as="ol" className="flex min-w-0 flex-col gap-3 lg:max-w-[720px] lg:flex-1">
        {LADDER.map((r, i) => {
          const quiet = i === LADDER.length - 1;
          return (
            <li
              key={r.tier}
              style={{ transitionDelay: `${i * 90}ms` }}
              className={cn(
                "flex flex-col gap-4 rounded-card p-5 transition-[opacity,transform] duration-reveal ease-reveal motion-reduce:transition-none group-data-[reveal=wait]/reveal:translate-y-4 group-data-[reveal=wait]/reveal:opacity-0 sm:flex-row sm:items-center sm:justify-between md:p-6",
                quiet ? "border border-dashed border-line" : "bg-surface shadow-sm ring-1 ring-ink/5",
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-ink-subtle">{r.tier}</span>
                <span className={cn("text-xl font-medium", quiet ? "text-ink-subtle" : "text-ink-strong")}>{r.name}</span>
                <span className={cn("text-site-body", quiet ? "text-ink-subtle" : "text-ink-muted")}>{r.what}</span>
              </div>
              {r.marks.length ? (
                <span className="flex shrink-0 flex-wrap gap-2">
                  {r.marks.map((m) => (
                    <SourceMark key={m} source={m} className="size-10 border-ink-strong/10 [&>img]:max-h-[28px] [&>img]:max-w-[28px]" />
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
