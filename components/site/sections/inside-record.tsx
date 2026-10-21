// 8 · Inside one record (Paper `1G1H-0` / `1G2R-0`): Aboni Knitwear's record opened beside the search at its
// Certificates section, played on the snapshot's real record (critique 22 Oct: the whole 3 Oct app window is gone, and
// the pane is drawn at the size it is read), with three facts read live from the same record beside it: a lapsed
// certificate, the valid GOTS certificate, the WRAP certificate, each with its source and read date. A fact the record
// no longer holds is not drawn; the others keep their order.

import { DemoRecord } from "@/components/site/demos";
import type { HomeFact } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { H2, Lede, measure } from "./ui";

function Fact({ fact }: { fact: HomeFact }) {
  return (
    <>
      <span className={cn("text-base font-medium", fact.tone === "caution" ? "text-caution" : "text-ink-strong")}>{fact.title}</span>
      <span className="text-xs text-ink-subtle">{fact.sub}</span>
    </>
  );
}

/** `callouts` in `CALLOUTS` order, null where the record no longer holds that fact. */
export function InsideRecord({ callouts }: { callouts: (HomeFact | null)[] }) {
  const shown = callouts.filter((c): c is HomeFact => c !== null);
  return (
    <section aria-labelledby="home-inside" className="bg-surface py-14 md:py-section">
      <div className={cn(measure, "flex flex-col items-center gap-8 md:gap-14")}>
        <div className="flex flex-col items-center gap-4 text-center">
          <H2 id="home-inside">Inside one record.</H2>
          <Lede className="max-w-[720px]">Aboni Knitwear Ltd, opened beside the search at its certificates. Each fact names its source and the day we read it.</Lede>
        </div>
        {/* The record at the width it is read, the facts in a row under it. */}
        <div className="flex w-full flex-col gap-8">
          <DemoRecord stage="weave" />
          {shown.length ? (
            <div className="flex flex-col gap-3">
              <p className="text-site-body font-medium text-ink-subtle">What the record shows today</p>
              <ul aria-label="What the record shows" className="grid w-full border-t border-line md:grid-cols-3 md:gap-x-8">
                {shown.map((f) => (
                  <li key={f.title} className="flex gap-2.5 border-b border-line-subtle py-3">
                    <span aria-hidden className="mt-1.5 size-[7px] shrink-0 rounded-full bg-ink-strong" />
                    <span className="flex flex-col gap-0.5">
                      <Fact fact={f} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
