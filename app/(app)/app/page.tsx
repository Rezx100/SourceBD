// Buyer dashboard — Spec B5 (/app), FE-SITEWIDE Phase C1.
//
// Calls `public.buyer_dashboard()` (migration 0026) under the caller's
// session and renders three surfaces per `context/frontend-design-spec.md`
// §7: five stat tiles using `.metric-grid`/`.metric`, the top recently-saved
// suppliers via the shared `DiscoverResultCard`, and a unified recent-activity
// feed using `.prov-list`/`.prov-row`.
//
// SBI hard contract: the RPC excludes SBI from its payload entirely; this
// file never references `sbi_*` keys. PII hard contract: the RPC excludes
// contact fields; same here.

import Link from "next/link";
import {
  ArrowRight,
  Certificate,
  Clock,
  ShieldCheck,
  Star,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { DiscoverResultCard, type DiscoverRow } from "@/components/discover/result-card";
import { SaveButton } from "@/components/save-button";
import { EmptyState, PageHeader, Section } from "@/components/ui/page-kit";
import { NumberTicker } from "@/components/ui/number-ticker";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SavedCard = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
  source_tags: string[] | null;
  completeness_pct: number;
  t13_source_count: number;
  saved_at: string;
};

type Alert = {
  kind: "cert_expiring";
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  cert_kind: string;
  expires_on: string;
};

type ActivityKind = "saved" | "cert_added" | "cert_expired" | "rsc_updated";

type ActivityEvent = {
  kind: ActivityKind;
  supplier_id: string;
  supplier_slug: string;
  company_name: string;
  event_at: string;
  detail: string | null;
};

type DashboardDoc = {
  saved_count: number;
  recent_saved: SavedCard[];
  alerts: Alert[];
  recent_activity: ActivityEvent[];
};

const EMPTY: DashboardDoc = {
  saved_count: 0,
  recent_saved: [],
  alerts: [],
  recent_activity: [],
};

