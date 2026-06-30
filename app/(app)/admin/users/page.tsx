// Admin user roster (Spec A5). Calls public.admin_user_list with role +
// status + search filters driven from URL search params. Admin-only;
// middleware gates `/admin/*` and the RPC re-checks role inside its body.

import Link from "next/link";

import {
  ADMIN_INPUT_CLASS,
  ADMIN_SELECT_CLASS,
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
  user_id: string;
  email: string;
  display_name: string | null;
  role: "buyer" | "supplier" | "admin";
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  plan_tier: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  claimed_supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
  } | null;
  audit_count: number;
};

type Doc = { total: number; rows: Row[] };

const PAGE_SIZE = 50;

const ROLES = ["buyer", "supplier", "admin"] as const;
const STATUSES = ["active", "suspended", "all"] as const;
type Status = (typeof STATUSES)[number];

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

function roleTone(r: Row["role"]): "neutral" | "active" | "alert" {
  if (r === "admin") return "alert";
  if (r === "supplier") return "active";
  return "neutral";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = asStr(sp.status) || "all";
  const status: Status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as Status)
    : "all";
  const roleFilter = asStr(sp.role);
  const search = asStr(sp.q);
  const page = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_user_list", {
    p_search: search || null,
    p_role: (ROLES as readonly string[]).includes(roleFilter)
      ? roleFilter
      : null,
    p_status: status,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <AdminPage maxWidth="5xl">
        <UsersHeader />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load users
            {error?.message ? <>: {error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (status !== "all") baseQuery.set("status", status);
  if (roleFilter) baseQuery.set("role", roleFilter);
  if (search) baseQuery.set("q", search);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/users?${s}` : "/admin/users";
  };

  return (
    <AdminPage maxWidth="5xl">
      <UsersHeader total={doc.total} />

      <AdminFilterPanel
        title="Find users"
        description="Search by email or display name, then narrow by role and access status."
      >
          <form
            method="get"
            action="/admin/users"
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <AdminField label="Search user">
              <input
                type="search"
                name="q"
                defaultValue={search}
                placeholder="Email or name"
                className={ADMIN_INPUT_CLASS}
              />
            </AdminField>
            <AdminField label="Role">
              <select
                name="role"
                defaultValue={roleFilter}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {humanizeAdminToken(r)}
                  </option>
                ))}
              </select>
            </AdminField>
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
        title="Users"
        meta={`${doc.total} total · page ${page} / ${totalPages}`}
        padded={false}
      >
          {doc.rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState
                title="No users match"
                description="Try clearing the search or choosing a wider status."
              />
            </div>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={USER_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.user_id}
              caption="Users"
              className="border-0 shadow-none"
            />
          )}
      </AdminPanel>

      <AdminPagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </AdminPage>
  );
}

const USER_COLUMNS: Column<Row>[] = [
  {
    key: "user",
    label: "User",
    render: (r) => (
      <span className="block min-w-0">
        <Link
          href={`/admin/users/${r.user_id}`}
          className="text-sm font-semibold text-ink-primary hover:underline"
        >
          {r.display_name || r.email}
        </Link>
        <span className="block font-mono text-xs text-ink-tertiary">
          {r.email}
        </span>
      </span>
    ),
  },
  {
    key: "role",
    label: "Role",
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone={roleTone(r.role)}>{humanizeAdminToken(r.role)}</Badge>
        {r.is_suspended ? <Badge tone="alert">suspended</Badge> : null}
      </span>
    ),
  },
  {
    key: "plan",
    label: "Plan",
    render: (r) => (r.plan_tier ? <Tag>{r.plan_tier}</Tag> : "—"),
  },
  {
    key: "claims",
    label: "Claims",
    render: (r) =>
      r.claimed_supplier ? (
        <Link
          href={`/admin/suppliers/${r.claimed_supplier.id}`}
          className="font-mono text-[12px] text-accent-indigo hover:underline"
        >
          {r.claimed_supplier.company_name}
        </Link>
      ) : (
        "—"
      ),
  },
  {
    key: "activity",
    label: "Activity",
    render: (r) => (
      <span className="text-[11px] text-ink-tertiary">
        created {formatAdminDate(r.created_at)}
        {r.last_sign_in_at
          ? ` · last ${formatAdminDate(r.last_sign_in_at)}`
          : " · never"}
        {` · ${r.audit_count} audit`}
      </span>
    ),
  },
  {
    key: "manage",
    label: "",
    numeric: true,
    render: (r) => (
      <Link
        href={`/admin/users/${r.user_id}`}
        className="inline-flex h-[44px] items-center rounded-pill border border-hairline px-4 text-xs text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
      >
        Manage
      </Link>
    ),
  },
];

function UsersHeader({ total }: { total?: number }) {
  return (
    <AdminPageHeader
      kicker="Admin · Access"
      title="Users & access"
      description={`Roles, suspensions, and per-user audit drilldown.${total != null ? ` ${total} accounts.` : ""}`}
    />
  );
}
