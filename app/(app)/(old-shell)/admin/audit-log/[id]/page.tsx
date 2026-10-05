// Admin audit-log drilldown (Spec A6). Calls admin_audit_log_get;
// renders the row's patch + metadata + resolved actor & target.

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminColumn,
  AdminHead,
  AdminSection,
  JsonBlock,
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/data-ui";
import { ButtonLink, InlineError, TypeChip, linkClass } from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
      <AdminColumn narrow>
        <div>
          <ButtonLink href="/admin/audit-log">Back to audit log</ButtonLink>
        </div>
        <InlineError>
          Could not load audit row
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </AdminColumn>
    );
  }

  const row = data as Doc;
  const href = targetHref(row.target_table, row.target_id);

  return (
    <AdminColumn narrow>
      <AdminHead
        title={humanizeAdminToken(row.action)}
        lede={
          <span className="font-mono text-sm">
            {formatAdminDateTime(row.created_at)} · id {row.id}
          </span>
        }
        actions={<ButtonLink href="/admin/audit-log">Back to audit log</ButtonLink>}
      />

      <AdminSection title="Actor" description="Admin who performed the action.">
        <div className="flex flex-col gap-2">
          <p>
            <span className="font-mono text-sm text-ink">{row.actor.email || row.actor.id}</span>
          </p>
          {row.actor.role ? (
            <p>
              <TypeChip>{humanizeAdminToken(row.actor.role)}</TypeChip>
            </p>
          ) : null}
        </div>
      </AdminSection>

      <AdminSection title="Target" meta={humanizeAdminToken(row.target_table)}>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip>{humanizeAdminToken(row.target_table)}</TypeChip>
            {href && row.target_id ? (
              <Link href={href} className={cn(linkClass, "font-mono text-sm")}>
                {row.target_label || row.target_id}
              </Link>
            ) : (
              <span className="font-mono text-sm text-ink">{row.target_label || row.target_id || "—"}</span>
            )}
          </div>
          {row.target_id ? <p className="font-mono text-xs text-ink-3">id {row.target_id}</p> : null}
        </div>
      </AdminSection>

      <AdminSection title="Patch" description="Field-by-field diff.">
        {row.patch == null ? <p className="text-base text-ink-3">No patch payload.</p> : <JsonBlock value={row.patch} />}
      </AdminSection>

      <AdminSection title="Metadata" description="Context captured at write time.">
        {row.metadata == null ? <p className="text-base text-ink-3">No metadata.</p> : <JsonBlock value={row.metadata} />}
      </AdminSection>
    </AdminColumn>
  );
}
