// Admin audit-log drilldown (Spec A6). Calls admin_audit_log_get;
// renders the row's patch + metadata + resolved actor & target.

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminActionLink,
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
      <AdminPage maxWidth="4xl">
        <AdminActionLink href="/admin/audit-log">Back to audit log</AdminActionLink>
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load audit row
            {error?.message ? <>: {error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
    );
  }

  const row = data as Doc;
  const href = targetHref(row.target_table, row.target_id);

  return (
    <AdminPage maxWidth="4xl">
      <AdminPageHeader
        kicker="Admin · Audit"
        title={humanizeAdminToken(row.action)}
        description={<span className="font-mono text-xs">{formatAdminDateTime(row.created_at)} · id {row.id}</span>}
        actions={<AdminActionLink href="/admin/audit-log">Back to audit log</AdminActionLink>}
      />

      <AdminPanel title="Actor" description="Admin who performed the action.">
          <p>
            <span className="font-mono text-xs">{row.actor.email || row.actor.id}</span>
          </p>
          {row.actor.role ? (
            <p>
              <Badge tone="alert">{humanizeAdminToken(row.actor.role)}</Badge>
            </p>
          ) : null}
      </AdminPanel>

      <AdminPanel title="Target" meta={humanizeAdminToken(row.target_table)}>
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{humanizeAdminToken(row.target_table)}</Tag>
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
            <p className="font-mono text-[12px] text-ink-tertiary">
              id {row.target_id}
            </p>
          ) : null}
      </AdminPanel>

      <AdminPanel title="Patch" description="Field-by-field diff.">
          {row.patch == null ? (
            <p className="text-sm text-ink-tertiary">No patch payload.</p>
          ) : (
            <pre className="overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-3 font-mono text-[12px] text-ink-primary">
              {JSON.stringify(row.patch, null, 2)}
            </pre>
          )}
      </AdminPanel>

      <AdminPanel title="Metadata" description="Context captured at write time.">
          {row.metadata == null ? (
            <p className="text-sm text-ink-tertiary">No metadata.</p>
          ) : (
            <pre className="overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-3 font-mono text-[12px] text-ink-primary">
              {JSON.stringify(row.metadata, null, 2)}
            </pre>
          )}
      </AdminPanel>
    </AdminPage>
  );
}
