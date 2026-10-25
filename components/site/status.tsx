// System status (B9f; Paper `30 Marketing · Status`): when each thing last ran, built live on each visit from the
// `public_status()` read. The figures are the read's own: nothing here is typed in, a missing date says "No date on
// file", and how old a date is said in words (not only by a colour). No score, no uptime percentage.

import Link from "next/link";
import { HomeMain } from "@/components/site/home-main";
import { Band, FactCards, PageHead, tabular } from "@/components/site/sections/inner";
import { inkLink } from "@/components/site/sections/ui";
import { readDay, withCommas } from "@/lib/site-facts";

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
      {old ? <span className="font-display text-ink"> · {old}</span> : null}
    </>
  );
}

export function StatusView({ doc, error, now = Date.now() }: { doc: StatusDoc | null; error: string | null; now?: number }) {
  return (
    <HomeMain className="font-sans antialiased">
      <PageHead
        tone="day"
        label="Status"
        title="System status"
        lede={
          <>
            When we last read each source. Built live on each visit{doc ? `, as of ${readDay(doc.generated_at)}` : ""}. Per-source dates are on the{" "}
            <Link href="/methodology" prefetch={false} className={inkLink}>
              Data and methodology
            </Link>{" "}
            page.
          </>
        }
      />

      {error || !doc ? (
        <Band id="status-down" tone="day" heading="We could not load the status just now.">
          <p role="alert" className="font-book text-site-card text-ink-2">
            If this keeps happening, write to{" "}
            <a href="mailto:support@sourcebd.net" className={inkLink}>
              support@sourcebd.net
            </a>
            .
          </p>
        </Band>
      ) : (
        <>
          <FactCards
            id="status-figures"
            tone="day"
            heading="Where the record stands"
            items={[
              { figure: withCommas(doc.published_suppliers), title: "published suppliers", body: null },
              { figure: readDay(doc.last_source_refresh) ?? "No date on file", title: "latest register read", body: null },
            ]}
            cols={2}
          />

          <Band id="status-runs" tone="day" heading="What runs, and when it last ran">
            <div className={tabular}>
              <table>
                <caption className="sr-only">What runs and when it last ran</caption>
                <thead>
                  <tr>
                    <th scope="col">What runs</th>
                    <th scope="col">Last run</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r.key}>
                      <th scope="row">{r.label}</th>
                      <td>
                        <When ts={doc[r.key]} now={now} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Band>

          {doc.etl_recent.length > 0 ? (
            <Band id="status-recent" tone="day" heading="Recent pipeline runs" lede="The latest finished run for each job." className="md:pb-24">
              <div className={tabular}>
                <table>
                  <caption className="sr-only">The latest finished run of each job</caption>
                  <thead>
                    <tr>
                      <th scope="col">Job</th>
                      <th scope="col">Result</th>
                      <th scope="col">Finished</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.etl_recent.map((row) => (
                      <tr key={row.scraper_code}>
                        <th scope="row" className="font-mono">{row.scraper_code}</th>
                        <td>{row.status}</td>
                        <td>
                          <When ts={row.finished_at} now={now} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Band>
          ) : null}
        </>
      )}
    </HomeMain>
  );
}
