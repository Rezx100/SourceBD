// Admin cross-cutting audit-log explorer (Spec A6). Calls
// public.admin_audit_log_list with action / target_table / actor email
// substring / since / until filters from URL search params. Admin-only;
// middleware gates `/admin/*` and the RPC re-checks role inside its body.

import Link from "next/link";

import {
  AdminColumn,
  AdminFacts,
  AdminHead,
  AdminSection,
  adminFieldClass,
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/data-ui";
import { LedgerVerifyButton } from "@/components/admin/ledger-verify-button";
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

/** The activity record's health (0135): entries, the last seal, the last outside stamp, the last check. */
type Health = {
  entries: number;
  oldest_entry_at: string | null;
  unsealed_entries: number;
  last_seal: { id: number; sealed_through: string; seal_hash: string; sealed_at: string; entry_count: number } | null;
  last_stamp: { seal_id: number; tsa_url: string; tsa_time: string; stamped_at: string; mailbox: string | null; mailed_at: string | null } | null;
  last_verify: { ok: boolean; seals_checked: number; first_broken_seal: number | null; why: string | null; unsealed_entries: number; checked_at: string } | null;
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

/** Six facts about the activity record and the button that re-checks every seal (moderation plan 1e). */
function RecordHealth({ health, error }: { health: Health | null; error: string | null }) {
  const shortHash = (h: string) => `${h.slice(0, 12)}…`;
  return (
    <AdminSection
      title="Activity record"
      description="Every action by every user, written by the database, sealed each hour and stamped by an outside authority each day."
      actions={health ? <LedgerVerifyButton /> : null}
    >
      {health ? (
        <AdminFacts
          rows={[
            { label: "Entries", value: health.entries.toLocaleString() },
            { label: "Waiting for their hour", value: health.unsealed_entries.toLocaleString() },
            {
              label: "Last seal",
              value: health.last_seal
                ? `Through ${formatAdminDateTime(health.last_seal.sealed_through)} · ${health.last_seal.entry_count.toLocaleString()} entries · ${shortHash(health.last_seal.seal_hash)}`
                : "No seal yet",
            },
            {
              label: "Last outside stamp",
              value: health.last_stamp
                ? `${formatAdminDateTime(health.last_stamp.tsa_time)} by ${health.last_stamp.tsa_url}${health.last_stamp.mailed_at ? ` · mailed to ${health.last_stamp.mailbox ?? "the outside mailbox"}` : " · not mailed"}`
                : "No stamp yet",
            },
            {
              label: "Last check",
              value: health.last_verify
                ? health.last_verify.ok
                  ? `Every seal matched (${health.last_verify.seals_checked.toLocaleString()} checked, ${formatAdminDateTime(health.last_verify.checked_at)})`
                  : `Chain broken at seal ${health.last_verify.first_broken_seal ?? "?"}: ${health.last_verify.why ?? "a seal no longer matches"} (${formatAdminDateTime(health.last_verify.checked_at)})`
                : "Never checked",
            },
            { label: "Oldest entry", value: health.oldest_entry_at ? formatAdminDateTime(health.oldest_entry_at) : "None yet" },
          ]}
        />
      ) : (
        <p className="text-sm text-ink-3">The record&apos;s health could not be read{error ? `: ${error}` : ""}. The record itself is unaffected.</p>
      )}
    </AdminSection>
  );
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
  const [{ data, error }, healthRead] = await Promise.all([
    supabase.rpc("admin_audit_log_list", {
      p_action: action || null,
      p_target_table: targetTable || null,
      p_actor_email: actorEmail || null,
      p_since: since || null,
      p_until: until || null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    }),
    // The record's health is beside the log, not instead of it: a failed read says so in a sentence.
    Promise.resolve(supabase.rpc("admin_ledger_health")).then(
      (r) => r as { data: unknown; error: { message: string } | null },
      (e) => ({ data: null, error: { message: e instanceof Error ? e.message : String(e) } }),
    ),
  ]);
  const health = !healthRead.error && healthRead.data && typeof healthRead.data === "object" ? (healthRead.data as Health) : null;
  const healthSection = <RecordHealth health={health} error={healthRead.error?.message ?? null} />;

  if (error || data == null) {
    return (
      <AdminColumn>
        <AuditHeader />
        {healthSection}
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

      {healthSection}

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
