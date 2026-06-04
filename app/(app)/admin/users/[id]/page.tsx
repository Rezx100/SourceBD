// Admin user drilldown (Spec A5). Calls admin_user_get + admin_user_audit
// and mounts the AdminUserEditForm island for role/suspension mutations.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminUserEditForm } from "@/components/admin-user-edit-form";
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
      <div className="mx-auto max-w-3xl space-y-6">
        <p>
          <Link
            href="/admin/users"
            className="font-mono text-xs text-accent-indigo hover:underline"
          >
            ← Users
          </Link>
        </p>
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load user
            {userErr?.message ? <>: {userErr.message}</> : null}.
          </CardContent>
        </Card>
      </div>
    );
  }

  const u = userData as UserDoc;
  const audit = (auditData as AuditDoc | null) ?? { total: 0, rows: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p>
          <Link
            href="/admin/users"
            className="font-mono text-xs text-accent-indigo hover:underline"
          >
            ← Users
          </Link>
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Admin · user
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          {u.display_name || u.email}
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-tertiary">{u.email}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardMeta>id {u.user_id}</CardMeta>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={roleTone(u.role)}>{u.role}</Badge>
            {u.is_suspended ? <Badge tone="alert">suspended</Badge> : null}
            {u.plan_tier ? <Tag>{u.plan_tier}</Tag> : null}
          </div>
          <p className="text-ink-secondary">
            created {new Date(u.created_at).toLocaleString()}
            {u.last_sign_in_at
              ? ` · last sign-in ${new Date(u.last_sign_in_at).toLocaleString()}`
              : " · never signed in"}
          </p>
          {u.claimed_supplier ? (
            <p>
              Claims{" "}
              <Link
                href={`/admin/suppliers/${u.claimed_supplier.id}`}
                className="font-mono text-accent-indigo hover:underline"
              >
                {u.claimed_supplier.company_name}
              </Link>{" "}
              <Tag>{u.claimed_supplier.entity_type.replace(/_/g, " ")}</Tag>
            </p>
          ) : (
            <p className="text-ink-tertiary">No claimed supplier.</p>
          )}
          {u.is_suspended ? (
            <div className="rounded-input border border-hairline bg-bg-l0 p-3 text-xs text-ink-secondary">
              <p>
                Suspended {u.suspended_at ? new Date(u.suspended_at).toLocaleString() : "—"}{" "}
                {u.suspended_by_email ? `by ${u.suspended_by_email}` : ""}
              </p>
              {u.suspended_reason ? (
                <p className="mt-1">Reason: {u.suspended_reason}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage</CardTitle>
          <CardMeta>PATCH /api/v1/admin/users/{u.user_id}</CardMeta>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit history</CardTitle>
          <CardMeta>{audit.total} rows · most recent first</CardMeta>
        </CardHeader>
        <CardContent>
          {audit.rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">No audit rows yet.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {audit.rows.map((row) => (
                <li key={row.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono text-ink-tertiary">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                    <Tag>{row.action}</Tag>
                    <Tag>{row.direction}</Tag>
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
        </CardContent>
      </Card>
    </div>
  );
}
