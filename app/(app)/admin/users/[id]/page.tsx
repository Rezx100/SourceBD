// Admin user drilldown (Spec A5). Calls admin_user_get + admin_user_audit
// and mounts the AdminUserEditForm island for role/suspension mutations.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminUserEditForm } from "@/components/admin-user-edit-form";
import {
  AdminActionLink,
  AdminKeyValueList,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type UserDoc = {
  user_id: string;
  email: string;
  display_name: string | null;
  role: "buyer" | "supplier" | "admin";
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_by: string | null;
  suspended_by_email: string | null;
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

type AuditRow = {
  id: string;
  created_at: string;
  actor_id: string;
  actor_email: string | null;
  action: string;
  target_table: string;
  target_id: string | null;
  patch: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  direction: "target" | "actor";
};

type AuditDoc = { total: number; rows: AuditRow[] };

function roleTone(r: UserDoc["role"]): "neutral" | "active" | "alert" {
  if (r === "admin") return "alert";
  if (r === "supplier") return "active";
  return "neutral";
}

export default async function AdminUserDrilldownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: userData, error: userErr }, { data: auditData }, { data: authData }] =
    await Promise.all([
      supabase.rpc("admin_user_get", { p_user_id: id }),
      supabase.rpc("admin_user_audit", {
        p_user_id: id,
        p_direction: "both",
        p_limit: 50,
        p_offset: 0,
      }),
      supabase.auth.getUser(),
    ]);

  if (userErr || userData == null) {
    if (userErr?.message?.toLowerCase().includes("user not found")) {
      notFound();
    }
    return (
      <AdminPage maxWidth="4xl">
        <AdminActionLink href="/admin/users">Back to users</AdminActionLink>
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load user
            {userErr?.message ? <>: {userErr.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
    );
  }

  const u = userData as UserDoc;
  const audit = (auditData as AuditDoc | null) ?? { total: 0, rows: [] };

  return (
    <AdminPage maxWidth="4xl">
      <AdminPageHeader
        kicker="Admin · User"
        title={u.display_name || u.email}
        description={<span className="font-mono text-xs">{u.email}</span>}
        actions={<AdminActionLink href="/admin/users">Back to users</AdminActionLink>}
      />

      <AdminPanel title="Account" meta={`id ${u.user_id}`}>
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={roleTone(u.role)}>{humanizeAdminToken(u.role)}</Badge>
            {u.is_suspended ? <Badge tone="alert">suspended</Badge> : null}
            {u.plan_tier ? <Tag>{u.plan_tier}</Tag> : null}
          </div>
          <AdminKeyValueList
            rows={[
              { label: "Created", value: formatAdminDateTime(u.created_at), mono: true },
              { label: "Last sign-in", value: u.last_sign_in_at ? formatAdminDateTime(u.last_sign_in_at) : "Never signed in", mono: true },
            ]}
          />
          {u.claimed_supplier ? (
            <p>
              Claims{" "}
              <Link
                href={`/admin/suppliers/${u.claimed_supplier.id}`}
                className="font-mono text-accent-indigo hover:underline"
              >
                {u.claimed_supplier.company_name}
              </Link>{" "}
              <Tag>{humanizeAdminToken(u.claimed_supplier.entity_type)}</Tag>
            </p>
          ) : (
            <p className="text-ink-tertiary">No claimed supplier.</p>
          )}
          {u.is_suspended ? (
            <div className="rounded-input border border-hairline bg-bg-l0 p-3 text-xs text-ink-secondary">
              <p>
                Suspended {u.suspended_at ? formatAdminDateTime(u.suspended_at) : "—"}{" "}
                {u.suspended_by_email ? `by ${u.suspended_by_email}` : ""}
              </p>
              {u.suspended_reason ? (
                <p className="mt-1">Reason: {u.suspended_reason}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </AdminPanel>

      <AdminPanel
        title="Manage"
        description="Change role, suspension status, and plan tier for this account."
      >
          <AdminUserEditForm
            userId={u.user_id}
            initialRole={u.role}
            initialSuspended={u.is_suspended}
            initialReason={u.suspended_reason}
            initialPlan={
              (u.plan_tier === "growth" || u.plan_tier === "enterprise"
                ? u.plan_tier
                : "starter") as "starter" | "growth" | "enterprise"
            }
            isSelf={authData?.user?.id === u.user_id}
          />
      </AdminPanel>

      <AdminPanel
        title="Audit history"
        meta={`${audit.total} rows · most recent first`}
      >
          {audit.rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">No audit rows yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {audit.rows.map((row) => (
                <li key={row.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-ink-tertiary">
                      {formatAdminDateTime(row.created_at)}
                    </span>
                    <Tag>{row.action}</Tag>
                    <Tag>{humanizeAdminToken(row.direction)}</Tag>
                    <span className="text-ink-secondary">
                      by {row.actor_email ?? row.actor_id}
                    </span>
                  </div>
                  {row.patch ? (
                    <pre className="overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-2 font-mono text-[11px] text-ink-secondary">
                      {JSON.stringify(row.patch, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
      </AdminPanel>
    </AdminPage>
  );
}
