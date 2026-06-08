// Admin sanctions verification queue (Spec A4). Calls
// `public.admin_sanctions_queue_list` with status/list filters driven
// from URL search params. Admin-only; middleware gates `/admin/*` and
// the RPC re-checks role inside its body.

import Link from "next/link";

import { AdminSanctionsDecideButton } from "@/components/admin-sanctions-decide-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
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
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader />
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load queue
            {error?.message ? <>: {error.message}</> : null}.
          </CardContent>
        </Card>
      </div>
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader total={doc.total} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardMeta>GET /admin/sanctions</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          <form
            method="get"
            action="/admin/sanctions"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Status
              <select
                name="status"
                defaultValue={status}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Sanctions list
              <select
                name="list"
                defaultValue={list}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                {SANCTIONS_LISTS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-pill border border-hairline px-3 py-1.5 text-xs hover:border-accent-indigo hover:text-accent-indigo"
              >
                Apply
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardMeta>
            {doc.total} total · page {page} / {totalPages}
          </CardMeta>
        </CardHeader>
        <CardContent>
          {doc.rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">
              No sanctions hits in this state.
            </p>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={SANCTIONS_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.queue_id}
              caption="Sanctions queue"
            />
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <nav className="flex justify-center gap-2 text-xs">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={pageHref(n)}
              className={`rounded-pill border px-2 py-1 ${
                n === page
                  ? "border-accent-indigo text-accent-indigo"
                  : "border-hairline text-ink-tertiary hover:text-ink-primary"
              }`}
            >
              {n}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
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
        <Tag>{r.supplier.entity_type.replace(/_/g, " ")}</Tag>
        {r.hit.list ? <Badge tone="alert">{r.hit.list}</Badge> : null}
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
        {new Date(r.queue_created_at).toLocaleDateString()}
        {r.reviewed_at
          ? ` · reviewed ${new Date(r.reviewed_at).toLocaleDateString()}`
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

function PageHeader({ total }: { total?: number }) {
  return (
    <header>
      <p className="text-[11px] text-ink-tertiary">
        Admin
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
        Sanctions queue
      </h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Review auto-flagged sanctions matches. Confirm flips the supplier to
        sanctioned with a recorded reason; clear marks the match as a false
        positive with a recorded reason.
        {typeof total === "number" ? ` ${total} total in current filter.` : ""}
      </p>
    </header>
  );
}
