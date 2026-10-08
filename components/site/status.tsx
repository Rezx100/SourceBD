// System status (B9f; Paper `30 Marketing · Status`): when each thing last ran, built live on each visit from the
// `public_status()` read. The figures are the read's own: nothing here is typed in, a missing date says "No date on
// file", and how old a date is said in words (not only by a colour). No score, no uptime percentage.

import Link from "next/link";
import { Display, Label, Lede, wrap } from "@/components/site/parts";
import { readDay, withCommas } from "@/lib/site-facts";
import { cn } from "@/lib/utils";

export type StatusDoc = {
  published_suppliers: number;
  last_source_refresh: string | null;
  last_compliance_mirror: string | null;
  last_sanctions_screen: string | null;
  last_etl_success: string | null;
  etl_recent: Array<{ scraper_code: string; finished_at: string | null; status: string }>;
  generated_at: string;
};

const DAY = 864e5;

/** How old a date is, in words a reader can act on. */
export function age(ts: string | null, now: number): string | null {
  const t = ts ? Date.parse(ts) : NaN;
  if (Number.isNaN(t)) return null;
  const days = (now - t) / DAY;
  return days > 90 ? "over 90 days ago" : days > 30 ? "over 30 days ago" : days > 7 ? "over 7 days ago" : null;
}

const ROWS: { label: string; key: keyof Pick<StatusDoc, "last_source_refresh" | "last_compliance_mirror" | "last_sanctions_screen" | "last_etl_success"> }[] = [
  { label: "Source registers read", key: "last_source_refresh" },
  { label: "Compliance documents copied", key: "last_compliance_mirror" },
  { label: "Supplier names screened against the sanctions and forced-labour lists", key: "last_sanctions_screen" },
  { label: "Last successful pipeline run", key: "last_etl_success" },
];

function When({ ts, now }: { ts: string | null; now: number }) {
  const day = readDay(ts);
  if (!day) return <span className="text-ink-3">No date on file</span>;
  const old = age(ts, now);
  return (
    <>
      {day}
      {old ? <span className="font-medium text-ink"> · {old}</span> : null}
    </>
  );
}

export function StatusView({ doc, error, now = Date.now() }: { doc: StatusDoc | null; error: string | null; now?: number }) {
  return (
    <main className="font-sans text-ink">
      <section className="py-20 max-md:py-10">
        <div className={cn(wrap, "flex flex-col gap-10")}>
          <div className="flex flex-col gap-4">
            <Label>Status</Label>
            <Display level={2} as="h1">
              System status
            </Display>
            <Lede>When we last read each source. Built live on each visit{doc ? `, as of ${readDay(doc.generated_at)}` : ""}. Per-source dates are on the <Link href="/methodology" prefetch={false} className="font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">Data and methodology</Link> page.</Lede>
          </div>

          {error || !doc ? (
            <div role="alert" className="max-w-[720px] rounded-lg border border-line bg-subtle p-5">
              <p className="text-md font-semibold text-ink">We could not load the status just now.</p>
              <p className="mt-1 text-md text-ink-2">
                If this keeps happening, write to{" "}
                <a href="mailto:support@sourcebd.net" className="font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font]">
                  support@sourcebd.net
                </a>
                .
              </p>
            </div>
          ) : (
            <>
              <dl className="grid gap-8 sm:grid-cols-2">
                <div className="flex flex-col gap-1 border-t border-ink pt-3">
                  <dd className="font-mono text-3xl font-semibold tracking-tight text-ink">{withCommas(doc.published_suppliers)}</dd>
                  <dt className="text-md text-ink-2">published suppliers</dt>
                </div>
                <div className="flex flex-col gap-1 border-t border-ink pt-3">
                  <dd className="font-mono text-3xl font-semibold tracking-tight text-ink">{readDay(doc.last_source_refresh) ?? "No date on file"}</dd>
                  <dt className="text-md text-ink-2">latest register read</dt>
                </div>
              </dl>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left">
                  <caption className="sr-only">What runs and when it last ran</caption>
                  <thead>
                    <tr className="border-b border-ink text-sm text-ink-3">
                      <th scope="col" className="py-2 pr-4 font-medium">What runs</th>
                      <th scope="col" className="py-2 font-medium">Last run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ROWS.map((r) => (
                      <tr key={r.key} className="align-top text-md">
                        <th scope="row" className="py-3 pr-4 font-normal text-ink">{r.label}</th>
                        <td className="py-3 text-ink-2">
                          <When ts={doc[r.key]} now={now} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {doc.etl_recent.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-ink">Recent pipeline runs</h2>
                  <p className="text-md text-ink-2">The latest finished run for each job.</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] border-collapse text-left">
                      <caption className="sr-only">The latest finished run of each job</caption>
                      <thead>
                        <tr className="border-b border-ink text-sm text-ink-3">
                          <th scope="col" className="py-2 pr-4 font-medium">Job</th>
                          <th scope="col" className="py-2 pr-4 font-medium">Result</th>
                          <th scope="col" className="py-2 font-medium">Finished</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {doc.etl_recent.map((row) => (
                          <tr key={row.scraper_code} className="align-top text-md">
                            <th scope="row" className="py-3 pr-4 font-mono text-base font-normal text-ink">{row.scraper_code}</th>
                            <td className="py-3 pr-4 text-ink-2">{row.status}</td>
                            <td className="py-3 text-ink-2">
                              <When ts={row.finished_at} now={now} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
