// Admin user drilldown (Spec A5). Calls admin_user_get + admin_user_audit
// and mounts the AdminUserEditForm island for role/suspension mutations.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminUserEditForm } from "@/components/admin-user-edit-form";
import {
  AdminColumn,
  AdminFacts,
  AdminHead,
  AdminRows,
  AdminSection,
  JsonBlock,
  StatusChip,
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/data-ui";
import { ButtonLink, InlineError, TypeChip, linkClass } from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
      <AdminColumn narrow>
        <div>
          <ButtonLink href="/admin/users">Back to users</ButtonLink>
        </div>
        <InlineError>
          Could not load user
          {userErr?.message ? <>: {userErr.message}</> : null}.
        </InlineError>
      </AdminColumn>
    );
  }

  const u = userData as UserDoc;
  const audit = (auditData as AuditDoc | null) ?? { total: 0, rows: [] };

  return (
    <AdminColumn narrow>
      <AdminHead
        title={u.display_name || u.email}
        lede={<span className="font-mono text-sm">{u.email}</span>}
        actions={<ButtonLink href="/admin/users">Back to users</ButtonLink>}
      />

      <AdminSection title="Account" meta={`id ${u.user_id}`}>
        <div className="flex flex-col gap-4 text-base">
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip>{humanizeAdminToken(u.role)}</TypeChip>
            {u.is_suspended ? <StatusChip tone="danger">suspended</StatusChip> : null}
            {u.plan_tier ? <TypeChip>{u.plan_tier}</TypeChip> : null}
          </div>
          <AdminFacts
            rows={[
              { label: "Created", value: formatAdminDateTime(u.created_at), mono: true },
              { label: "Last sign-in", value: u.last_sign_in_at ? formatAdminDateTime(u.last_sign_in_at) : "Never signed in", mono: true },
            ]}
          />
          {u.claimed_supplier ? (
            <p className="flex flex-wrap items-center gap-2 text-ink">
              Claims{" "}
              <Link href={`/admin/suppliers/${u.claimed_supplier.id}`} className={cn(linkClass, "font-mono text-sm")}>
                {u.claimed_supplier.company_name}
              </Link>{" "}
              <TypeChip>{humanizeAdminToken(u.claimed_supplier.entity_type)}</TypeChip>
            </p>
          ) : (
            <p className="text-ink-3">No claimed supplier.</p>
          )}
          {u.is_suspended ? (
            <div className="rounded-sm border border-line bg-subtle p-3 text-sm text-ink-2">
              <p>
                Suspended {u.suspended_at ? formatAdminDateTime(u.suspended_at) : "—"}{" "}
                {u.suspended_by_email ? `by ${u.suspended_by_email}` : ""}
              </p>
              {u.suspended_reason ? <p className="mt-1">Reason: {u.suspended_reason}</p> : null}
            </div>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection title="Manage" description="Change role, suspension status, and plan tier for this account.">
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
      </AdminSection>

      <AdminSection title="Audit history" meta={`${audit.total} rows · most recent first`} flush>
        {audit.rows.length === 0 ? (
          <p className="p-4 text-base text-ink-3">No audit rows yet.</p>
        ) : (
          <AdminRows>
            {audit.rows.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-ink-3">{formatAdminDateTime(row.created_at)}</span>
                  <TypeChip>{row.action}</TypeChip>
                  <TypeChip>{humanizeAdminToken(row.direction)}</TypeChip>
                  <span className="text-ink-2">by {row.actor_email ?? row.actor_id}</span>
                </div>
                {row.patch ? <JsonBlock value={row.patch} className="p-2" /> : null}
              </li>
            ))}
          </AdminRows>
        )}
      </AdminSection>
    </AdminColumn>
  );
}
