// /app/rfqs/[id] — RFQ detail (Spec B7).
//
// Server component. Calls `public.rfq_get(p_id)` under the caller's
// session. Buyer sees every quote with an Accept button (when RFQ
// status='open'); supplier sees only their own quote and the RFQ
// metadata. Per-supplier message thread is linked when available.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ChatCircleText, FileText, Storefront } from "@phosphor-icons/react/dist/ssr";

import { AcceptQuoteButton } from "@/components/accept-quote-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { MasterDetail } from "@/components/ui/master-detail";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RfqDoc = {
  id: string;
  product_title: string;
  product_description: string | null;
  quantity: number;
  quantity_unit: string;
  target_unit_price: number | null;
  currency: string;
  ship_to_country: string | null;
  ship_by: string | null;
  status: "open" | "accepted" | "closed" | "cancelled";
  accepted_quote_id: string | null;
  created_at: string;
  updated_at: string;
  viewer_role: "buyer" | "supplier" | "both";
  targets: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    city: string | null;
    district: string | null;
  }[];
  quotes: {
    id: string;
    supplier_id: string;
    supplier_slug: string;
    supplier_name: string;
    supplier_entity_type: string;
    unit_price: number;
    currency: string;
    lead_time_days: number | null;
    moq: number | null;
    valid_until: string | null;
    notes: string | null;
    status: "submitted" | "accepted" | "rejected" | "withdrawn";
    created_at: string;
    updated_at: string;
  }[];
  thread_id: string | null;
};

