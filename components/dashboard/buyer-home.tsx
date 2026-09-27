// The buyer's Home (/app), in the dashboard kit (handoff v3.2 §3.10): a title
// with the counts in words, then Alerts, Saved suppliers and Recent activity.
// No stat tiles, no chart, no score. Server component; the page fetches
// `buyer_dashboard` and the two counts and passes them in.
//
// A fresh account meets ONE empty state for the page — the desk is empty,
// search — and each section is a single caption line until it has rows;
// three illustrated empty sections on one page claimed a viewport each.
//
// SBI and contact PII never reach this file: `buyer_dashboard` excludes both.

import Link from "next/link";
import { certScheme, daysUntil, displayName, entityLabel, formatCount, formatDay, initials, placeLabel } from "@/lib/dashboard/facts";
import { topTier } from "@/lib/dashboard/source-tiers";
import { ExpiryBadge } from "./compliance";
import { Button } from "./controls";
import { LogoTile } from "./marks";
import { Cell, DataTable, EmptyState, ErrorNote, HeadCell, PageHeader, PageSection, rowClass } from "./page";
import { SaveRecordButton } from "./save-record-button";
import { SourcesCell } from "./saved-list";
import { Caption } from "./type";

export type HomeSaved = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[] | null;
  saved_at: string;
};

export type HomeAlert = {
  kind: "cert_expiring";
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  cert_kind: string;
  expires_on: string;
};

export type HomeActivity = {
  kind: "saved" | "cert_added" | "cert_expired" | "rsc_updated";
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  event_at: string;
  detail: string | null;
};

export type HomeModel = {
  saved_count: number;
  recent_saved: HomeSaved[];
  alerts: HomeAlert[];
  recent_activity: HomeActivity[];
};

const recordHref = (slug: string) => `/app/suppliers/${slug}`;

function plural(n: number, one: string, many: string): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** "12 saved · 3 open RFQs · 1 active order" — the counts in words, not tiles. */
export function homeCaption(saved: number, openRfqs: number, activeOrders: number): string {
  return [
    `${formatCount(saved)} saved`,
    plural(openRfqs, "open RFQ", "open RFQs"),
    plural(activeOrders, "active order", "active orders"),
  ].join(" · ");
}

export function activityLabel(ev: Pick<HomeActivity, "kind" | "detail">): string {
  if (ev.kind === "saved") return "added to your saved list";
  if (ev.kind === "cert_added") return `${certScheme(ev.detail ?? "")} certification recorded`;
  if (ev.kind === "cert_expired") return `${certScheme(ev.detail ?? "")} certification expired`;
  if (ev.kind === "rsc_updated") {
    const p = ev.detail ? Number.parseFloat(ev.detail) : NaN;
    return Number.isFinite(p) ? `RSC remediation now at ${Math.round(p)}%` : "RSC remediation update";
  }
  return "Update";
}

/** Nothing on the desk yet: no saved supplier, no alert, no activity. */
export function isFreshDesk(doc: HomeModel): boolean {
  return doc.saved_count === 0 && doc.recent_saved.length === 0 && doc.alerts.length === 0 && doc.recent_activity.length === 0;
}

export const HOME_EMPTY_TITLE = "Your desk is empty";
export const HOME_EMPTY_COPY = "Search suppliers. The ones you save bring their certificate alerts and updates here.";

function NameLink({ slug, name }: { slug: string; name: string }) {
  return (
    <Link prefetch={false} href={recordHref(slug)} className="font-medium text-ink-strong [overflow-wrap:anywhere] hover:text-brand-ink">
      {displayName(name)}
    </Link>
  );
}

/** A section with no rows: its title and one caption line, no panel. */
function QuietSection({ title, caption, action }: { title: string; caption: string; action?: React.ReactNode }) {
  return (
    <PageSection title={title} caption={caption} action={action} bare>
      {null}
    </PageSection>
  );
}

