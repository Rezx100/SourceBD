// 13 · Sources ladder (Paper `Z1V-0` / `Z6R-0`): the trust hierarchy, top rung first, with the framed marks on
// tiers 1 to 3. Tier 6 is set quiet: it never enters a record on its own (AGENTS.md rules 5 and 6).

import { cn } from "@/lib/utils";
import { H2, Lede, Mark, TextLink, measure } from "./ui";

export const LADDER: { tier: string; name: string; what: string; marks: string[] }[] = [
  { tier: "Tier 1", name: "Government and RSC", what: "EPB export register · RMG Sustainability Council", marks: ["EPB", "RSC"] },
  { tier: "Tier 2", name: "Trade bodies", what: "BGMEA · BKMEA · BTMA · BGAPMEA", marks: ["BGMEA", "BKMEA", "BTMA", "BGAPMEA"] },
  { tier: "Tier 3", name: "Certification bodies", what: "GOTS · OEKO-TEX · WRAP", marks: ["GOTS", "OEKO-TEX", "WRAP"] },
  { tier: "Tier 4", name: "Brand supplier lists", what: "Public disclosures from the brands themselves", marks: [] },
  { tier: "Tier 5", name: "Foreign regulators", what: "UFLPA Entity List · US DHS", marks: [] },
  { tier: "Tier 6", name: "Cross-check only", what: "Never enters a record on its own", marks: [] },
];

export function Ladder() {
  return (
    <section aria-labelledby="home-ladder" className={cn(measure, "flex flex-col gap-8 py-14 lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:py-[140px] xl:gap-24")}>
      <div className="flex flex-col gap-5 lg:w-[400px] lg:shrink-0 xl:w-[480px]">
        <H2 id="home-ladder">
          Receipts,
          <br className="max-md:hidden" /> not opinions.
        </H2>
        <Lede>
          Government registers come first. A source lower on the ladder never overwrites one above it, and nothing from the bottom rung enters alone. We show what each source says and when we read it. There is no SourceBD score, grade or star.
        </Lede>
        <div className="pt-2">
          <TextLink href="/methodology">Read the methodology</TextLink>
        </div>
      </div>
      <ol className="flex min-w-0 flex-col border-t border-line lg:max-w-[704px] lg:flex-1">
        {LADDER.map((r, i) => {
          const quiet = i === LADDER.length - 1;
          return (
            <li key={r.tier} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-line-subtle py-4 last:border-b-0 xl:flex-nowrap md:py-[22px]">
              <span className="w-[72px] shrink-0 font-mono text-[13px] leading-4 text-ink-subtle">{r.tier}</span>
              <span className={cn("shrink-0 text-[18px] font-medium leading-[22px] xl:w-[260px]", quiet ? "text-ink-subtle" : "text-ink-strong")}>{r.name}</span>
              <span className={cn("basis-full text-[15px] leading-[18px] xl:basis-auto", quiet ? "text-ink-subtle" : "text-ink-muted")}>{r.what}</span>
              {r.marks.length ? (
                <span className="flex shrink-0 gap-1.5 self-center pt-2 xl:ml-auto xl:pt-0">
                  {r.marks.map((m) => (
                    <Mark key={m} code={m} />
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
