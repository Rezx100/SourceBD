// Admin supplier list (Spec A2). Calls `public.admin_supplier_list` with
// filters driven from URL search params. Admin-only; middleware gates
// `/admin/*` and the RPC re-checks role inside its body.

import {
  ADMIN_INPUT_CLASS,
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
      <AdminPage>
        <SupplierHeader />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load suppliers
            {error?.message ? <>: {error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
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
    <AdminPage>
      <SupplierHeader total={doc.total} />

      <AdminFilterPanel
        title="Find suppliers"
        description="Search the verified index, jump to common work queues, or narrow by publication and evidence status."
        actions={<AdminActionLink href="/admin/suppliers/import">Bulk import</AdminActionLink>}
      >
        <div className="flex gap-2 overflow-x-auto pb-1 text-[12px]">
          <AdminActionLink href="/admin/queue" className="shrink-0">Needs review</AdminActionLink>
          <AdminActionLink href="/admin/suppliers?published=false&tier_min=1" className="shrink-0">Ready to publish</AdminActionLink>
          <AdminActionLink href="/admin/suppliers?published=true" className="shrink-0">Visible to buyers</AdminActionLink>
          <AdminActionLink href="/admin/suppliers?published=false" className="shrink-0">Not visible</AdminActionLink>
          <AdminActionLink href="/admin/suppliers?sanctioned=true" className="shrink-0">Sanction flagged</AdminActionLink>
          <AdminActionLink href="/admin/suppliers?claimed=true" className="shrink-0">Claimed</AdminActionLink>
        </div>
        <form
          method="get"
          action="/admin/suppliers"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
            <AdminField label="Search supplier">
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="Company name or slug"
                className={ADMIN_INPUT_CLASS}
              />
            </AdminField>
            <AdminField label="Entity type">
              <select
                name="entity"
                defaultValue={entity}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                <option value="factory">Factory</option>
                <option value="buying_house">Buying house</option>
                <option value="unknown">Unknown</option>
              </select>
            </AdminField>
            <AdminField label="Buyer visibility">
              <select
                name="published"
                defaultValue={published === null ? "" : String(published)}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                <option value="true">Visible to buyers</option>
                <option value="false">Not visible</option>
              </select>
            </AdminField>
            <AdminField label="Supplier account">
              <select
                name="claimed"
                defaultValue={claimed === null ? "" : String(claimed)}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                <option value="true">Claimed</option>
                <option value="false">Unclaimed</option>
              </select>
            </AdminField>
            <AdminField label="Sanctions status">
              <select
                name="sanctioned"
                defaultValue={sanctioned === null ? "" : String(sanctioned)}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                <option value="true">Flagged</option>
                <option value="false">Clear</option>
              </select>
            </AdminField>
            <AdminField label="Minimum verified evidence sources">
              <input
                type="number"
                name="tier_min"
                min={0}
                max={20}
                defaultValue={tierMin ?? ""}
                className={ADMIN_INPUT_CLASS}
              />
            </AdminField>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                className="min-h-[44px] rounded-pill border border-brand-forest bg-brand-forest px-4 text-sm font-semibold text-white hover:bg-brand-forest-mid"
              >
                Apply
              </button>
              <AdminActionLink href="/admin/suppliers">Reset</AdminActionLink>
            </div>
          </form>
      </AdminFilterPanel>

      <AdminPanel
        title="Suppliers"
        meta={`Page ${page} of ${totalPages} · ${doc.rows.length} shown · ${doc.total.toLocaleString()} total`}
        padded={false}
      >
          {doc.rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState
                title="No suppliers match these filters"
                description="Try removing one filter or resetting the search."
                action={<AdminActionLink href="/admin/suppliers">Reset filters</AdminActionLink>}
              />
            </div>
          ) : (
            <ResponsiveTable
              mode="priority"
              priorityKeys={["company", "entity", "published", "sanctioned"]}
              columns={SUPPLIER_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.id}
              rowHref={(r) => `/admin/suppliers/${r.id}`}
              caption="Suppliers"
              className="border-0 shadow-none"
            />
          )}

      </AdminPanel>
      <AdminPagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </AdminPage>
  );
}

const SUPPLIER_COLUMNS: Column<Row>[] = [
  {
    key: "company",
    label: "Company",
    render: (r) => (
      <span className="block min-w-0">
        <span className="block truncate text-sm font-semibold text-ink-primary">
          {r.name_display ?? r.company_name}
        </span>
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
        {humanizeAdminToken(r.entity_type)}
      </Badge>
    ),
  },
  {
    key: "published",
    label: "Visibility",
    render: (r) =>
      r.published ? (
        <Tag tone="muted">Visible</Tag>
      ) : (
        <Tag tone="amber">Not visible</Tag>
      ),
  },
  {
    key: "sanctioned",
    label: "Sanctions",
    render: (r) =>
      r.sanctioned_flag ? <Tag tone="red">Flagged</Tag> : <span className="text-ink-tertiary">Clear</span>,
  },
  {
    key: "claim",
    label: "Account",
    render: (r) =>
      r.claimed_by ? <Tag tone="muted">Claimed</Tag> : <span className="text-ink-tertiary">Unclaimed</span>,
  },
  {
    key: "tier",
    label: "Evidence",
    numeric: true,
    render: (r) => (
      <span className="font-mono tabular-nums text-ink-primary">
        {r.tier_coverage}
      </span>
    ),
  },
  {
    key: "sbi",
    label: "Internal score",
    numeric: true,
    render: (r) => (
      <span className="font-mono tabular-nums text-ink-primary">
        {r.sbi_total ?? "—"}
      </span>
    ),
  },
  {
    key: "rescore",
    label: "Score job",
    render: (r) =>
      r.has_pending_rescore ? (
        <Tag tone="amber">Queued</Tag>
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
        {formatAdminDate(r.updated_at)}
      </span>
    ),
  },
];

function SupplierHeader({ total }: { total?: number }) {
  return (
    <AdminPageHeader
      kicker="Admin · Suppliers"
      title="Suppliers"
      description={
        total != null
          ? `${total.toLocaleString()} suppliers in scope. Search, triage publication readiness, and open the full operator workspace from any row.`
          : "Search, triage publication readiness, and open the full supplier operator workspace."
      }
      actions={<AdminActionLink href="/admin">Admin home</AdminActionLink>}
    />
  );
}