export function BuyerHome({
  doc,
  failed,
  openRfqs,
  activeOrders,
  today = new Date(),
}: {
  doc: HomeModel;
  failed: boolean;
  openRfqs: number;
  activeOrders: number;
  /** The day the alerts count down from (tests pin it). */
  today?: Date;
}) {
  const fresh = !failed && isFreshDesk(doc);
  const compliance = (
    <Link prefetch={false} href="/app/compliance" className="text-brand-ink hover:underline">
      Compliance hub
    </Link>
  );
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <PageHeader
        title="Home"
        caption={failed ? "Your counts could not be read just now" : homeCaption(doc.saved_count, openRfqs, activeOrders)}
        actions={
          // The empty desk carries the page's one primary; the header does not repeat it.
          fresh ? undefined : (
            <Button variant="primary" href="/app/discover" clientNav>
              Search suppliers
            </Button>
          )
        }
      />

      {/* A failed read says so and claims nothing else: "No certificates
          expiring" and "0 saved" over an unread dashboard were a false
          all-clear. */}
      {failed ? (
        <ErrorNote>Could not load your home page. Nothing you saved is lost; reload the page to try again.</ErrorNote>
      ) : (
        <>
          {fresh ? (
            <div className="rounded-md bg-surface">
              <EmptyState
                art="saved"
                title={HOME_EMPTY_TITLE}
                action={
                  <Button variant="primary" href="/app/discover" clientNav>
                    Search suppliers
                  </Button>
                }
              >
                {HOME_EMPTY_COPY}
              </EmptyState>
            </div>
          ) : null}

          {doc.alerts.length === 0 ? (
            <QuietSection title="Alerts" caption="No certificates on your saved suppliers expire in the next 30 days" action={compliance} />
          ) : (
            <PageSection title="Alerts" caption="Certificates on your saved suppliers that expire in the next 30 days" action={compliance}>
              <ul className="m-0 list-none p-0">
                {doc.alerts.map((a) => {
                  const days = daysUntil(a.expires_on, today);
                  return (
                    <li
                      key={`${a.supplier_id}-${a.cert_kind}-${a.expires_on}`}
                      className="flex min-h-11 flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line-subtle px-4 py-2.5 text-base last:border-b-0"
                    >
                      <NameLink slug={a.supplier_slug} name={a.company_name} />
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

          {doc.recent_saved.length === 0 ? (
            <QuietSection title="Saved suppliers" caption="None yet. Save a supplier from search or from its record." />
          ) : (
            <PageSection
              title="Saved suppliers"
              caption={`${formatCount(doc.saved_count)} saved`}
              action={
                <Link prefetch={false} href="/app/saved" className="text-brand-ink hover:underline">
                  View all
                </Link>
              }
            >
              <DataTable label="Recently saved suppliers" minWidth="36rem">
                <thead>
                  <tr>
                    <HeadCell>Supplier</HeadCell>
                    <HeadCell>Sources</HeadCell>
                    <HeadCell>Saved on</HeadCell>
                    <HeadCell>
                      <span className="sr-only">Actions</span>
                    </HeadCell>
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>*]:border-b-0">
                  {doc.recent_saved.map((c) => {
                    const tags = c.source_tags ?? [];
                    const name = displayName(c.company_name);
                    const place = placeLabel(c.city, c.district);
                    return (
                      <tr key={c.id} className={rowClass()}>
                        <th scope="row" className="h-11 border-b border-line-subtle px-4 py-2 text-left align-middle font-normal">
                          <div className="flex items-center gap-2.5">
                            <LogoTile initials={initials(name)} tier={topTier(tags)} size="sm" />
                            <div className="min-w-0">
                              <NameLink slug={c.slug} name={c.company_name} />
                              <Caption className="block">{[entityLabel(c.entity_type), place].filter(Boolean).join(" · ")}</Caption>
                            </div>
                          </div>
                        </th>
                        <Cell>
                          <SourcesCell tags={tags} />
                        </Cell>
                        <Cell className="whitespace-nowrap tabular-nums text-ink-muted">{formatDay(c.saved_at) ?? "—"}</Cell>
                        <Cell className="text-right">
                          {/* Unsave stays one click away, as it was on the old Home. */}
                          <span className="inline-flex items-center gap-1.5">
                            <SaveRecordButton supplierId={c.id} saved icon />
                            <Button href={recordHref(c.slug)} clientNav size="sm" aria-label={`Open ${name}`}>
                              Open
                            </Button>
                          </span>
                        </Cell>
                      </tr>
                    );
                  })}
                </tbody>
              </DataTable>
            </PageSection>
          )}

          {doc.recent_activity.length === 0 ? (
            <QuietSection title="Recent activity" caption="New certificates, expiries and RSC updates on your saved suppliers show up here" />
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
                      <NameLink slug={ev.supplier_slug} name={ev.company_name} />
                      <span className="text-ink-muted"> · {activityLabel(ev)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </PageSection>
          )}
        </>
      )}
    </div>
  );
}
