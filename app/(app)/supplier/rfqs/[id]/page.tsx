// /supplier/rfqs/[id] — supplier RFQ detail + quote composer (Spec S4).
//
// Server component. Calls `public.rfq_get(p_id)` under the caller's
// session; the RPC returns null when the caller has no visibility (buyer
// of a different RFQ, or unrelated supplier) → notFound(). Buyers
// landing here are redirected to the buyer-side detail route, matching
// how `/supplier/messages` defers to `/app/messages` for buyer threads.
//
// `rfq_get` already returns at most one quote for supplier viewers (the
// quote belonging to the caller's claimed supplier within the target
// set). The composer is an upsert wired to `rfq_quote_submit` via the
// `/api/v1/rfqs` route — server is the security boundary; no direct
// INSERT.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import {
  ChatCircleText,
  FileText,
  Storefront,
} from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { MasterDetail } from "@/components/ui/master-detail";
import { SupplierQuoteForm } from "@/components/supplier-quote-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Quote = {
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
};

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
  quotes: Quote[];
  thread_id: string | null;
};

export default async function SupplierRfqDetailPage({
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
  if (rfq.viewer_role === "buyer") {
    redirect(`/app/rfqs/${rfq.id}`);
  }

  const { data: listData } = await supabase.rpc("rfq_list", { p_status: null });
  const listItems = ((listData ?? []) as RfqListPaneItem[]).filter(
    (r) => r.viewer_role !== "buyer",
  );

  const myQuote = rfq.quotes[0] ?? null;
  const canQuote = rfq.status === "open";

  return (
    <MasterDetail
      mode="detail"
      className="mx-auto max-w-6xl"
      list={<RfqListPane items={listItems} activeId={rfq.id} />}
      detail={
        <div className="space-y-6">
          <Link
            href="/supplier/rfqs"
            className="inline-flex items-center gap-1.5 text-xs text-ink-tertiary hover:text-ink-primary lg:hidden"
          >
            ← All RFQs
          </Link>
          <header className="space-y-1">
        <p className="text-[11px] text-ink-tertiary">
          Supplier · RFQ {rfq.id.slice(0, 8)}
        </p>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
            {rfq.product_title}
          </h1>
          <Badge tone={statusTone(rfq.status)}>{statusLabel(rfq.status)}</Badge>
        </div>
        <p className="text-[12px] text-ink-tertiary">
          Created {fmtDate(rfq.created_at)} · Updated{" "}
          {fmtRelative(rfq.updated_at)}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Specification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <Row label="Quantity">
            {fmtNum(rfq.quantity)} {rfq.quantity_unit}
          </Row>
          {rfq.target_unit_price != null ? (
            <Row label="Buyer target price">
              {fmtMoney(rfq.target_unit_price, rfq.currency)} /{" "}
              {rfq.quantity_unit}
            </Row>
          ) : null}
          {rfq.ship_to_country ? (
            <Row label="Ship to">{rfq.ship_to_country}</Row>
          ) : null}
          {rfq.ship_by ? (
            <Row label="Ship by">{fmtDate(rfq.ship_by)}</Row>
          ) : null}
          {rfq.product_description ? (
            <div className="space-y-1">
              <p className="text-[11px] text-ink-tertiary">
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
          <CardTitle>Addressed to</CardTitle>
          <CardMeta>
            {rfq.targets.length === 1
              ? "1 of your claimed companies"
              : `${rfq.targets.length} suppliers`}
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
                  <p className="truncate text-[12px] text-ink-tertiary">
                    {entityLabel(s.entity_type)}
                    {s.city ? ` · ${s.city}` : ""}
                    {s.district ? `, ${s.district}` : ""}
                  </p>
                </div>
                {rfq.thread_id ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/supplier/messages/${rfq.thread_id}`}>
                      <ChatCircleText size={14} aria-hidden /> Thread
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
          <CardTitle>Your quote</CardTitle>
          <CardMeta>
            {myQuote
              ? quoteLabel(myQuote.status)
              : canQuote
                ? "Not submitted"
                : "Quoting closed"}
          </CardMeta>
        </CardHeader>
        <CardContent>
          {myQuote && !canQuote ? (
            <div className="space-y-2 text-[13px]">
              <Row label="Unit price">
                {fmtMoney(myQuote.unit_price, myQuote.currency)} /{" "}
                {rfq.quantity_unit}
              </Row>
              {myQuote.lead_time_days != null ? (
                <Row label="Lead time">{myQuote.lead_time_days} days</Row>
              ) : null}
              {myQuote.moq != null ? (
                <Row label="MOQ">{fmtNum(myQuote.moq)}</Row>
              ) : null}
              {myQuote.valid_until ? (
                <Row label="Valid until">{fmtDate(myQuote.valid_until)}</Row>
              ) : null}
              {myQuote.notes ? (
                <div className="space-y-1">
                  <p className="text-[11px] text-ink-tertiary">
                    Notes
                  </p>
                  <p className="whitespace-pre-wrap text-ink-primary">
                    {myQuote.notes}
                  </p>
                </div>
              ) : null}
              <p className="pt-2 text-[12px] text-ink-tertiary">
                <FileText size={12} aria-hidden className="mr-1 inline" />
                RFQ is no longer open; your submitted quote is locked.
              </p>
            </div>
          ) : (
            <SupplierQuoteForm
              rfqId={rfq.id}
              rfqCurrency={rfq.currency}
              quantityUnit={rfq.quantity_unit}
              disabled={!canQuote}
              initial={
                myQuote
                  ? {
                      unit_price: myQuote.unit_price,
                      currency: myQuote.currency,
                      lead_time_days: myQuote.lead_time_days,
                      moq: myQuote.moq,
                      valid_until: myQuote.valid_until,
                      notes: myQuote.notes,
                      status: myQuote.status,
                    }
                  : null
              }
            />
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
  viewer_role: "buyer" | "supplier" | "both";
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
    <nav className="rounded-card border border-hairline bg-surface-l1">
      <p className="border-b border-hairline px-3 py-2 font-mono text-[11px] uppercase tracking-[0.05em] text-ink-tertiary">
        RFQs received
      </p>
      <ul className="m-0 flex max-h-[70vh] list-none flex-col overflow-y-auto p-0">
        {items.map((r) => (
          <li key={r.id} className="border-b border-hairline last:border-b-0">
            <Link
              href={`/supplier/rfqs/${r.id}`}
              className={`block px-3 py-2.5 transition hover:bg-brand-forest-tint ${
                r.id === activeId ? "bg-[#FBFAF6]" : ""
              }`}
            >
              <span className="block truncate text-[13px] font-semibold text-ink-primary">
                {r.product_title}
              </span>
              <span className="mt-0.5 flex items-center gap-2">
                <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                <span className="font-mono text-[10px] text-ink-tertiary">
                  {fmtRelative(r.updated_at)}
                </span>
              </span>
            </Link>
          </li>
        ))}
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
      <span className="w-40 shrink-0 text-[11px] text-ink-tertiary">
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
function quoteLabel(s: Quote["status"]): string {
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
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  return new Date(iso).toLocaleDateString();
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
