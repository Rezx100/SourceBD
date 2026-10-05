// Admin user roster (Spec A5). Calls public.admin_user_list with role +
// status + search filters driven from URL search params. Admin-only;
// middleware gates `/admin/*` and the RPC re-checks role inside its body.

import Link from "next/link";

import {
  AdminColumn,
  AdminHead,
  AdminSection,
  StatusChip,
  adminFieldClass,
  formatAdminDate,
  humanizeAdminToken,
} from "@/components/admin/data-ui";
import {
  Button,
  ButtonLink,
  Empty,
  Field,
  InlineError,
  Pagination,
  Table,
  TableFrame,
  TableScroll,
  Td,
  Th,
  Tr,
  TypeChip,
  linkClass,
  rowLinkClass,
} from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
      <AdminColumn>
        <UsersHeader />
        <InlineError>
          Could not load users
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </AdminColumn>
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
    <AdminColumn>
      <UsersHeader total={doc.total} />

      <AdminSection title="Find users" description="Search by email or display name, then narrow by role and access status.">
        <form method="get" action="/admin/users" className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field label="Search user">
            {(a) => <input {...a} type="search" name="q" defaultValue={search} placeholder="Email or name" className={adminFieldClass} />}
          </Field>
          <Field label="Role">
            {(a) => (
              <select {...a} name="role" defaultValue={roleFilter} className={adminFieldClass}>
                <option value="">Any</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {humanizeAdminToken(r)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Status">
            {(a) => (
              <select {...a} name="status" defaultValue={status} className={adminFieldClass}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanizeAdminToken(s)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div className="flex items-end">
            <Button type="submit" kind="primary">Apply</Button>
          </div>
        </form>
      </AdminSection>

      <section aria-label="Users" className="flex flex-col gap-2">
        <p className="text-sm text-ink-3">{`${doc.total} total · page ${page} / ${totalPages}`}</p>
        {doc.rows.length === 0 ? (
          <Empty title="No users match">Try clearing the search or choosing a wider status.</Empty>
        ) : (
          <TableFrame>
            <TableScroll>
              <Table aria-label="Users">
                <thead>
                  <tr>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Plan</Th>
                    <Th>Claims</Th>
                    <Th>Activity</Th>
                    <Th>
                      <span className="sr-only">Manage</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {doc.rows.map((r) => (
                    <Tr key={r.user_id}>
                      <Td>
                        <Link href={`/admin/users/${r.user_id}`} className={rowLinkClass}>
                          {r.display_name || r.email}
                        </Link>
                        <span className="block font-mono text-sm text-ink-3 [overflow-wrap:anywhere]">{r.email}</span>
                      </Td>
                      <Td>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <TypeChip>{humanizeAdminToken(r.role)}</TypeChip>
                          {r.is_suspended ? <StatusChip tone="danger">suspended</StatusChip> : null}
                        </span>
                      </Td>
                      <Td>{r.plan_tier ? <TypeChip>{r.plan_tier}</TypeChip> : <span className="text-ink-3">—</span>}</Td>
                      <Td>
                        {r.claimed_supplier ? (
                          <Link href={`/admin/suppliers/${r.claimed_supplier.id}`} className={cn(linkClass, "font-mono text-sm")}>
                            {r.claimed_supplier.company_name}
                          </Link>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </Td>
                      <Td className="text-sm text-ink-3">
                        created {formatAdminDate(r.created_at)}
                        {r.last_sign_in_at ? ` · last ${formatAdminDate(r.last_sign_in_at)}` : " · never"}
                        {` · ${r.audit_count} audit`}
                      </Td>
                      <Td align="right">
                        <ButtonLink href={`/admin/users/${r.user_id}`}>Manage</ButtonLink>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
            <Pagination
              noun="users"
              from={offset + 1}
              to={offset + doc.rows.length}
              total={doc.total}
              page={page}
              pages={totalPages}
              prevHref={page > 1 ? pageHref(page - 1) : undefined}
              nextHref={page < totalPages ? pageHref(page + 1) : undefined}
            />
          </TableFrame>
        )}
      </section>
    </AdminColumn>
  );
}

function UsersHeader({ total }: { total?: number }) {
  return (
    <AdminHead
      title="Users & access"
      lede={`Roles, suspensions, and per-user audit drilldown.${total != null ? ` ${total} accounts.` : ""}`}
    />
  );
}