export default async function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("rfq_get", { p_id: id });
  if (error || data == null) {
    notFound();
  }
  const rfq = data as RfqDoc;
  const isBuyer = rfq.viewer_role === "buyer" || rfq.viewer_role === "both";
  const canAccept = isBuyer && rfq.status === "open";

  const { data: listData } = await supabase.rpc("rfq_list", { p_status: null });
  const listItems = (listData as RfqListPaneItem[] | null) ?? [];

  return (
    <MasterDetail
      mode="detail"
      className="mx-auto max-w-6xl"
      list={<RfqListPane items={listItems} activeId={rfq.id} />}
      detail={
        <div className="space-y-6">
          <Link
            href="/app/rfqs"
            className="inline-flex items-center gap-1 text-[13px] text-ink-tertiary hover:text-ink-primary lg:hidden"
          >
            ← All RFQs
          </Link>
      <header className="space-y-1">
        <p className="text-[12px] text-ink-tertiary">
          RFQ · {rfq.id.slice(0, 8)}
        </p>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            {rfq.product_title}
          </h1>
          <Badge tone={statusTone(rfq.status)}>{statusLabel(rfq.status)}</Badge>
        </div>
        <p className="text-[13px] text-ink-tertiary">
          Created {fmtDate(rfq.created_at)} · Updated {fmtRelative(rfq.updated_at)}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Specification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[14px]">
          <Row label="Quantity">
            {fmtNum(rfq.quantity)} {rfq.quantity_unit}
          </Row>
          {rfq.target_unit_price != null ? (
            <Row label="Target unit price">
              {fmtMoney(rfq.target_unit_price, rfq.currency)}
            </Row>
          ) : null}
          {rfq.ship_to_country ? (
            <Row label="Ship to">{rfq.ship_to_country}</Row>
          ) : null}
          {rfq.ship_by ? <Row label="Ship by">{fmtDate(rfq.ship_by)}</Row> : null}
          {rfq.product_description ? (
            <div className="space-y-1">
              <p className="text-[12px] text-ink-tertiary">
                Description
              </p>
              <p className="whitespace-pre-wrap text-ink-primary">
                {rfq.product_description}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Targeted suppliers</CardTitle>
          <CardMeta>
            {rfq.targets.length}{" "}
            {rfq.targets.length === 1 ? "supplier" : "suppliers"}
          </CardMeta>
        </CardHeader>
        <CardContent className="px-0 py-0">
          <ul className="m-0 flex list-none flex-col p-0">
            {rfq.targets.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0"
              >
                <Storefront
                  size={18}
                  weight="duotone"
                  className="text-accent-indigo"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/suppliers/${s.slug}`}
                    className="truncate font-display text-sm font-semibold text-ink-primary hover:underline"
                  >
                    {s.company_name}
                  </Link>
                  <p className="truncate text-[13px] text-ink-tertiary">
                    {entityLabel(s.entity_type)}
                    {s.city ? ` · ${s.city}` : ""}
                    {s.district ? `, ${s.district}` : ""}
                  </p>
                </div>
                {isBuyer && rfq.thread_id ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/app/messages/${rfq.thread_id}`}>
                      <ChatCircleText size={16} aria-hidden /> Thread
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotes</CardTitle>
          <CardMeta>
            {rfq.quotes.length}{" "}
            {rfq.quotes.length === 1 ? "submitted" : "submitted"}
          </CardMeta>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {rfq.quotes.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-secondary">
              <FileText
                size={24}
                weight="duotone"
                className="mx-auto block text-ink-tertiary"
                aria-hidden
              />
              No quotes yet.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0">
              {rfq.quotes.map((q) => (
                <li
                  key={q.id}
                  className="flex flex-col gap-2 border-b border-hairline px-4 py-3 last:border-b-0 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/app/suppliers/${q.supplier_slug}`}
                        className="truncate font-display text-sm font-semibold text-ink-primary hover:underline"
                      >
                        {q.supplier_name}
                      </Link>
                      <Badge tone={quoteTone(q.status)}>
                        {quoteLabel(q.status)}
                      </Badge>
                    </div>
                    <p className="text-[13px] text-ink-secondary">
                      {fmtMoney(q.unit_price, q.currency)} / {rfq.quantity_unit}
                      {q.lead_time_days != null
                        ? ` · ${q.lead_time_days}d lead`
                        : ""}
                      {q.moq != null ? ` · MOQ ${fmtNum(q.moq)}` : ""}
                      {q.valid_until ? ` · valid to ${fmtDate(q.valid_until)}` : ""}
                    </p>
                    {q.notes ? (
                      <p className="whitespace-pre-wrap text-[13px] text-ink-tertiary">
                        {q.notes}
                      </p>
                    ) : null}
                  </div>
                  {canAccept && q.status === "submitted" ? (
                    <AcceptQuoteButton quoteId={q.id} />
                  ) : null}
                  {isBuyer &&
                  rfq.status === "accepted" &&
                  q.status === "accepted" ? (
                    <Button asChild variant="primary" size="sm">
                      <Link href={`/app/orders/new?from_quote=${q.id}`}>
                        Create order from this quote
                      </Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
        </div>
      }
    />
  );
}

type RfqListPaneItem = {
  id: string;
  product_title: string;
  status: RfqDoc["status"];
  updated_at: string;
};

function RfqListPane({
  items,
  activeId,
}: {
  items: RfqListPaneItem[];
  activeId: string;
}) {
  return (
    <nav
      aria-label="All RFQs"
      className="overflow-hidden rounded-[13px] border border-hairline bg-white"
    >
      <p className="border-b border-hairline px-4 py-2.5 text-[12px] font-semibold text-ink-tertiary">
        RFQs
      </p>
      <ul className="m-0 flex max-h-[70vh] list-none flex-col overflow-y-auto p-0">
        {items.map((r) => {
          const active = r.id === activeId;
          return (
            <li key={r.id}>
              <Link
                href={`/app/rfqs/${r.id}`}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col gap-0.5 border-b border-hairline px-4 py-3 last:border-b-0 ${
                  active ? "bg-[#FBFAF6] font-medium" : "hover:bg-[#FBFAF6]/60"
                }`}
              >
                <span className="truncate font-display text-[14px] text-ink-primary">
                  {r.product_title}
                </span>
                <span className="text-[12px] text-ink-tertiary">
                  {statusLabel(r.status)} · {fmtRelative(r.updated_at)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="w-40 shrink-0 text-[12px] text-ink-tertiary">
        {label}
      </span>
      <span className="text-ink-primary">{children}</span>
    </div>
  );
}

function statusTone(
  s: RfqDoc["status"],
): "active" | "neutral" | "alert" | "success" {
  if (s === "open") return "active";
  if (s === "accepted") return "success";
  if (s === "cancelled") return "alert";
  return "neutral";
}
function statusLabel(s: RfqDoc["status"]): string {
  if (s === "open") return "Open";
  if (s === "accepted") return "Accepted";
  if (s === "cancelled") return "Cancelled";
  return "Closed";
}
function quoteTone(
  s: RfqDoc["quotes"][number]["status"],
): "active" | "neutral" | "alert" | "success" {
  if (s === "submitted") return "active";
  if (s === "accepted") return "success";
  if (s === "rejected") return "alert";
  return "neutral";
}
function quoteLabel(s: RfqDoc["quotes"][number]["status"]): string {
  if (s === "submitted") return "Submitted";
  if (s === "accepted") return "Accepted";
  if (s === "rejected") return "Rejected";
  return "Withdrawn";
}
function entityLabel(et: string) {
  if (et === "factory") return "Factory";
  if (et === "buying_house") return "Buying house";
  return "Supplier";
}
function fmtNum(n: number) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : String(n);
}
function fmtMoney(n: number, ccy: string) {
  const v = Number(n);
  if (!Number.isFinite(v)) return `${n} ${ccy}`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${ccy}`;
}
function fmtDate(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleDateString();
}
function fmtRelative(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const delta = Date.now() - t;
  const day = 86_400_000;
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < day) return `${Math.floor(delta / 3_600_000)}h ago`;
  if (delta < 30 * day) return `${Math.floor(delta / day)}d ago`;
  return new Date(iso).toLocaleDateString();
}
