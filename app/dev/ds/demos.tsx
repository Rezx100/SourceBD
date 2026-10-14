// /dev/ds: the marketing demos (M2, handoff-mercury-m2-m3.md) as the home page's tour and the vignette grid will
// draw them, each at the width it gets there (the tour's right column is 720 at 1440), on paper and on the night
// ground, so a demo can be watched before any page carries it.

import { DemoClaim, DemoCompliance, DemoRecord, DemoRfq, DemoSearch, VIGNETTES } from "@/components/site/demos";
import { READ_AT, SNAPSHOT } from "@/lib/marketing/demo-snapshot";

const TOUR = [
  { title: "Find", Demo: DemoSearch },
  { title: "Check", Demo: DemoRecord },
  { title: "Ask", Demo: DemoRfq },
  { title: "Watch", Demo: DemoCompliance },
  { title: "Claim (suppliers)", Demo: DemoClaim },
] as const;

export function Demos() {
  return (
    <div className="flex flex-col gap-10">
      <p className="max-w-prose text-sm text-ink-3">
        Snapshot read {READ_AT}: {SNAPSHOT.search.rows.length} search rows, {SNAPSHOT.saved.length} saved records, {SNAPSHOT.check.certs.length} certificates on the record. Re-read with <code className="font-mono">node ops/marketing_demo_snapshot.mjs</code> (URL and anon key in the environment).
      </p>
      {TOUR.map((t) => (
        <section key={t.title} className="flex flex-col gap-3" data-demo={t.title}>
          <h3 className="text-lg font-semibold text-ink">{t.title}</h3>
          <div className="max-w-[720px]">
            <t.Demo />
          </div>
        </section>
      ))}
      <section className="flex flex-col gap-3" data-demo="vignettes">
        <h3 className="text-lg font-semibold text-ink">Vignettes</h3>
        <div className="grid max-w-[720px] grid-cols-1 gap-4 sm:grid-cols-2">
          {VIGNETTES.map((v) => (
            <div key={v.key} className="flex flex-col gap-2">
              <v.Demo />
              <p className="text-sm font-medium text-ink">{v.title}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3 rounded-lg bg-surface p-6 text-ink" data-ground="night" data-demo="night">
        <h3 className="text-lg font-semibold">On the night ground</h3>
        <div className="max-w-[720px]">
          <DemoRecord />
        </div>
      </section>
    </div>
  );
}
