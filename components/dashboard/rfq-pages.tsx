// The buyer's RFQ pages in the dashboard kit (handoff §3.7): the list and the
// detail. Server components; the routes read `rfq_list` / `rfq_get` and hand
// the rows here, so a test can render exactly what a buyer receives.
//
// Only what `rfq_list` and `rfq_get` return is drawn. There is no drafts table,
// no reply-by date and no per-supplier reply state yet, so the tabs are the
// RFQ's own status and its quote count, nothing derived beyond that.

import Link from "next/link";
import type { ReactNode } from "react";
import { AcceptQuoteButton } from "@/components/accept-quote-button";
import { buildRfqRow, type RfqListRow } from "@/lib/dashboard/build-models";
import { formatCount, formatDay } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { Badge, Chip, type BadgeTone } from "./chips";
import { Button, Count } from "./controls";
import { Icon } from "./icons";
import { Cell, DataTable, DetailList, EmptyState, ErrorNote, HeadCell, PageHeader, PageSection } from "./page";
import { RFQ_ERROR_COPY } from "./rfq-list";
import { Caption } from "./type";

type RfqStatus = "open" | "accepted" | "closed" | "cancelled";
type ViewerRole = "buyer" | "supplier" | "both";

export type RfqRow = RfqListRow & { updated_at: string; viewer_role: ViewerRole };

// ---- List ----

export const RFQ_TABS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "quoted", label: "Quoted" },
  { key: "accepted", label: "Accepted" },
  { key: "closed", label: "Closed" },
] as const;
export type RfqTab = (typeof RFQ_TABS)[number]["key"];

/** Which tab a row sits under: open with no quote, open with quotes, accepted, closed or cancelled. */
export function rfqTabOf(r: Pick<RfqRow, "status" | "quote_count">): Exclude<RfqTab, "all"> {
  if (r.status === "accepted") return "accepted";
  if (r.status === "closed" || r.status === "cancelled") return "closed";
  return r.quote_count > 0 ? "quoted" : "open";
}

export function parseRfqTab(v: unknown): RfqTab {
  return RFQ_TABS.some((t) => t.key === v) ? (v as RfqTab) : "all";
}

/** Handoff §3.7's empty copy, as a title and its sentence. */
export const RFQ_EMPTY_TITLE = "Your first RFQ lands here.";
export const RFQ_EMPTY_BODY = "Suppliers answer inside the platform, with the record attached.";

const tabHref = (key: RfqTab) => (key === "all" ? "/app/rfqs" : `/app/rfqs?status=${key}`);

