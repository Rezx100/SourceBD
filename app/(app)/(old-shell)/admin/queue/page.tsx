// Admin unified review queue. Lists all verification_queue rows and routes
// specialized queue types to their dedicated moderation flows.

import { CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";

import { AdminQueueDecideButton } from "@/components/admin-queue-decide-button";
import {
  ButtonLink,
  Button,
  Chip,
  Empty,
  Field,
  InlineError,
  Select,
  TabLink,
  Table,
  Td,
  Th,
  Tr,
  TypeChip,
} from "@/components/kit";
import {
  QueueColumn,
  QueueFilter,
  QueueHead,
  QueueTable,
  SupplierLink,
  formatAdminDate,
} from "@/components/admin/queue-parts";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Supplier = {
  id: string;
  slug: string;
  company_name: string;
  name_display: string | null;
  entity_type: string;
  city: string | null;
  district: string | null;
  published: boolean;
  tier_coverage: number;
};

type Row = {
  queue_id: string;
  queue_type: string;
  supplier_b_name: string | null;
  confidence: number | string | null;
  source_data: Record<string, unknown> | null;
  admin_action: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  release_action: string | null;
  buyer_destination: string | null;
  /** 0128: the Release plan has not been worked out for this row yet; the next load takes up to ten more. */
  plan_pending?: boolean | null;
  supplier: Supplier | null;
};

type Doc = {
  total: number;
  by_type: Record<string, number>;
  rows: Row[];
};

const PAGE_SIZE = 50;
const QUEUE_TYPES = [
  "fuzzy_match_review",
  "uncorroborated_record",
  "rsc_unmatched",
  "group_parent_review",
  "brand_disclosure_match_review",
  "cert_doc_review",
  "sanctions_hit",
] as const;

const STATUSES = ["open", "reviewed", "all"] as const;

function asInt(v: string | string[] | undefined): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null || s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function asStr(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s ?? "";
}

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const type = asStr(sp.type);
  const statusRaw = asStr(sp.status) || "open";
  const status = (STATUSES as readonly string[]).includes(statusRaw)
    ? statusRaw
    : "open";
  const page = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_queue_list", {
    p_type: type || null,
    p_status: status,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <QueueColumn>
        <QueueHead title="Review queue" lede={LEDE_EMPTY} />
        <InlineError>
          Could not load review queue
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </QueueColumn>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));
  const baseQuery = new URLSearchParams();
  if (type) baseQuery.set("type", type);
  if (status !== "open") baseQuery.set("status", status);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/queue?${s}` : "/admin/queue";
  };

  return (
    <QueueColumn>
      <QueueHead
        title="Review queue"
        lede={`${doc.total.toLocaleString()} review items in the current filter. Release sends each row to the buyer-facing company profile it belongs on, then closes the ticket.`}
      />

      <nav aria-label="Review queue types" className="flex gap-1 overflow-x-auto border-b border-line">
        <TabLink
          href={`/admin/queue${status === "open" ? "" : `?status=${status}`}`}
          current={!type}
          count={sumOpen(doc.by_type)}
          prefetch={false}
        >
          {status === "open" ? "All open" : "All types"}
        </TabLink>
        {QUEUE_TYPES.map((qt) => {
          const q = new URLSearchParams();
          q.set("type", qt);
          if (status !== "open") q.set("status", status);
          return (
            <TabLink
              key={qt}
              href={`/admin/queue?${q.toString()}`}
              current={type === qt}
              count={doc.by_type[qt] ?? 0}
              prefetch={false}
            >
              {queueLabel(qt)}
            </TabLink>
          );
        })}
      </nav>

      <QueueFilter
        action="/admin/queue"
        hidden={type ? { name: "type", value: type } : undefined}
        reset={<ButtonLink href="/admin/queue">Reset</ButtonLink>}
      >
        <Field label="Status" help="Keep the queue focused on open work, or audit reviewed decisions when needed." className="sm:min-w-[222px]">
          {(a) => (
            <Select
              {...a}
              name="status"
              defaultValue={status}
              options={STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))}
            />
          )}
        </Field>
        <Button type="submit" kind="primary">
          Apply
        </Button>
      </QueueFilter>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-ink">{type ? queueLabel(type) : "Review queue"}</h2>
          <p className="text-sm text-ink-3">{`${doc.total.toLocaleString()} total · page ${page} / ${totalPages}`}</p>
        </div>
        {doc.rows.length === 0 ? (
          <Empty
            title="No review items match this filter"
            action={<ButtonLink href="/admin/queue">Back to open queue</ButtonLink>}
          >
            Switch queue type or review state to find more work.
          </Empty>
        ) : (
          <QueueTable
            noun="review items"
            total={doc.total}
            page={page}
            pages={totalPages}
            perPage={PAGE_SIZE}
            shown={doc.rows.length}
            pageHref={pageHref}
          >
            <Table>
              <caption className="sr-only">Admin review queue</caption>
              <thead>
                <tr>
                  <Th>Review item</Th>
                  <Th>Supplier</Th>
                  <Th>Readiness</Th>
                  <Th>Evidence</Th>
                  <Th align="right">
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {doc.rows.map((r) => (
                  <QueueRowView key={r.queue_id} r={r} />
                ))}
              </tbody>
            </Table>
          </QueueTable>
        )}
      </section>
    </QueueColumn>
  );
}

const LEDE_EMPTY = "Work pending verification, matching, certification, and sanctions review items.";

function QueueRowView({ r }: { r: Row }) {
  const confidence = confidenceValue(r.confidence);
  return (
    <Tr className="align-top">
      <Td>
        <span className="flex flex-wrap items-center gap-1.5">
          <TypeChip>{queueLabel(r.queue_type)}</TypeChip>
          {r.reviewed_at ? (
            <Chip icon={CheckCircle}>{r.admin_action ?? "reviewed"}</Chip>
          ) : (
            <Chip tone="caution" icon={Warning}>
              open
            </Chip>
          )}
        </span>
        <span className="mt-1 block text-sm text-ink-3">
          Queued {formatAdminDate(r.created_at)}
          {confidence != null ? ` · confidence ${confidence.toFixed(2)}` : ""}
        </span>
        {r.buyer_destination ? (
          <span className="mt-1 block text-sm text-ink-2">
            Buyer destination: {r.buyer_destination}
          </span>
        ) : !r.reviewed_at && r.plan_pending ? (
          <span className="mt-1 block text-sm text-ink-3">
            Not yet classified: each load works out up to ten more rows.
          </span>
        ) : null}
      </Td>
      <Td>
        {r.supplier ? (
          <>
            <SupplierLink id={r.supplier.id}>
              {r.supplier.name_display ?? r.supplier.company_name}
            </SupplierLink>
            <span className="block text-sm text-ink-3">
              {r.supplier.entity_type.replace(/_/g, " ")}
              {[r.supplier.city, r.supplier.district].filter(Boolean).length
                ? ` · ${[r.supplier.city, r.supplier.district].filter(Boolean).join(", ")}`
                : ""}
            </span>
          </>
        ) : (
          <span className="text-ink-3">{r.supplier_b_name ?? "No linked supplier"}</span>
        )}
      </Td>
      <Td>
        {r.supplier ? (
          <span className="flex flex-wrap gap-1.5">
            {r.supplier.published ? (
              <Chip icon={CheckCircle}>Visible to buyers</Chip>
            ) : (
              <Chip tone="caution" icon={Warning}>
                Not visible
              </Chip>
            )}
            {r.supplier.tier_coverage > 0 ? (
              <Chip icon={CheckCircle}>{r.supplier.tier_coverage} evidence sources</Chip>
            ) : (
              <Chip tone="caution" icon={Warning}>
                {r.supplier.tier_coverage} evidence sources
              </Chip>
            )}
          </span>
        ) : (
          <span className="text-ink-3">Needs matching</span>
        )}
      </Td>
      <Td>
        <span className="block max-w-md text-sm text-ink-2">{sourceSummary(r.source_data)}</span>
      </Td>
      <Td align="right">
        <RowAction r={r} />
      </Td>
    </Tr>
  );
}

function RowAction({ r }: { r: Row }) {
  if (r.reviewed_at) return <span className="text-ink-3">Done</span>;
  if (r.queue_type === "cert_doc_review") {
    return <ButtonLink href="/admin/certifications">Open certs</ButtonLink>;
  }
  if (r.queue_type === "sanctions_hit") {
    return <ButtonLink href="/admin/sanctions">Open sanctions</ButtonLink>;
  }
  return (
    <AdminQueueDecideButton
      queueId={r.queue_id}
      label={`${queueLabel(r.queue_type)} review`}
      destination={r.buyer_destination}
    />
  );
}

function statusLabel(status: string): string {
  if (status === "open") return "Open review items";
  if (status === "reviewed") return "Reviewed decisions";
  return "All review items";
}

function queueLabel(type: string): string {
  return type
    .replace("cert_doc_review", "Certification documents")
    .replace("sanctions_hit", "Sanctions hits")
    .replace("group_parent_review", "Group / parent review")
    .replace("fuzzy_match_review", "Fuzzy supplier matches")
    .replace("brand_disclosure_match_review", "Brand disclosure matches")
    .replace("uncorroborated_record", "Uncorroborated records")
    .replace("rsc_unmatched", "RSC unmatched records");
}

function sumOpen(byType: Record<string, number>): number {
  return Object.values(byType).reduce((sum, n) => sum + n, 0);
}

function confidenceValue(raw: Row["confidence"]): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

function sourceSummary(sourceData: Record<string, unknown> | null): string {
  if (!sourceData || Object.keys(sourceData).length === 0) return "No source payload.";
  const preferred = [
    // ETL holds (etl_hold_v1): both spellings first, side by side.
    "incoming_name",
    "candidate_name",
    "source",
    "source_code",
    "source_url",
    "matched_name",
    "list",
    "entry_id",
    "certification_id",
    "brand",
    "reason",
  ];
  const parts = preferred
    .filter((key) => sourceData[key] != null && sourceData[key] !== "")
    .map((key) => `${key.replace(/_/g, " ")}: ${String(sourceData[key])}`);
  if (parts.length > 0) return parts.slice(0, 3).join(" · ");
  return JSON.stringify(sourceData).slice(0, 180);
}
