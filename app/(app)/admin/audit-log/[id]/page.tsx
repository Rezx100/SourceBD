// Admin audit-log drilldown (Spec A6). Calls admin_audit_log_get;
// renders the row's patch + metadata + resolved actor & target.

import Link from "next/link";
import { notFound } from "next/navigation";

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

type Doc = {
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

function targetHref(table: string, id: string | null): string | null {
  if (!id) return null;
  if (table === "suppliers") return `/admin/suppliers/${id}`;
  if (table === "profiles") return `/admin/users/${id}`;
  if (table === "certifications") return `/admin/certifications`;
  return null;
}

export default async function AdminAuditLogDrilldownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_audit_log_get", {
    p_id: id,
  });

  if (error || data == null) {
    if (error?.message?.toLowerCase().includes("audit row not found")) {
      notFound();
    }
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <p>
          <Link
            href="/admin/audit-log"
            className="font-mono text-xs text-accent-indigo hover:underline"
          >
            ← Audit log
          </Link>
        </p>
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load audit row
            {error?.message ? <>: {error.message}</> : null}.
          </CardContent>
        </Card>
      </div>
    );
  }

  const row = data as Doc;
  const href = targetHref(row.target_table, row.target_id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p>
          <Link
            href="/admin/audit-log"
            className="font-mono text-xs text-accent-indigo hover:underline"
          >
            ← Audit log
          </Link>
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Admin · audit entry
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          {row.action}
        </h1>
        <p className="mt-1 font-mono text-xs text-ink-tertiary">
          {new Date(row.created_at).toLocaleString()} · id {row.id}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Actor</CardTitle>
          <CardMeta>admin who performed the action</CardMeta>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="font-mono text-xs">{row.actor.email || row.actor.id}</span>
          </p>
          {row.actor.role ? (
            <p>
              <Badge tone="alert">{row.actor.role}</Badge>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Target</CardTitle>
          <CardMeta>{row.target_table}</CardMeta>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{row.target_table}</Tag>
            {href && row.target_id ? (
              <Link
                href={href}
                className="font-mono text-xs text-accent-indigo hover:underline"
              >
                {row.target_label || row.target_id}
              </Link>
            ) : (
              <span className="font-mono text-xs">
                {row.target_label || row.target_id || "—"}
              </span>
            )}
          </div>
          {row.target_id ? (
            <p className="font-mono text-[11px] text-ink-tertiary">
              id {row.target_id}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patch</CardTitle>
          <CardMeta>field-by-field diff</CardMeta>
        </CardHeader>
        <CardContent>
          {row.patch == null ? (
            <p className="text-sm text-ink-tertiary">No patch payload.</p>
          ) : (
            <pre className="overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-3 font-mono text-[11px] text-ink-primary">
              {JSON.stringify(row.patch, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metadata</CardTitle>
          <CardMeta>context captured at write time</CardMeta>
        </CardHeader>
        <CardContent>
          {row.metadata == null ? (
            <p className="text-sm text-ink-tertiary">No metadata.</p>
          ) : (
            <pre className="overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-3 font-mono text-[11px] text-ink-primary">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
