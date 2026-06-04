// Admin user roster (Spec A5). Calls public.admin_user_list with role +
// status + search filters driven from URL search params. Admin-only;
// middleware gates `/admin/*` and the RPC re-checks role inside its body.

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader />
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load users
            {error?.message ? <>: {error.message}</> : null}.
          </CardContent>
        </Card>
      </div>
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader total={doc.total} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardMeta>GET /admin/users</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          <form
            method="get"
            action="/admin/users"
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Search (email / name)
              <input
                type="search"
                name="q"
                defaultValue={search}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Role
              <select
                name="role"
                defaultValue={roleFilter}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
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
          <CardTitle>Users</CardTitle>
          <CardMeta>
            {doc.total} total · page {page} / {totalPages}
          </CardMeta>
        </CardHeader>
        <CardContent>
          {doc.rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">No users match.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {doc.rows.map((r) => (
                <li
                  key={r.user_id}
                  className="flex flex-col gap-2 py-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/users/${r.user_id}`}
                        className="text-sm font-semibold text-ink-primary hover:underline"
                      >
                        {r.display_name || r.email}
                      </Link>
                      <Badge tone={roleTone(r.role)}>{r.role}</Badge>
                      {r.is_suspended ? <Badge tone="alert">suspended</Badge> : null}
                      {r.plan_tier ? <Tag>{r.plan_tier}</Tag> : null}
                    </div>
                    <p className="font-mono text-xs text-ink-tertiary">
                      {r.email}
                    </p>
                    {r.claimed_supplier ? (
                      <p className="text-xs">
                        claims{" "}
                        <Link
                          href={`/admin/suppliers/${r.claimed_supplier.id}`}
                          className="font-mono text-accent-indigo hover:underline"
                        >
                          {r.claimed_supplier.company_name}
                        </Link>{" "}
                        <Tag>{r.claimed_supplier.entity_type.replace(/_/g, " ")}</Tag>
                      </p>
                    ) : null}
                    <p className="text-[11px] text-ink-tertiary">
                      created {new Date(r.created_at).toLocaleString()}
                      {r.last_sign_in_at
                        ? ` · last sign-in ${new Date(r.last_sign_in_at).toLocaleString()}`
                        : " · never signed in"}
                      {` · ${r.audit_count} audit ${r.audit_count === 1 ? "row" : "rows"}`}
                    </p>
                    {r.is_suspended && r.suspended_reason ? (
                      <p className="mt-1 rounded-input border border-hairline bg-bg-l0 p-2 text-xs text-ink-secondary">
                        Suspended: {r.suspended_reason}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href={`/admin/users/${r.user_id}`}
                    className="self-start rounded-pill border border-hairline px-3 py-1 text-xs text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
                  >
                    Manage
                  </Link>
                </li>
              ))}
            </ul>
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

function PageHeader({ total }: { total?: number }) {
  return (
    <header>
      <p className="text-[11px] text-ink-tertiary">
        Admin
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
        Users &amp; access
      </h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Roles, suspensions, per-user audit drilldown.
        {total != null ? ` ${total} accounts.` : ""}
      </p>
    </header>
  );
}
