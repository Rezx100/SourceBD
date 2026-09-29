// Admin cross-cutting audit-log explorer (Spec A6). Calls
// public.admin_audit_log_list with action / target_table / actor email
// substring / since / until filters from URL search params. Admin-only;
// middleware gates `/admin/*` and the RPC re-checks role inside its body.

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
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

const AUDIT_COLUMNS: Column<Row>[] = [
  {
    key: "when",
    label: "When",
    render: (r) => (
      <span className="font-mono text-xs text-ink-secondary">
        {formatAdminDateTime(r.created_at)}
      </span>
    ),
  },
  {
    key: "action",
    label: "Action",
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone="active">{humanizeAdminToken(r.action)}</Badge>
        <Tag>{humanizeAdminToken(r.target_table)}</Tag>
      </span>
    ),
  },
  {
    key: "target",
    label: "Target",
    render: (r) => (
      <span className="text-sm font-semibold text-ink-primary">
        {r.target_label || shortId(r.target_id)}
      </span>
    ),
  },
  {
    key: "actor",
    label: "Actor",
    render: (r) => (
      <span className="font-mono text-[12px] text-ink-tertiary">
        {r.actor.email || shortId(r.actor.id)}
        {r.actor.role ? ` · ${humanizeAdminToken(r.actor.role)}` : ""}
      </span>
    ),
  },
];

function AuditHeader({ total }: { total?: number }) {
  return (
    <AdminPageHeader
      kicker="Admin · Audit"
      title="Audit log"
      description={`Every administrative action across suppliers, certifications, users, and sanctions decisions.${typeof total === "number" ? ` ${total} rows.` : ""}`}
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
      <AdminPage maxWidth="5xl">
        <AuditHeader />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load audit log
            {error?.message ? <>: {error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
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
    <AdminPage maxWidth="5xl">
      <AuditHeader total={doc.total} />

      <AdminFilterPanel
        title="Find audit entries"
        description="Filter by action, target, actor, or timestamp range."
      >
          <form
            method="get"
            action="/admin/audit-log"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <AdminField label="Action">
              <select
                name="action"
                defaultValue={action}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                {doc.facets.actions.map((a) => (
                  <option key={a} value={a}>
                    {humanizeAdminToken(a)}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Target table">
              <select
                name="target"
                defaultValue={targetTable}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                {doc.facets.target_tables.map((t) => (
                  <option key={t} value={t}>
                    {humanizeAdminToken(t)}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Actor email contains">
              <input
                type="search"
                name="actor"
                defaultValue={actorEmail}
                placeholder="min 2 chars"
                className={ADMIN_INPUT_CLASS}
              />
            </AdminField>
            <AdminField label="Since (ISO timestamp)">
              <input
                type="text"
                name="since"
                defaultValue={since}
                placeholder="2026-05-01T00:00:00Z"
                className={`${ADMIN_INPUT_CLASS} font-mono text-xs`}
              />
            </AdminField>
            <AdminField label="Until (ISO timestamp)">
              <input
                type="text"
                name="until"
                defaultValue={until}
                placeholder="2026-06-30T23:59:59Z"
                className={`${ADMIN_INPUT_CLASS} font-mono text-xs`}
              />
            </AdminField>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="min-h-[44px] rounded-pill border border-brand-forest bg-brand-forest px-4 text-sm font-semibold text-white hover:bg-brand-forest-mid"
              >
                Apply
              </button>
              <AdminActionLink href="/admin/audit-log">Reset</AdminActionLink>
            </div>
          </form>
      </AdminFilterPanel>

      <AdminPanel
        title="Entries"
        meta={`${doc.total} total · page ${page} / ${totalPages}`}
        padded={false}
      >
          {doc.rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState title="No entries match" />
            </div>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={AUDIT_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.id}
              rowHref={(r) => `/admin/audit-log/${r.id}`}
              caption="Audit log entries"
              className="border-0 shadow-none"
            />
          )}
      </AdminPanel>

      <AdminPagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </AdminPage>
  );
}
