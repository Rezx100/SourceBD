// Admin cross-cutting audit-log explorer (Spec A6). Calls
// public.admin_audit_log_list with action / target_table / actor email
// substring / since / until filters from URL search params. Admin-only;
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

function targetHref(table: string, id: string | null): string | null {
  if (!id) return null;
  if (table === "suppliers") return `/admin/suppliers/${id}`;
  if (table === "profiles") return `/admin/users/${id}`;
  if (table === "certifications") return `/admin/certifications`;
  return null;
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 8);
}

function PageHeader({ total }: { total?: number }) {
  return (
    <header>
      <p className="text-[11px] text-ink-tertiary">
        Admin · audit log
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
        Audit log
      </h1>
      <p className="mt-1 text-sm text-ink-secondary">
        Every administrative action across suppliers, certifications, users, and
        sanctions decisions. {typeof total === "number" ? `${total} rows.` : null}
      </p>
    </header>
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
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader />
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load audit log
            {error?.message ? <>: {error.message}</> : null}.
          </CardContent>
        </Card>
      </div>
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
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader total={doc.total} />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardMeta>GET /admin/audit-log</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          <form
            method="get"
            action="/admin/audit-log"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Action
              <select
                name="action"
                defaultValue={action}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                {doc.facets.actions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Target table
              <select
                name="target"
                defaultValue={targetTable}
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              >
                <option value="">Any</option>
                {doc.facets.target_tables.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Actor email contains
              <input
                type="search"
                name="actor"
                defaultValue={actorEmail}
                placeholder="min 2 chars"
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 text-sm outline-none focus:border-accent-indigo"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Since (ISO timestamp)
              <input
                type="text"
                name="since"
                defaultValue={since}
                placeholder="2026-05-01T00:00:00Z"
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 font-mono text-xs outline-none focus:border-accent-indigo"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-ink-secondary">
              Until (ISO timestamp)
              <input
                type="text"
                name="until"
                defaultValue={until}
                placeholder="2026-06-30T23:59:59Z"
                className="rounded-input border border-hairline bg-bg-l0 px-2 py-1.5 font-mono text-xs outline-none focus:border-accent-indigo"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="rounded-pill border border-hairline px-3 py-1.5 text-xs hover:border-accent-indigo hover:text-accent-indigo"
              >
                Apply
              </button>
              <Link
                href="/admin/audit-log"
                className="rounded-pill border border-hairline px-3 py-1.5 text-xs text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
              >
                Reset
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
          <CardMeta>
            {doc.total} total · page {page} / {totalPages}
          </CardMeta>
        </CardHeader>
        <CardContent>
          {doc.rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">No entries match.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {doc.rows.map((r) => {
                const href = targetHref(r.target_table, r.target_id);
                return (
                  <li key={r.id} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/audit-log/${r.id}`}
                        className="font-mono text-xs text-accent-indigo hover:underline"
                      >
                        {new Date(r.created_at).toLocaleString()}
                      </Link>
                      <Badge tone="active">{r.action}</Badge>
                      <Tag>{r.target_table}</Tag>
                      {href ? (
                        <Link
                          href={href}
                          className="text-sm font-semibold text-ink-primary hover:underline"
                        >
                          {r.target_label || shortId(r.target_id)}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-ink-primary">
                          {r.target_label || shortId(r.target_id)}
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-ink-tertiary">
                      by {r.actor.email || shortId(r.actor.id)}
                      {r.actor.role ? ` · ${r.actor.role}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between text-xs">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-pill border border-hairline px-3 py-1.5 text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
            >
              ← Prev
            </Link>
          ) : (
            <span />
          )}
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-pill border border-hairline px-3 py-1.5 text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
