// 8 · Inside one record (Paper `1G1H-0` / `1G2R-0`): Aboni Knitwear's record at its Certificates section, as shipped
// and read on 10 Oct 2026 (the screen is dated), with three callouts read live from the same record: a lapsed
// certificate, the valid GOTS certificate, the WRAP certificate, each with its source and read date. A callout the
// record no longer holds is not drawn. At 1024 and up the callouts sit beside the screen with leader lines to the
// rows they name (the board's geometry, as fractions of the 1280×830 stage); below, they are a list under it.

import type { HomeFact } from "@/lib/home-records";
import { cn } from "@/lib/utils";
import { H2, Lede, Screen, Still, measure } from "./ui";

/** The board's callouts: card at (x, y), its leader to the row at (px, py). Stage units, 1280×830. */
const AT = [
  { x: 880, y: 190, px: 681, py: 261 },
  { x: 880, y: 290, px: 704, py: 308 },
  { x: 880, y: 390, px: 702, py: 356 },
];
const W = 1280;
const H = 830;
const pc = (n: number, of: number) => `${(n / of) * 100}%`;

const TABS = ["Overview", "Certificates", "Safety", "Sites", "Sources", "Products"];

function Callout({ fact, at }: { fact: HomeFact; at: (typeof AT)[number] }) {
  const jx = at.x - 40;
  const cy = at.y + 20;
  const line = "absolute bg-ink-strong";
  return (
    <li className="contents">
      <span aria-hidden className={line} style={{ left: pc(at.px, W), top: pc(at.py, H), width: pc(jx - at.px, W), height: 1 }} />
      <span aria-hidden className={line} style={{ left: pc(jx, W), top: pc(Math.min(at.py, cy), H), width: 1, height: pc(Math.abs(at.py - cy), H) }} />
      <span aria-hidden className={line} style={{ left: pc(jx, W), top: pc(cy, H), width: pc(40, W), height: 1 }} />
      <span aria-hidden className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand" style={{ left: pc(at.px, W), top: pc(at.py, H) }} />
      <span className="absolute flex w-[25%] flex-col gap-[3px] rounded-lg border border-line bg-surface px-3 py-2.5 shadow-md" style={{ left: pc(at.x, W), top: pc(at.y, H) }}>
        <Fact fact={fact} />
      </span>
    </li>
  );
}

function Fact({ fact }: { fact: HomeFact }) {
  return (
    <>
      <span className={cn("text-[14px] font-medium leading-[18px]", fact.tone === "caution" ? "text-caution" : "text-ink-strong")}>{fact.title}</span>
      <span className="text-[12px] leading-4 text-ink-subtle">{fact.sub}</span>
    </>
  );
}

export function InsideRecord({ callouts }: { callouts: HomeFact[] }) {
  const shown = callouts.slice(0, AT.length);
  return (
    <section aria-labelledby="home-inside" className="bg-brand-wash py-14 md:py-[120px]">
      <div className={cn(measure, "flex flex-col items-center gap-8 md:gap-14")}>
        <div className="flex flex-col items-center gap-4 text-center">
          <H2 id="home-inside">Inside one record.</H2>
          <Lede className="max-w-[720px]">Aboni Knitwear Ltd, as production holds it on 10 Oct 2026. Each fact names its source and the day we read it; one legend counts what is still waiting for its link.</Lede>
        </div>
        <div aria-hidden className="flex w-full gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <span key={t} className={cn("flex shrink-0 flex-col gap-2.5 px-3.5 pt-2 text-[15px] font-medium leading-[18px]", t === "Certificates" ? "text-ink-strong" : "text-ink-muted")}>
              {t}
              <span className={cn("h-0.5 rounded-sm", t === "Certificates" ? "bg-ink-strong" : "bg-transparent")} />
            </span>
          ))}
        </div>
        <div className="relative isolate w-full overflow-hidden rounded-pane-phone px-4 py-6 md:rounded-[24px] lg:aspect-[1280/830] lg:p-0">
          <Still name="paper-seal" />
          <div className="relative mx-auto max-w-[318px] md:max-w-none lg:absolute lg:left-[3.125%] lg:right-[3.125%] lg:top-[4.82%]">
            <Screen name="full-certs2" alt="Aboni Knitwear Ltd's record at its Certificates section: one GOTS certificate expired 4 Apr 2026, shown amber; GOTS and WRAP certificates valid" sizes="(min-width: 1440px) 1200px, 90vw" />
          </div>
          {shown.length ? (
            <ul aria-label="What the record shows" className="max-lg:hidden">
              {shown.map((f, i) => (
                <Callout key={f.title} fact={f} at={AT[i]!} />
              ))}
            </ul>
          ) : null}
        </div>
        {shown.length ? (
          <ul aria-label="What the record shows" className="w-full border-t border-line lg:hidden">
            {shown.map((f) => (
              <li key={f.title} className="flex gap-2.5 border-b border-line-subtle py-3">
                <span aria-hidden className="mt-1.5 size-[7px] shrink-0 rounded-full bg-brand" />
                <span className="flex flex-col gap-0.5">
                  <Fact fact={f} />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
