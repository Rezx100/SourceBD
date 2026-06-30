// Admin unified review queue. Lists all verification_queue rows and routes
// specialized queue types to their dedicated moderation flows.

import Link from "next/link";

import { AdminQueueDecideButton } from "@/components/admin-queue-decide-button";
import {
  ADMIN_SELECT_CLASS,
  AdminActionLink,
  AdminEmptyState,
  AdminField,
  AdminFilterPanel,
  AdminPage,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  AdminTabs,
  formatAdminDate,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { Tag } from "@/components/ui/tag";
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
      <AdminPage>
        <QueueHeader />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load review queue
            {error?.message ? <>: {error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
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
    <AdminPage>
      <QueueHeader total={doc.total} />

      <AdminTabs
        label="Review queue types"
        items={[
          {
            href: `/admin/queue${status === "open" ? "" : `?status=${status}`}`,
            label: status === "open" ? "All open" : "All types",
            active: !type,
            count: sumOpen(doc.by_type),
          },
          ...QUEUE_TYPES.map((qt) => {
          const q = new URLSearchParams();
          q.set("type", qt);
          if (status !== "open") q.set("status", status);
          return {
            href: `/admin/queue?${q.toString()}`,
            label: queueLabel(qt),
            active: type === qt,
            count: doc.by_type[qt] ?? 0,
          };
        }),
        ]}
      />

      <AdminFilterPanel
        title="Review state"
        description="Keep the queue focused on open work, or audit reviewed decisions when needed."
      >
          <form method="get" action="/admin/queue" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            {type ? <input type="hidden" name="type" value={type} /> : null}
            <AdminField label="Status" className="sm:min-w-[220px]">
              <select
                name="status"
                defaultValue={status}
                className={ADMIN_SELECT_CLASS}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s)}
                  </option>
                ))}
              </select>
            </AdminField>
            <button
              type="submit"
              className="min-h-[44px] rounded-pill border border-brand-forest bg-brand-forest px-4 text-sm font-semibold text-white hover:bg-brand-forest-mid"
            >
              Apply
            </button>
            <AdminActionLink href="/admin/queue">Reset</AdminActionLink>
          </form>
      </AdminFilterPanel>

      <AdminPanel
        title={type ? queueLabel(type) : "Review queue"}
        meta={`${doc.total.toLocaleString()} total · page ${page} / ${totalPages}`}
        padded={false}
      >
          {doc.rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState
                title="No review items match this filter"
                description="Switch queue type or review state to find more work."
                action={<AdminActionLink href="/admin/queue">Back to open queue</AdminActionLink>}
              />
            </div>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={QUEUE_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.queue_id}
              caption="Admin review queue"
              className="border-0 shadow-none"
            />
          )}
      </AdminPanel>

      <AdminPagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </AdminPage>
  );
}

const QUEUE_COLUMNS: Column<Row>[] = [
  {
    key: "item",
    label: "Review item",
    render: (r) => (
      <span className="block min-w-0">
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone="neutral">{queueLabel(r.queue_type)}</Badge>
          {r.reviewed_at ? (
            <Tag tone="muted">{r.admin_action ?? "reviewed"}</Tag>
          ) : (
            <Tag tone="amber">open</Tag>
          )}
        </span>
        <span className="mt-1 block text-[12px] text-ink-tertiary">
          Queued {formatAdminDate(r.created_at)}
          {confidenceValue(r.confidence) != null
            ? ` · confidence ${confidenceValue(r.confidence)?.toFixed(2)}`
            : ""}
        </span>
      </span>
    ),
  },
  {
    key: "supplier",
    label: "Supplier",
    render: (r) =>
      r.supplier ? (
        <span className="block">
          <Link
            href={`/admin/suppliers/${r.supplier.id}`}
            className="font-semibold text-ink-primary hover:underline"
          >
            {r.supplier.name_display ?? r.supplier.company_name}
          </Link>
          <span className="block text-[12px] text-ink-tertiary">
            {r.supplier.entity_type.replace(/_/g, " ")}
            {[r.supplier.city, r.supplier.district].filter(Boolean).length
              ? ` · ${[r.supplier.city, r.supplier.district].filter(Boolean).join(", ")}`
              : ""}
          </span>
        </span>
      ) : (
        <span className="text-ink-tertiary">
          {r.supplier_b_name ?? "No linked supplier"}
        </span>
      ),
  },
  {
    key: "readiness",
    label: "Readiness",
    render: (r) =>
      r.supplier ? (
        <span className="flex flex-wrap gap-1.5">
          <Tag tone={r.supplier.published ? "muted" : "amber"}>
            {r.supplier.published ? "Visible to buyers" : "Not visible"}
          </Tag>
          <Tag tone={r.supplier.tier_coverage > 0 ? "muted" : "amber"}>
            {r.supplier.tier_coverage} evidence sources
          </Tag>
        </span>
      ) : (
        <span className="text-ink-tertiary">Needs matching</span>
      ),
  },
  {
    key: "details",
    label: "Evidence",
    render: (r) => (
      <span className="block max-w-md text-[12px] text-ink-secondary">
        {sourceSummary(r.source_data)}
      </span>
    ),
  },
  {
    key: "action",
    label: "",
    numeric: true,
    render: (r) => {
      if (r.reviewed_at) return <span className="text-ink-tertiary">Done</span>;
      if (r.queue_type === "cert_doc_review") {
        return (
          <Link
            href="/admin/certifications"
            className="inline-flex h-[44px] items-center rounded-pill border border-hairline px-4 text-xs font-semibold text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
          >
            Open certs
          </Link>
        );
      }
      if (r.queue_type === "sanctions_hit") {
        return (
          <Link
            href="/admin/sanctions"
            className="inline-flex h-[44px] items-center rounded-pill border border-hairline px-4 text-xs font-semibold text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
          >
            Open sanctions
          </Link>
        );
      }
      return (
        <AdminQueueDecideButton
          queueId={r.queue_id}
          label={`${queueLabel(r.queue_type)} review`}
        />
      );
    },
  },
];

function QueueHeader({ total }: { total?: number }) {
  return (
    <AdminPageHeader
      kicker="Admin · Review"
      title="Review queue"
      description={
        typeof total === "number"
          ? `${total.toLocaleString()} review items in the current filter. Work the queue by type, open the supplier, and close generic review rows with an audit note.`
          : "Work pending verification, matching, certification, and sanctions review items."
      }
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