export default async function BuyerHome() {
  const supabase = await createSupabaseServerClient();
  const [{ data, error }, { count: openRfqCount }, { count: activeOrderCount }] =
    await Promise.all([
      supabase.rpc("buyer_dashboard"),
      supabase
        .from("rfqs")
        .select("id", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "in_production", "shipped", "in_transit"]),
    ]);
  const doc: DashboardDoc = error || data == null ? EMPTY : (data as DashboardDoc);
  const activeRfqs = openRfqCount ?? 0;
  const activeOrders = activeOrderCount ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <PageHeader kicker="Buyer" title="Dashboard" description="Your sourcing activity at a glance." />

      {error ? (
        <div className="rounded-card border border-sem-red/30 bg-sem-red-soft p-4 text-sm text-sem-red">
          Could not load dashboard.
        </div>
      ) : null}

      <section
        aria-label="Quick stats"
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        <StatTile
          label="Saved suppliers"
          value={doc.saved_count}
          meta={
            doc.saved_count === 0
              ? "Start by saving suppliers from Discover."
              : "Your shortlist for outreach"
          }
          href="/app/saved"
        />
        <StatTile
          label="Active RFQs"
          value={activeRfqs}
          meta={
            activeRfqs === 0
              ? "Compose your first RFQ from a supplier profile."
              : "Awaiting quotes"
          }
          href="/app/rfqs"
        />
        <StatTile
          label="Active orders"
          value={activeOrders}
          meta={
            activeOrders === 0
              ? "Accept an RFQ quote to seed an order."
              : "In production / shipping"
          }
          href="/app/orders"
        />
        <StatTile
          label="Compliance alerts"
          value={doc.alerts.length}
          meta={
            doc.alerts.length === 0
              ? "All certifications current"
              : "Certs expiring within 30 days"
          }
          href="/app/compliance"
        />
        <StatTile
          label="Unread messages"
          value={0}
          meta="Open Messages from the sidebar"
          href="/app/messages"
        />
      </section>

      {doc.alerts.length > 0 ? (
        <Section
          title="Alerts"
          description="Certifications expiring in the next 30 days"
        >
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {doc.alerts.map((a) => (
              <li
                key={`${a.supplier_id}-${a.cert_kind}-${a.expires_on}`}
                className="flex items-center justify-between gap-3 rounded-card border border-sem-amber/30 bg-sem-amber-soft px-3 py-2.5 text-[13px]"
              >
                <span className="flex items-center gap-2 text-sem-amber">
                  <WarningCircle size={16} weight="fill" aria-hidden />
                  <Link
                    href={`/app/suppliers/${a.supplier_slug}`}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {a.company_name}
                  </Link>
                  <span className="text-ink-secondary">
                    · {prettyCert(a.cert_kind)} expires {fmtDate(a.expires_on)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        title="Saved suppliers"
        actions={
          doc.saved_count > 0 ? (
            <Link
              href="/app/saved"
              className="inline-flex items-center gap-1 text-sm font-semibold text-brand-forest hover:text-brand-forest-mid"
            >
              View all <ArrowRight size={13} weight="bold" />
            </Link>
          ) : null
        }
      >
        {doc.recent_saved.length === 0 ? (
          <EmptyState
            title="No saved suppliers yet"
            description="Save suppliers from Discover to build your shortlist."
            action={
              <Link href="/app/discover" className="btn-proto primary">
                Browse Discover
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {doc.recent_saved.map((c) => (
              <li key={c.id}>
                <DiscoverResultCard
                  row={savedToDiscoverRow(c)}
                  hrefBase="/app/suppliers"
                  actionSlot={
                    <SaveButton supplierId={c.id} initialSaved={true} shape="icon" />
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent activity">
        {doc.recent_activity.length === 0 ? (
          <div className="rounded-card border border-hairline bg-surface-l1 p-6 text-center text-sm text-ink-secondary">
            Activity on your saved suppliers will show up here.
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-hairline overflow-hidden rounded-card border border-hairline bg-surface-l1 p-0">
            {doc.recent_activity.map((ev, i) => (
              <li
                key={`${ev.supplier_id}-${ev.kind}-${ev.event_at}-${i}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <ActivityIcon kind={ev.kind} />
                <div className="min-w-0 flex-1 truncate text-[13px]">
                  <Link
                    href={`/app/suppliers/${ev.supplier_slug}`}
                    className="font-semibold text-ink-primary hover:underline"
                  >
                    {ev.company_name}
                  </Link>
                  <span className="text-ink-secondary"> · {activityLabel(ev)}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-ink-tertiary">
                  {fmtRelative(ev.event_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ---------- helpers --------------------------------------------------------

function StatTile({
  label,
  value,
  meta,
  href,
}: {
  label: string;
  value: number;
  meta: string;
  href?: string;
}) {
  const body = (
    <div className="group flex h-full flex-col rounded-card border border-hairline bg-surface-l1 p-5 shadow-[0_1px_2px_rgba(15,15,20,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-forest/30 hover:shadow-l2">
      <p className="text-[12px] font-medium text-ink-tertiary">{label}</p>
      <NumberTicker
        value={value}
        className="mt-2 font-display text-[28px] font-extrabold leading-none tracking-[-0.02em] text-ink-primary"
      />
      <p className="mt-2 text-[11px] leading-snug text-ink-tertiary">{meta}</p>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-card transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
      >
        {body}
      </Link>
    );
  }
  return body;
}

function savedToDiscoverRow(c: SavedCard): DiscoverRow {
  return {
    id: c.id,
    slug: c.slug,
    company_name: c.company_name,
    entity_type: c.entity_type,
    city: c.city,
    district: c.district,
    source_tags: c.source_tags ?? [],
    t13_source_count: c.t13_source_count,
    employees_total: null,
    established_date: null,
    principal_products: [],
    factory_types: [],
    rsc_progress_pct: null,
    parent_group_name: null,
    total_count: 0,
  };
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const sz = 16;
  if (kind === "saved")
    return <Star size={sz} weight="fill" className="text-sem-amber" aria-hidden />;
  if (kind === "cert_added")
    return <Certificate size={sz} weight="fill" className="text-sem-green" aria-hidden />;
  if (kind === "cert_expired")
    return <Clock size={sz} weight="fill" className="text-sem-red" aria-hidden />;
  return <ShieldCheck size={sz} weight="fill" className="text-brand-forest" aria-hidden />;
}

function activityLabel(ev: ActivityEvent): string {
  if (ev.kind === "saved") return "added to your saved list";
  if (ev.kind === "cert_added") return `${prettyCert(ev.detail ?? "")} certification recorded`;
  if (ev.kind === "cert_expired")
    return `${prettyCert(ev.detail ?? "")} certification expired`;
  if (ev.kind === "rsc_updated") {
    const p = ev.detail ? Number.parseFloat(ev.detail) : NaN;
    return Number.isFinite(p)
      ? `RSC remediation now at ${Math.round(p)}%`
      : "RSC remediation update";
  }
  return "Update";
}

function prettyCert(k: string): string {
  switch (k) {
    case "wrap":
      return "WRAP";
    case "oeko_tex":
      return "OEKO-TEX";
    case "gots":
      return "GOTS";
    case "sa8000":
      return "SA8000";
    default:
      return k.toUpperCase();
  }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return "";
  const diff = Date.now() - d;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}
