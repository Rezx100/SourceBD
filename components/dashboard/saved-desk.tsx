// The buyer's desk, on Saved (/app/saved): the certificate alerts and the
// recent activity on the suppliers they saved, above the saved list itself.
//
// It was the Home page (handoff v3.2 §3.10) until 28 Sep 2026, when the
// founder made the search the app's first viewport: "this home section
// should be somewhere like Saved — when people click on Saved they get that
// window with the detail". The words and rules are Home's: the counts in
// words, no tiles, no chart, no score; a failed read says so and claims no
// all-clear; an empty section is one caption line, not a panel.
//
// Server component; the page reads `buyer_dashboard` and passes it in. SBI
// and contact PII never reach this file: `buyer_dashboard` excludes both.

import Link from "next/link";
import { certScheme, daysUntil, displayName, formatDay } from "@/lib/dashboard/facts";
import { ExpiryBadge } from "./compliance";
import { PageSection } from "./page";

export type DeskAlert = {
  kind: "cert_expiring";
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  cert_kind: string;
  expires_on: string;
};

export type DeskActivity = {
  kind: "saved" | "cert_added" | "cert_expired" | "rsc_updated";
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  event_at: string;
  detail: string | null;
};

/** What the desk reads from `buyer_dashboard`; the saved rows come from `buyer_saved_list`. */
export type DeskModel = {
  alerts: DeskAlert[];
  recent_activity: DeskActivity[];
};

export function activityLabel(ev: Pick<DeskActivity, "kind" | "detail">): string {
  if (ev.kind === "saved") return "added to your saved list";
  if (ev.kind === "cert_added") return `${certScheme(ev.detail ?? "")} certification recorded`;
  if (ev.kind === "cert_expired") return `${certScheme(ev.detail ?? "")} certification expired`;
  if (ev.kind === "rsc_updated") {
    const p = ev.detail ? Number.parseFloat(ev.detail) : NaN;
    return Number.isFinite(p) ? `RSC remediation now at ${Math.round(p)}%` : "RSC remediation update";
  }
  return "Update";
}

/** The desk's two lists out of `buyer_dashboard`, or null when the read came back malformed. */
export function deskFrom(data: unknown): DeskModel | null {
  if (!data || typeof data !== "object") return null;
  const d = data as { alerts?: unknown; recent_activity?: unknown };
  if (!Array.isArray(d.alerts) || !Array.isArray(d.recent_activity)) return null;
  return { alerts: d.alerts as DeskAlert[], recent_activity: d.recent_activity as DeskActivity[] };
}

function NameLink({ href, name }: { href: string; name: string }) {
  return (
    <Link prefetch={false} scroll={false} href={href} className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:underline">
      {displayName(name)}
    </Link>
  );
}

export function SavedDesk({
  doc,
  failed,
  openHref,
  today = new Date(),
}: {
  /** Null when the desk could not be read. */
  doc: DeskModel | null;
  failed: boolean;
  /** Where a supplier's name leads: its record, opened beside the saved list. */
  openHref: (slug: string) => string;
  /** The day the alerts count down from (tests pin it). */
  today?: Date;
}) {
  if (failed || !doc) {
    // "No certificates expiring" over an unread desk was a false all-clear.
    return <p className="m-0 text-sm text-ink-muted">Certificate alerts and recent activity could not be read just now.</p>;
  }
  const compliance = (
    <Link prefetch={false} href="/app/compliance" className="link">
      Compliance hub
    </Link>
  );
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      {doc.alerts.length === 0 ? (
        <PageSection title="Alerts" caption="No certificates on your saved suppliers expire in the next 30 days" action={compliance} bare>
          {null}
        </PageSection>
      ) : (
        <PageSection title="Alerts" caption="Certificates expiring in the next 30 days" action={compliance}>
          <ul className="m-0 list-none p-0">
            {doc.alerts.map((a) => {
              const days = daysUntil(a.expires_on, today);
              return (
                <li
                  key={`${a.supplier_id}-${a.cert_kind}-${a.expires_on}`}
                  className="flex min-h-11 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line-subtle px-4 py-2.5 text-base last:border-b-0"
                >
                  <NameLink href={openHref(a.supplier_slug)} name={a.company_name} />
                  <span className="text-ink-muted">
                    {certScheme(a.cert_kind)} expires {formatDay(a.expires_on) ?? a.expires_on}
                  </span>
                  {days === null ? null : <ExpiryBadge days={days} />}
                </li>
              );
            })}
          </ul>
        </PageSection>
      )}

      {doc.recent_activity.length === 0 ? (
        <PageSection title="Recent activity" caption="New certificates, expiries and RSC updates on your saved suppliers show up here" bare>
          {null}
        </PageSection>
      ) : (
        <PageSection title="Recent activity">
          <ul className="m-0 list-none p-0">
            {doc.recent_activity.map((ev, i) => (
              <li
                key={`${ev.supplier_id}-${ev.kind}-${ev.event_at}-${i}`}
                className="flex min-h-11 flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-line-subtle px-4 py-2.5 text-base last:border-b-0"
              >
                <time dateTime={ev.event_at} className="w-24 shrink-0 text-sm tabular-nums text-ink-subtle">
                  {formatDay(ev.event_at) ?? ""}
                </time>
                <span className="min-w-0 flex-1">
                  <NameLink href={openHref(ev.supplier_slug)} name={ev.company_name} />
                  <span className="text-ink-muted"> · {activityLabel(ev)}</span>
                </span>
              </li>
            ))}
          </ul>
        </PageSection>
      )}
    </div>
  );
}
