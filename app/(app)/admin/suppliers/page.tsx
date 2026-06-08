// Admin supplier list (Spec A2). Calls `public.admin_supplier_list` with
// filters driven from URL search params. Admin-only; middleware gates
// `/admin/*` and the RPC re-checks role inside its body.

import Link from "next/link";

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
  id: string;
  slug: string;
  company_name: string;
  name_display: string | null;
  entity_type: string;
  published: boolean;
  claimed_by: string | null;
  sanctioned_flag: boolean;
  city: string | null;
  district: string | null;
  tier_coverage: number;
  sbi_total: number | null;
  updated_at: string | null;
  has_pending_rescore: boolean;
};

type Doc = { total: number; rows: Row[] };

const PAGE_SIZE = 50;

function asBool(v: string | undefined | null): boolean | null {
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return null;
}

function asInt(v: string | undefined | null): number | null {
  if (v == null || v === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export default async function AdminSuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string): string | undefined => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const search = (get("q") ?? "").trim();
  const entity = get("entity") ?? "";
  const published = asBool(get("published"));
  const claimed = asBool(get("claimed"));
  const sanctioned = asBool(get("sanctioned"));
  const tierMin = asInt(get("tier_min"));
  const page = Math.max(1, asInt(get("page")) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_supplier_list", {
    p_search: search || null,
    p_entity_type: entity || null,
    p_published: published,
    p_claimed: claimed,
    p_sanctioned: sanctioned,
    p_tier_min: tierMin,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader />
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load suppliers
            {error?.message ? <>: {error.message}</> : null}.
          </CardContent>
        </Card>
      </div>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  // Preserve filters on pagination links.
  const baseQuery = new URLSearchParams();
  if (search) baseQuery.set("q", search);
  if (entity) baseQuery.set("entity", entity);
  if (published !== null) baseQuery.set("published", String(published));
  if (claimed !== null) baseQuery.set("claimed", String(claimed));
  if (sanctioned !== null) baseQuery.set("sanctioned", String(sanctioned));
  if (tierMin !== null) baseQuery.set("tier_min", String(tierMin));
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/suppliers?${s}` : "/admin/suppliers";
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader total={doc.total} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardMeta>GET /admin/suppliers</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          <form
            method="get"
            action="/admin/suppliers"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Search (slug / company name)
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="e.g. 1-world-apparel"
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Entity type
              <select
                name="entity"
                defaultValue={entity}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                <option value="factory">factory</option>
                <option value="buying_house">buying_house</option>
                <option value="unknown">unknown</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Published
              <select
                name="published"
                defaultValue={published === null ? "" : String(published)}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                <option value="true">published</option>
                <option value="false">unpublished</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Claimed
              <select
                name="claimed"
                defaultValue={claimed === null ? "" : String(claimed)}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                <option value="true">claimed</option>
                <option value="false">unclaimed</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Sanctioned
              <select
                name="sanctioned"
                defaultValue={sanctioned === null ? "" : String(sanctioned)}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                <option value="true">sanctioned</option>
                <option value="false">clean</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Min Tier 1–3 sources
              <input
                type="number"
                name="tier_min"
                min={0}
                max={20}
                defaultValue={tierMin ?? ""}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              />
            </label>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                className="rounded-pill border border-accent-indigo bg-accent-indigo px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Apply
              </button>
              <Link
                href="/admin/suppliers"
                className="rounded-pill border border-hairline px-3 py-1.5 text-sm text-ink-secondary hover:text-ink-primary"
              >
                Reset
              </Link>
              <Link
                href="/admin/suppliers/import"
                className="ml-auto rounded-pill border border-hairline px-3 py-1.5 text-sm text-ink-secondary hover:text-ink-primary"
              >
                Bulk import →
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suppliers</CardTitle>
          <CardMeta>
            page {page} of {totalPages} · {doc.rows.length} shown ·{" "}
            {doc.total.toLocaleString()} total
          </CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          {doc.rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">
              No suppliers match these filters.
            </p>
          ) : (
            <ResponsiveTable
              mode="priority"
              priorityKeys={["company", "entity", "published", "sanctioned"]}
              columns={SUPPLIER_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.id}
              caption="Suppliers"
            />
          )}

          {totalPages > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-4 flex items-center justify-between text-[12px] text-ink-tertiary"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="rounded-pill border border-hairline px-3 py-1 hover:text-ink-primary"
                >
                  ← Previous
                </Link>
              ) : (
                <span />
              )}
              <span>
                Page {page} / {totalPages}
              </span>
              {page < totalPages ? (
                <Link
                  href={pageHref(page + 1)}
                  className="rounded-pill border border-hairline px-3 py-1 hover:text-ink-primary"
                >
                  Next →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

const SUPPLIER_COLUMNS: Column<Row>[] = [
  {
    key: "company",
    label: "Company",
    render: (r) => (
      <span className="block min-w-0">
        <Link
          href={`/admin/suppliers/${r.id}`}
          className="truncate text-sm font-semibold text-ink-primary hover:underline"
        >
          {r.name_display ?? r.company_name}
        </Link>
        <span className="block truncate text-[12px] text-ink-tertiary">
          <span className="font-mono">{r.slug}</span>
          {r.city || r.district
            ? ` · ${[r.city, r.district].filter(Boolean).join(", ")}`
            : ""}
        </span>
      </span>
    ),
  },
  {
    key: "entity",
    label: "Entity",
    render: (r) => (
      <Badge tone={r.entity_type === "factory" ? "active" : "neutral"}>
        {r.entity_type}
      </Badge>
    ),
  },
  {
    key: "published",
    label: "Published",
    render: (r) =>
      r.published ? (
        <Tag tone="muted">published</Tag>
      ) : (
        <Tag tone="amber">unpublished</Tag>
      ),
  },
  {
    key: "sanctioned",
    label: "Sanctioned",
    render: (r) =>
      r.sanctioned_flag ? <Tag tone="red">sanctioned</Tag> : <span className="text-ink-tertiary">clean</span>,
  },
  {
    key: "claim",
    label: "Claim",
    render: (r) =>
      r.claimed_by ? <Tag tone="muted">claimed</Tag> : <span className="text-ink-tertiary">unclaimed</span>,
  },
  {
    key: "tier",
    label: "Tier 1–3",
    numeric: true,
    render: (r) => (
      <span className="font-mono tabular-nums text-ink-primary">
        {r.tier_coverage}
      </span>
    ),
  },
  {
    key: "sbi",
    label: "SBI",
    numeric: true,
    render: (r) => (
      <span className="font-mono tabular-nums text-ink-primary">
        {r.sbi_total ?? "—"}
      </span>
    ),
  },
  {
    key: "rescore",
    label: "Rescore",
    render: (r) =>
      r.has_pending_rescore ? (
        <Tag tone="amber">rescore queued</Tag>
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
  {
    key: "updated",
    label: "Updated",
    numeric: true,
    render: (r) => (
      <span className="font-mono">
        {r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : "—"}
      </span>
    ),
  },
];

function PageHeader({ total }: { total?: number }) {
  return (
    <header className="flex items-end justify-between gap-3">
      <div>
        <p className="text-[11px] text-ink-tertiary">
          Admin
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Suppliers
        </h1>
        {total != null ? (
          <p className="mt-1 text-sm text-ink-secondary">
            {total.toLocaleString()} suppliers in scope.
          </p>
        ) : null}
      </div>
      <Link
        href="/admin"
        className="rounded-pill border border-hairline px-3 py-1.5 text-[12px] text-ink-tertiary hover:text-ink-primary"
      >
        ← Admin home
      </Link>
    </header>
  );
}
