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
import { FileText, Storefront } from "@phosphor-icons/react/dist/ssr";

import { ButtonLink, linkClass } from "@/components/kit";
import { RfqChip } from "@/components/rfqs/chip";
import { SupplierQuoteForm } from "@/components/supplier-quote-form";
import { noteActivity } from "@/lib/ledger/note";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
  /** 0106: the buyer's message and the questions they ask; absent before it. */
  message?: string | null;
  questions?: string[] | null;
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
  // The supplier read the buyer's RFQ: an event for the record (moderation plan 1d, "viewed by a supplier").
  void noteActivity(supabase, "rfq.viewed", { targetTable: "rfqs", targetId: rfq.id, rfqId: rfq.id, content: { viewer_role: rfq.viewer_role, via: "supplier_page" } });

  const { data: listData } = await supabase.rpc("rfq_list", { p_status: null });
  const listItems = ((listData ?? []) as RfqListPaneItem[]).filter(
    (r) => r.viewer_role !== "buyer",
  );

  const myQuote = rfq.quotes[0] ?? null;
  const canQuote = rfq.status === "open";

  return (
    <div className="mx-auto grid w-full max-w-[1200px] items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <RfqListPane items={listItems} activeId={rfq.id} />
      <div className="flex min-w-0 flex-col gap-6">
        <Link href="/supplier/rfqs" className={cn(linkClass, "text-sm lg:hidden")}>
          ← All RFQs
        </Link>
        <header className="flex flex-col gap-1">
          <p className="text-sm text-ink-3">Supplier · RFQ {rfq.id.slice(0, 8)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-ink">
              {rfq.product_title}
            </h1>
            <RfqChip tone={statusTone(rfq.status)}>{statusLabel(rfq.status)}</RfqChip>
          </div>
          <p className="text-md text-ink-2">
            Created {fmtDate(rfq.created_at)} · Updated {fmtRelative(rfq.updated_at)}
          </p>
        </header>

        <Panel title="Specification">
          <div className="flex flex-col gap-3 text-base">
            <Row label="Quantity">
              {fmtNum(rfq.quantity)} {rfq.quantity_unit}
            </Row>
            {rfq.target_unit_price != null ? (
              <Row label="Buyer target price">
                {fmtMoney(rfq.target_unit_price, rfq.currency)} / {rfq.quantity_unit}
              </Row>
            ) : null}
            {rfq.ship_to_country ? <Row label="Ship to">{rfq.ship_to_country}</Row> : null}
            {rfq.ship_by ? <Row label="Ship by">{fmtDate(rfq.ship_by)}</Row> : null}
            {rfq.product_description ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-ink-3">Description</p>
                <p className="whitespace-pre-wrap text-ink">{rfq.product_description}</p>
              </div>
            ) : null}
            {/* What the buyer wrote in the composer: the message and the
                questions they want answered in the quote. */}
            {rfq.message ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-ink-3">Message from the buyer</p>
                <p className="whitespace-pre-wrap text-ink">{rfq.message}</p>
              </div>
            ) : null}
            {rfq.questions && rfq.questions.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-ink-3">The buyer asks</p>
                <ol className="m-0 list-decimal space-y-0.5 pl-5 text-ink">
                  {rfq.questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="Addressed to"
          meta={
            rfq.targets.length === 1
              ? "1 of your claimed companies"
              : `${rfq.targets.length} suppliers`
          }
          flush
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {rfq.targets.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0"
              >
                <Storefront size={20} className="shrink-0 text-ink-3" aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/suppliers/${s.slug}`}
                    className="block truncate text-base font-medium text-ink hover:underline"
                  >
                    {s.company_name}
                  </Link>
                  <p className="truncate text-sm text-ink-3">
                    {entityLabel(s.entity_type)}
                    {s.city ? ` · ${s.city}` : ""}
                    {s.district ? `, ${s.district}` : ""}
                  </p>
                </div>
                {rfq.thread_id ? (
                  <ButtonLink href={`/supplier/messages/${rfq.thread_id}`} kind="quiet">
                    Thread
                  </ButtonLink>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Your quote"
          meta={
            myQuote
              ? quoteLabel(myQuote.status)
              : canQuote
                ? "Not submitted"
                : "Quoting closed"
          }
        >
          {myQuote && !canQuote ? (
            <div className="flex flex-col gap-2 text-base">
              <Row label="Unit price">
                {fmtMoney(myQuote.unit_price, myQuote.currency)} / {rfq.quantity_unit}
              </Row>
              {myQuote.lead_time_days != null ? (
                <Row label="Lead time">{myQuote.lead_time_days} days</Row>
              ) : null}
              {myQuote.moq != null ? <Row label="MOQ">{fmtNum(myQuote.moq)}</Row> : null}
              {myQuote.valid_until ? (
                <Row label="Valid until">{fmtDate(myQuote.valid_until)}</Row>
              ) : null}
              {myQuote.notes ? (
                <div className="flex flex-col gap-1">
                  <p className="text-xs text-ink-3">Notes</p>
                  <p className="whitespace-pre-wrap text-ink">{myQuote.notes}</p>
                </div>
              ) : null}
              <p className="flex items-center gap-1.5 pt-2 text-sm text-ink-3">
                <FileText size={16} aria-hidden />
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
        </Panel>
      </div>
    </div>
  );
}

type RfqListPaneItem = {
  id: string;
  product_title: string;
  status: RfqDoc["status"];
  viewer_role: "buyer" | "supplier" | "both";
  updated_at: string;
};

function Panel({
  title,
  meta,
  flush,
  children,
}: {
  title: string;
  meta?: string;
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="overflow-clip rounded-md border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        {meta ? <p className="text-sm text-ink-3">{meta}</p> : null}
      </div>
      <div className={flush ? "mt-3" : "p-5 pt-4"}>{children}</div>
    </section>
  );
}

function RfqListPane({
  items,
  activeId,
}: {
  items: RfqListPaneItem[];
  activeId: string;
}) {
  return (
    <nav aria-label="RFQs received" className="max-lg:hidden rounded-md border border-line">
      <p className="border-b border-line px-3 py-2 text-xs font-medium text-ink-3">
        RFQs received
      </p>
      <ul className="m-0 flex max-h-[70vh] list-none flex-col overflow-y-auto p-0">
        {items.map((r) => (
          <li key={r.id} className="border-b border-line last:border-b-0">
            <Link
              href={`/supplier/rfqs/${r.id}`}
              aria-current={r.id === activeId ? "page" : undefined}
              className={cn(
                "flex flex-col gap-1 px-3 py-2.5 outline-none hover:bg-brand-wash focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus",
                r.id === activeId && "bg-brand-tint",
              )}
            >
              <span className="block truncate text-base font-medium text-ink">
                {r.product_title}
              </span>
              <span className="flex items-center gap-2">
                <RfqChip tone={statusTone(r.status)}>{statusLabel(r.status)}</RfqChip>
                <span className="text-xs text-ink-3">{fmtRelative(r.updated_at)}</span>
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
    <div className="flex flex-wrap items-baseline gap-x-3">
      <span className="w-40 shrink-0 text-xs text-ink-3">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  );
}

function statusTone(s: RfqDoc["status"]): "waiting" | "accepted" | "closed" {
  if (s === "open") return "waiting";
  if (s === "accepted") return "accepted";
  return "closed";
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