/** `rows: null` → `rfq_list` failed; no count and no empty state stand in for it. */
export function RfqListBody({ rows, tab, today }: { rows: RfqRow[] | null; tab: RfqTab; today: Date }) {
  const sent = rows?.filter((r) => r.viewer_role !== "supplier") ?? null;
  const quotes = sent?.reduce((n, r) => n + (Number.isFinite(r.quote_count) ? r.quote_count : 0), 0) ?? null;
  const shown = rows ? rows.filter((r) => tab === "all" || rfqTabOf(r) === tab) : [];
  const countOf = (key: RfqTab) => (rows ? rows.filter((r) => key === "all" || rfqTabOf(r) === key).length : null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageHeader
        title="RFQs"
        caption={
          sent === null || quotes === null
            ? "Counts could not be read"
            : `${formatCount(sent.length)} sent · ${formatCount(quotes)} ${quotes === 1 ? "quote" : "quotes"}`
        }
        actions={
          // Where a buyer starts an RFQ today: from a supplier, found in Discover.
          <Button variant="primary" href="/app/discover" clientNav>
            <Icon name="plus" /> New RFQ
          </Button>
        }
      >
        {rows && rows.length > 0 ? (
          <nav aria-label="RFQ status" className="flex flex-wrap gap-2">
            {RFQ_TABS.map((t) => (
              <Link prefetch={false} key={t.key} href={tabHref(t.key)} aria-current={t.key === tab ? "page" : undefined} className="rounded-sm">
                <Chip tone={t.key === tab ? "on" : "neutral"}>
                  {t.label}
                  <Count className="text-xs">{countOf(t.key)}</Count>
                </Chip>
              </Link>
            ))}
          </nav>
        ) : null}
      </PageHeader>

      {rows === null ? (
        <ErrorNote>{RFQ_ERROR_COPY}</ErrorNote>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-line-subtle bg-surface">
          <EmptyState
            art="rfq"
            title={RFQ_EMPTY_TITLE}
            action={
              <Button href="/app/discover" clientNav>
                <Icon name="search" /> Find suppliers
              </Button>
            }
          >
            {RFQ_EMPTY_BODY}
          </EmptyState>
        </div>
      ) : (
        <div className="rounded-md border border-line-subtle bg-surface">
          {shown.length === 0 ? (
            <EmptyState icon="send" title={`No ${RFQ_TABS.find((t) => t.key === tab)?.label.toLowerCase()} RFQs`}>
              RFQs move here as their status changes.
            </EmptyState>
          ) : (
            <DataTable label="RFQs" minWidth="46rem">
              <thead>
                <tr>
                  <HeadCell>RFQ</HeadCell>
                  <HeadCell className="text-right">Suppliers</HeadCell>
                  <HeadCell className="text-right">Quantity</HeadCell>
                  <HeadCell>Status</HeadCell>
                  <HeadCell>Updated</HeadCell>
                  <HeadCell>
                    <span className="sr-only">Action</span>
                  </HeadCell>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const m = buildRfqRow(r, null, today);
                  const href = `/app/rfqs/${r.id}`;
                  return (
                    <tr key={r.id} className="relative transition-colors duration-fast hover:bg-surface-sunken">
                      <Cell>
                        <span className="flex flex-wrap items-center gap-2">
                          {/* The whole row opens the RFQ: this link's box is stretched over the row. */}
                          <Link prefetch={false}
                            href={href}
                            className="font-medium text-ink-strong [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-['']"
                          >
                            {m.name}
                          </Link>
                          {r.viewer_role !== "buyer" ? <Badge tone="type">As supplier</Badge> : null}
                        </span>
                      </Cell>
                      <Cell className="text-right tabular-nums">{m.supplierCount}</Cell>
                      <Cell className="whitespace-nowrap text-right tabular-nums">{`${fmtNum(r.quantity)} ${r.quantity_unit}`}</Cell>
                      <Cell>
                        <Badge tone={m.status.tone} icon={m.status.icon}>
                          {m.status.label}
                        </Badge>
                      </Cell>
                      <Cell className="whitespace-nowrap text-ink-muted">{formatDay(r.updated_at) ?? "—"}</Cell>
                      <Cell className="text-right">
                        {/* For the pointer only: the title link already opens the
                            row, and a second "Open" per row doubled the tab
                            stops and gave screen readers a list of identical
                            link names. */}
                        <span className="relative" aria-hidden>
                          <Button href={href} clientNav tabIndex={-1} className="h-7 px-2.5 text-xs">
                            Open
                          </Button>
                        </span>
                      </Cell>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
          <div className="px-4 py-3">
            <Caption>{shown.length === 0 ? "0 RFQs" : `1–${shown.length} of ${shown.length}`}</Caption>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Detail ----

export type RfqDoc = {
  id: string;
  product_title: string;
  product_description: string | null;
  quantity: number;
  quantity_unit: string;
  target_unit_price: number | null;
  currency: string;
  ship_to_country: string | null;
  ship_by: string | null;
  status: RfqStatus;
  accepted_quote_id: string | null;
  created_at: string;
  updated_at: string;
  viewer_role: ViewerRole;
  targets: { id: string; slug: string; company_name: string; entity_type: string; city: string | null; district: string | null }[];
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

export type RfqListItem = { id: string; product_title: string; status: RfqStatus; updated_at: string };

const RFQ_STATUS: Record<RfqStatus, { tone: BadgeTone; label: string }> = {
  open: { tone: "type", label: "Open" },
  accepted: { tone: "positive", label: "Accepted" },
  closed: { tone: "type", label: "Closed" },
  cancelled: { tone: "type", label: "Cancelled" },
};

export const QUOTE_STATUS: Record<RfqDoc["quotes"][number]["status"], { tone: BadgeTone; label: string }> = {
  submitted: { tone: "type", label: "Submitted" },
  accepted: { tone: "positive", label: "Accepted" },
  rejected: { tone: "type", label: "Rejected" },
  withdrawn: { tone: "type", label: "Withdrawn" },
};

/** Not `formatCount`: that rounds, and a quantity or a price may carry decimals. */
function fmtNum(n: number): string {
  const v = Number(n);
  return Number.isFinite(v) ? new Intl.NumberFormat("en-GB", { maximumFractionDigits: 4 }).format(v) : String(n);
}

const fmtMoney = (n: number, ccy: string) => `${fmtNum(n)} ${ccy}`;

const notGiven = <span className="text-ink-subtle">Not given</span>;

function entityLabel(et: string): string {
  if (et === "factory") return "Factory";
  if (et === "buying_house") return "Buying house";
  return "Supplier";
}

export function RfqDetailBody({ rfq, list }: { rfq: RfqDoc; list: RfqListItem[] }) {
  const isBuyer = rfq.viewer_role === "buyer" || rfq.viewer_role === "both";
  const canAccept = isBuyer && rfq.status === "open";
  const status = RFQ_STATUS[rfq.status] ?? RFQ_STATUS.closed;

  const facts: { label: string; value: ReactNode }[] = [
    { label: "Product", value: rfq.product_title },
    { label: "Quantity", value: `${fmtNum(rfq.quantity)} ${rfq.quantity_unit}` },
    ...(rfq.target_unit_price != null
      ? [{ label: "Target unit price", value: fmtMoney(rfq.target_unit_price, rfq.currency) }]
      : []),
    { label: "Ship to", value: rfq.ship_to_country || notGiven },
    { label: "Ship by", value: formatDay(rfq.ship_by) ?? notGiven },
    { label: "Created", value: formatDay(rfq.created_at) ?? "—" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <PageHeader
        title={rfq.product_title}
        caption={`RFQ ${rfq.id.slice(0, 8)} · updated ${formatDay(rfq.updated_at) ?? "—"}`}
        actions={
          <Button href="/app/rfqs" clientNav variant="ghost">
            <Icon name="chev-l" /> All RFQs
          </Button>
        }
      />

      {/* Facts left, quotes in the middle, status and threads in a side card:
          three columns where there is room, the side card under the facts below that. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start 2xl:grid-cols-[20rem_minmax(0,1fr)_17rem]">
        <PageSection title="Request" className="lg:col-start-1 lg:row-start-1">
          <DetailList rows={facts} />
          {rfq.product_description ? (
            <div className="flex flex-col gap-1 border-t border-line-subtle px-4 py-3">
              <span className="text-sm font-medium text-ink-muted">Description</span>
              <p className="m-0 whitespace-pre-wrap text-base text-ink [overflow-wrap:anywhere]">{rfq.product_description}</p>
            </div>
          ) : null}
        </PageSection>

        <PageSection
          title="Quotes"
          caption={`${rfq.quotes.length} submitted`}
          className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          {rfq.quotes.length === 0 ? (
            <EmptyState icon="clock" title="No quotes yet">
              Quotes appear here as suppliers answer. You can compare and accept them side by side.
            </EmptyState>
          ) : (
            <DataTable label="Quotes" minWidth="44rem">
              <thead>
                <tr>
                  <HeadCell>Supplier</HeadCell>
                  <HeadCell className="text-right">Unit price</HeadCell>
                  <HeadCell className="text-right">Lead time</HeadCell>
                  <HeadCell className="text-right">MOQ</HeadCell>
                  <HeadCell>Valid until</HeadCell>
                  <HeadCell>Status</HeadCell>
                  <HeadCell>
                    <span className="sr-only">Action</span>
                  </HeadCell>
                </tr>
              </thead>
              <tbody>
                {rfq.quotes.map((q) => {
                  const qs = QUOTE_STATUS[q.status] ?? QUOTE_STATUS.withdrawn;
                  return (
                    <tr key={q.id} className="align-top">
                      <Cell className="py-2.5">
                        <Link prefetch={false} href={`/app/suppliers/${q.supplier_slug}`} className="font-medium text-brand-ink [overflow-wrap:anywhere] hover:underline">
                          {q.supplier_name}
                        </Link>
                        {q.notes ? (
                          <p className="m-0 mt-0.5 max-w-prose whitespace-pre-wrap text-xs text-ink-muted [overflow-wrap:anywhere]">{q.notes}</p>
                        ) : null}
                      </Cell>
                      <Cell className="whitespace-nowrap text-right tabular-nums">
                        {fmtMoney(q.unit_price, q.currency)}
                        <span className="text-ink-subtle"> / {rfq.quantity_unit}</span>
                      </Cell>
                      <Cell className="whitespace-nowrap text-right tabular-nums">
                        {q.lead_time_days != null ? `${q.lead_time_days} days` : <span className="text-ink-subtle">—</span>}
                      </Cell>
                      <Cell className="text-right tabular-nums">
                        {q.moq != null ? formatCount(q.moq) : <span className="text-ink-subtle">—</span>}
                      </Cell>
                      <Cell className="whitespace-nowrap">{formatDay(q.valid_until) ?? <span className="text-ink-subtle">—</span>}</Cell>
                      <Cell>
                        <Badge tone={qs.tone}>{qs.label}</Badge>
                      </Cell>
                      <Cell className="text-right">
                        {canAccept && q.status === "submitted" ? <AcceptQuoteButton quoteId={q.id} /> : null}
                        {isBuyer && rfq.status === "accepted" && q.status === "accepted" ? (
                          <Button variant="primary" href={`/app/orders/new?from_quote=${q.id}`} clientNav>
                            Create order from this quote
                          </Button>
                        ) : null}
                      </Cell>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </PageSection>

        <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-2 2xl:col-start-3 2xl:row-start-1">
          <PageSection title="Status">
            <div className="flex flex-col gap-3 px-4 py-3">
              <span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </span>
              {isBuyer && rfq.thread_id ? (
                <Button href={`/app/messages/${rfq.thread_id}`} clientNav>
                  <Icon name="chat" /> Open message thread
                </Button>
              ) : (
                <Caption>No message thread yet.</Caption>
              )}
            </div>
          </PageSection>

          <PageSection title="Suppliers" caption={`${rfq.targets.length}`}>
            <ul className="m-0 flex list-none flex-col p-0">
              {rfq.targets.map((s) => (
                <li key={s.id} className="flex flex-col gap-0.5 border-t border-line-subtle px-4 py-2.5 first:border-t-0">
                  <Link prefetch={false} href={`/app/suppliers/${s.slug}`} className="text-sm font-medium text-brand-ink [overflow-wrap:anywhere] hover:underline">
                    {s.company_name}
                  </Link>
                  <Caption>
                    {entityLabel(s.entity_type)}
                    {s.city ? ` · ${s.city}` : ""}
                    {s.district ? `, ${s.district}` : ""}
                  </Caption>
                </li>
              ))}
            </ul>
          </PageSection>

          {list.length > 1 ? (
            <PageSection title="Other RFQs">
              <nav aria-label="All RFQs">
                <ul className="m-0 flex max-h-80 list-none flex-col overflow-y-auto p-0">
                  {list.map((r) => {
                    const active = r.id === rfq.id;
                    return (
                      <li key={r.id} className="border-t border-line-subtle first:border-t-0">
                        <Link prefetch={false}
                          href={`/app/rfqs/${r.id}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex flex-col gap-0.5 px-4 py-2.5 hover:bg-surface-sunken",
                            active && "bg-surface-sunken",
                          )}
                        >
                          <span className="text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">{r.product_title}</span>
                          <Caption>
                            {(RFQ_STATUS[r.status] ?? RFQ_STATUS.closed).label} · {formatDay(r.updated_at) ?? "—"}
                          </Caption>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </PageSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}
