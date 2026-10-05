// Admin cross-cutting audit-log explorer (Spec A6). Calls
// public.admin_audit_log_list with action / target_table / actor email
// substring / since / until filters from URL search params. Admin-only;
// middleware gates `/admin/*` and the RPC re-checks role inside its body.

import Link from "next/link";

import {
  AdminColumn,
  AdminHead,
  AdminSection,
  adminFieldClass,
  formatAdminDateTime,
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
  rowLinkClass,
} from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  created_at: string;
  action: string;
  target_table: string;
  target_id: string | null;
  target_label: string | null;
  patch: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  actor: { id: string; email: string | null; role: string | null };
};

type Doc = {
  total: number;
  rows: Row[];
  facets: { actions: string[]; target_tables: string[] };
};

const PAGE_SIZE = 50;

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

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 8);
}

function AuditHeader({ total }: { total?: number }) {
  return (
    <AdminHead
      title="Audit log"
      lede={`Every administrative action across suppliers, certifications, users, and sanctions decisions.${typeof total === "number" ? ` ${total} rows.` : ""}`}
    />
  );
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const action = asStr(sp.action);
  const targetTable = asStr(sp.target);
  const actorEmail = asStr(sp.actor);
  const since = asStr(sp.since);
  const until = asStr(sp.until);
  const page = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_audit_log_list", {
    p_action: action || null,
    p_target_table: targetTable || null,
    p_actor_email: actorEmail || null,
    p_since: since || null,
    p_until: until || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <AdminColumn>
        <AuditHeader />
        <InlineError>
          Could not load audit log
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </AdminColumn>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (action) baseQuery.set("action", action);
  if (targetTable) baseQuery.set("target", targetTable);
  if (actorEmail) baseQuery.set("actor", actorEmail);
  if (since) baseQuery.set("since", since);
  if (until) baseQuery.set("until", until);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/audit-log?${s}` : "/admin/audit-log";
  };

  return (
    <AdminColumn>
      <AuditHeader total={doc.total} />

      <AdminSection title="Find audit entries" description="Filter by action, target, actor, or timestamp range.">
        <form method="get" action="/admin/audit-log" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Action">
            {(a) => (
              <select {...a} name="action" defaultValue={action} className={adminFieldClass}>
                <option value="">Any</option>
                {doc.facets.actions.map((x) => (
                  <option key={x} value={x}>
                    {humanizeAdminToken(x)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Target table">
            {(a) => (
              <select {...a} name="target" defaultValue={targetTable} className={adminFieldClass}>
                <option value="">Any</option>
                {doc.facets.target_tables.map((t) => (
                  <option key={t} value={t}>
                    {humanizeAdminToken(t)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Actor email contains">
            {(a) => <input {...a} type="search" name="actor" defaultValue={actorEmail} placeholder="min 2 chars" className={adminFieldClass} />}
          </Field>
          <Field label="Since (ISO timestamp)">
            {(a) => <input {...a} type="text" name="since" defaultValue={since} placeholder="2026-05-01T00:00:00Z" className={cn(adminFieldClass, "font-mono text-sm")} />}
          </Field>
          <Field label="Until (ISO timestamp)">
            {(a) => <input {...a} type="text" name="until" defaultValue={until} placeholder="2026-06-30T23:59:59Z" className={cn(adminFieldClass, "font-mono text-sm")} />}
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" kind="primary">Apply</Button>
            <ButtonLink href="/admin/audit-log">Reset</ButtonLink>
          </div>
        </form>
      </AdminSection>

      <section aria-label="Entries" className="flex flex-col gap-2">
        <p className="text-sm text-ink-3">{`${doc.total} total · page ${page} / ${totalPages}`}</p>
        {doc.rows.length === 0 ? (
          <Empty title="No entries match" />
        ) : (
          <TableFrame>
            <TableScroll>
              <Table aria-label="Audit log entries">
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Action</Th>
                    <Th>Target</Th>
                    <Th>Actor</Th>
                  </tr>
                </thead>
                <tbody>
                  {doc.rows.map((r) => (
                    <Tr key={r.id}>
                      <Td className="whitespace-nowrap font-mono text-sm">{formatAdminDateTime(r.created_at)}</Td>
                      <Td>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <TypeChip>{humanizeAdminToken(r.action)}</TypeChip>
                          <TypeChip>{humanizeAdminToken(r.target_table)}</TypeChip>
                        </span>
                      </Td>
                      <Td>
                        <Link href={`/admin/audit-log/${r.id}`} className={rowLinkClass}>
                          {r.target_label || shortId(r.target_id)}
                        </Link>
                      </Td>
                      <Td className="font-mono text-sm text-ink-3">
                        {r.actor.email || shortId(r.actor.id)}
                        {r.actor.role ? ` · ${humanizeAdminToken(r.actor.role)}` : ""}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableScroll>
            <Pagination
              noun="entries"
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
