// Admin sanctions verification queue (Spec A4). Calls
// `public.admin_sanctions_queue_list` with status/list filters driven
// from URL search params. Admin-only; middleware gates `/admin/*` and
// the RPC re-checks role inside its body.

import Link from "next/link";

import { AdminSanctionsDecideButton } from "@/components/admin-sanctions-decide-button";
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
  formatAdminDate,
  humanizeAdminToken,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  queue_id: string;
  queue_created_at: string;
  reviewed_at: string | null;
  admin_action: string | null;
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    sanctioned_flag: boolean;
    sanctioned_reason: string | null;
    sanctions_cleared: boolean;
  };
  hit: {
    list: string | null;
    matched_name: string | null;
    match_score: number | string | null;
    entry_id: string | null;
    entity_name: string | null;
    source_url: string | null;
    listed_date: string | null;
  };
};

type Doc = { total: number; rows: Row[] };

const PAGE_SIZE = 50;

const STATUSES = ["open", "reviewed", "all"] as const;
type Status = (typeof STATUSES)[number];

const SANCTIONS_LISTS = [
  "uflpa",
  "us_wro",
  "ofac_sdn",
  "uk_ofsi",
  "eu_sanctions",
  "ilab_tvpra",
] as const;

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

export default async function AdminSanctionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = asStr(sp.status) || "open";
  const status: Status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as Status)
    : "open";
  const list = asStr(sp.list);
  const page = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_sanctions_queue_list", {
    p_status: status,
    p_list: list || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <AdminPage maxWidth="5xl">
        <SanctionsHeader />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load queue
            {error?.message ? <>: {error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (status !== "open") baseQuery.set("status", status);
  if (list) baseQuery.set("list", list);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/sanctions?${s}` : "/admin/sanctions";
  };

  return (
    <AdminPage maxWidth="5xl">
      <SanctionsHeader total={doc.total} />

      <AdminFilterPanel
        title="Find sanctions reviews"
        description="Filter screening hits by review state and sanctions list."
      >
          <form
            method="get"
            action="/admin/sanctions"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <AdminField label="Status">
              <select
                name="status"
                defaultValue={status}
                className={ADMIN_SELECT_CLASS}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanizeAdminToken(s)}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Sanctions list">
              <select
                name="list"
                defaultValue={list}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                {SANCTIONS_LISTS.map((k) => (
                  <option key={k} value={k}>
                    {humanizeAdminToken(k)}
                  </option>
                ))}
              </select>
            </AdminField>
            <div className="flex items-end">
              <button
                type="submit"
                className="min-h-[44px] rounded-pill border border-brand-forest bg-brand-forest px-4 text-sm font-semibold text-white hover:bg-brand-forest-mid"
              >
                Apply
              </button>
            </div>
          </form>
      </AdminFilterPanel>

      <AdminPanel
        title="Sanctions queue"
        meta={`${doc.total} total · page ${page} / ${totalPages}`}
        padded={false}
      >
          {doc.rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState
                title="No sanctions hits in this state"
                description="Try a different status or sanctions list."
              />
            </div>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={SANCTIONS_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.queue_id}
              caption="Sanctions queue"
              className="border-0 shadow-none"
            />
          )}
      </AdminPanel>
      <AdminPagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </AdminPage>
  );
}

function scoreOf(raw: number | string | null): number | null {
  if (raw == null) return null;
  const n = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
  return Number.isFinite(n) ? n : null;
}

const SANCTIONS_COLUMNS: Column<Row>[] = [
  {
    key: "supplier",
    label: "Supplier",
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/admin/suppliers/${r.supplier.id}`}
          className="text-sm font-semibold text-ink-primary hover:underline"
        >
          {r.supplier.company_name}
        </Link>
        <Tag>{humanizeAdminToken(r.supplier.entity_type)}</Tag>
        {r.hit.list ? <Badge tone="alert">{humanizeAdminToken(r.hit.list)}</Badge> : null}
        {r.supplier.sanctioned_flag ? (
          <Badge tone="alert">sanctioned</Badge>
        ) : r.supplier.sanctions_cleared ? (
          <Badge tone="success">cleared</Badge>
        ) : null}
        {r.admin_action ? <Tag>{r.admin_action}</Tag> : null}
      </span>
    ),
  },
  {
    key: "match",
    label: "Match",
    render: (r) => {
      const score = scoreOf(r.hit.match_score);
      return (
        <span className="block text-xs text-ink-tertiary">
          <span className="font-mono">
            {r.hit.matched_name ?? r.hit.entity_name ?? "—"}
          </span>
          {score != null ? ` · score ${score.toFixed(3)}` : ""}
          {r.hit.listed_date ? ` · listed ${r.hit.listed_date}` : ""}
          {r.supplier.sanctioned_reason ? (
            <span className="block text-ink-secondary">
              Reason: {r.supplier.sanctioned_reason}
            </span>
          ) : null}
        </span>
      );
    },
  },
  {
    key: "source",
    label: "Source",
    render: (r) =>
      r.hit.source_url ? (
        <a
          href={r.hit.source_url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-accent-indigo hover:underline"
        >
          view
        </a>
      ) : (
        "—"
      ),
  },
  {
    key: "meta",
    label: "Queued",
    render: (r) => (
      <span className="block text-[11px] text-ink-tertiary">
        {formatAdminDate(r.queue_created_at)}
        {r.reviewed_at
          ? ` · reviewed ${formatAdminDate(r.reviewed_at)}`
          : ""}
      </span>
    ),
  },
  {
    key: "action",
    label: "",
    numeric: true,
    render: (r) =>
      r.reviewed_at == null ? (
        <AdminSanctionsDecideButton
          queueId={r.queue_id}
          label={`${r.supplier.company_name}${r.hit.list ? ` · ${r.hit.list}` : ""}`}
        />
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
];

function SanctionsHeader({ total }: { total?: number }) {
  return (
    <AdminPageHeader
      kicker="Admin · Sanctions"
      title="Sanctions queue"
      description={`Review auto-flagged sanctions matches. Confirm records a sanctioned supplier; clear records a false positive.${typeof total === "number" ? ` ${total} total in current filter.` : ""}`}
      actions={<AdminActionLink href="/admin/queue?type=sanctions_hit">Review hub</AdminActionLink>}
    />
  );
}
