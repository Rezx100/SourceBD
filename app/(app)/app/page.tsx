// Buyer dashboard — Spec B5 (/app).
//
// Calls `public.buyer_dashboard()` (migration 0026) under the caller's
// session and renders three surfaces per `context/frontend-design-spec.md`
// §7: three stat tiles (Saved · Active RFQs · Unread messages — the last
// two ship in B6 / B7 and display 0 with a meta note), the top 6
// recently-saved suppliers as cards, and a unified recent-activity feed
// (cert added, cert expired, RSC remediation update, save event).
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

import { ReceiptsRing } from "@/components/receipts-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
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
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Buyer
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Dashboard
        </h1>
      </header>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load dashboard.
          </CardContent>
        </Card>
      ) : null}

      <section
        aria-label="Quick stats"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
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
          label="Unread messages"
          value={0}
          meta="Open Messages from the sidebar"
          href="/app/messages"
        />
      </section>

      {doc.alerts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
            <CardMeta>Certifications expiring in the next 30 days</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {doc.alerts.map((a) => (
                <li
                  key={`${a.supplier_id}-${a.cert_kind}-${a.expires_on}`}
                  className="flex items-center justify-between gap-3 rounded-input border border-sem-amber bg-sem-amber-soft px-3 py-2 text-[13px]"
                >
                  <span className="flex items-center gap-2 text-sem-amber">
                    <WarningCircle size={16} weight="fill" aria-hidden />
                    <Link
                      href={`/app/suppliers/${a.supplier_slug}`}
                      className="font-medium underline-offset-2 hover:underline"
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
          </CardContent>
        </Card>
      ) : null}

      <section aria-label="Saved suppliers" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink-primary">
            Saved suppliers
          </h2>
          {doc.saved_count > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/saved">
                View all <ArrowRight size={14} />
              </Link>
            </Button>
          ) : null}
        </div>
        {doc.recent_saved.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <p className="text-sm text-ink-secondary">
                You haven&apos;t saved any suppliers yet.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/app/discover">Browse Discover</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {doc.recent_saved.map((c) => (
              <li key={c.id}>
                <SavedMiniCard card={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Recent activity" className="space-y-3">
        <h2 className="font-display text-base font-semibold text-ink-primary">
          Recent activity
        </h2>
        {doc.recent_activity.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-ink-secondary">
              Activity on your saved suppliers will show up here.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="px-0 py-0">
              <ul className="m-0 flex list-none flex-col p-0">
                {doc.recent_activity.map((ev, i) => (
                  <li
                    key={`${ev.supplier_id}-${ev.kind}-${ev.event_at}-${i}`}
                    className="flex items-center gap-3 border-b border-hairline px-4 py-2.5 text-[13px] last:border-b-0"
                  >
                    <ActivityIcon kind={ev.kind} />
                    <div className="min-w-0 flex-1 truncate">
                      <Link
                        href={`/app/suppliers/${ev.supplier_slug}`}
                        className="font-medium text-ink-primary hover:underline"
                      >
                        {ev.company_name}
                      </Link>
                      <span className="text-ink-secondary"> · {activityLabel(ev)}</span>
                    </div>
                    <span className="font-mono text-[11px] text-ink-tertiary">
                      {fmtRelative(ev.event_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

// ---------- helpers --------------------------------------------------------

function StatTile({
  label,
  value,
  meta,
  href,
  muted,
}: {
  label: string;
  value: number;
  meta: string;
  href?: string;
  muted?: boolean;
}) {
  const body = (
    <Card className={muted ? "opacity-80" : undefined}>
      <CardContent className="space-y-1 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-tertiary">
          {label}
        </p>
        <p className="font-display text-3xl font-semibold tabular-nums text-ink-primary">
          {value.toLocaleString()}
        </p>
        <p className="text-[12px] text-ink-tertiary">{meta}</p>
      </CardContent>
    </Card>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-card transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo"
      >
        {body}
      </Link>
    );
  }
  return body;
}

function SavedMiniCard({ card }: { card: SavedCard }) {
  const location = [card.city, card.district].filter(Boolean).join(", ");
  const tags = (card.source_tags ?? []).slice(0, 3);
  return (
    <Link
      href={`/app/suppliers/${card.slug}`}
      className="block rounded-card transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-indigo"
    >
      <Card className="h-full transition hover:shadow-l2">
        <CardContent className="flex items-start gap-3 py-3">
          <ReceiptsRing sources={card.t13_source_count} size={32} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate font-display text-sm font-semibold text-ink-primary">
              {card.company_name}
            </p>
            <p className="truncate text-[12px] text-ink-tertiary">
              <Badge tone={card.entity_type === "factory" ? "active" : "neutral"}>
                {entityLabel(card.entity_type)}
              </Badge>
              {location ? <span className="ml-2">{location}</span> : null}
            </p>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-1 pt-1">
                {tags.map((t) => (
                  <Tag key={t} tone="neutral">
                    {t}
                  </Tag>
                ))}
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const sz = 16;
  if (kind === "saved")
    return <Star size={sz} weight="fill" className="text-sem-amber" aria-hidden />;
  if (kind === "cert_added")
    return <Certificate size={sz} weight="fill" className="text-sem-green" aria-hidden />;
  if (kind === "cert_expired")
    return <Clock size={sz} weight="fill" className="text-sem-red" aria-hidden />;
  return <ShieldCheck size={sz} weight="fill" className="text-accent-indigo" aria-hidden />;
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

function entityLabel(t: string): string {
  if (t === "factory") return "Factory";
  if (t === "buying_house") return "Buying house";
  return t.replace(/_/g, " ");
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
