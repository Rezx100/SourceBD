// Admin supplier editor page (Spec A2). Fetches single-supplier payload
// via `public.admin_supplier_get` and renders the editor island, rescore
// button island, and recent admin-audit history.

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminColumn,
  AdminFacts,
  AdminHead,
  AdminRow,
  AdminRows,
  AdminSection,
  JsonBlock,
  StatusChip,
  formatAdminDate,
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/data-ui";
import { ButtonLink, InlineError, TypeChip, linkClass } from "@/components/kit";
import { AdminSupplierEditorForm } from "@/components/admin-supplier-editor-form";
import { AdminSupplierRescoreButton } from "@/components/admin-supplier-rescore-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Supplier = {
  id: string;
  slug: string;
  company_name: string;
  name_display: string | null;
  description: string | null;
  entity_type: string;
  published: boolean;
  claimed_by: string | null;
  sanctioned_flag: boolean;
  sanctioned_reason: string | null;
  notes_admin: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  address_raw: string | null;
  website: string | null;
  parent_group_name: string | null;
  source_tags: string[] | null;
  completeness_pct: number | null;
  sbi_total: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type SourceRecord = {
  id: string;
  source_code: string;
  source_tier: string;
  source_ref: string | null;
  fetched_at: string | null;
  status: string;
};

type Certification = {
  id: string;
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
};

type VerificationRow = {
  id: string;
  queue_type: string;
  confidence: number | null;
  admin_action: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type AuditRow = {
  id: string;
  action: string;
  patch: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_id: string | null;
};

type Doc = {
  supplier: Supplier;
  source_records: SourceRecord[];
  certifications: Certification[];
  verification_queue: VerificationRow[];
  recent_audit: AuditRow[];
  pending_rescore_count: number;
};

export default async function AdminSupplierEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_supplier_get", { p_id: id });

  if (error) {
    return (
      <AdminColumn narrow>
        <InlineError>Could not load supplier: {error.message}</InlineError>
      </AdminColumn>
    );
  }
  if (data == null) notFound();

  const doc = data as Doc;
  const s = doc.supplier;
  const activeTier13Sources = new Set(
    doc.source_records
      .filter(
        (sr) =>
          sr.status === "active" &&
          ["tier1_gov", "tier2_industry", "tier3_cert"].includes(sr.source_tier),
      )
      .map((sr) => sr.source_code),
  );
  const openReviewCount = doc.verification_queue.filter((v) => v.reviewed_at == null).length;
  const canPublish = activeTier13Sources.size > 0;

  return (
    <AdminColumn>
      <AdminHead
        title={s.name_display ?? s.company_name}
        lede={
          <>
            <span className="font-mono">{s.slug}</span>
            {s.city || s.district ? ` · ${[s.city, s.district].filter(Boolean).join(", ")}` : ""}
            {s.country ? ` · ${s.country}` : ""}
          </>
        }
        actions={
          <>
            <ButtonLink href="/admin/suppliers">Back to list</ButtonLink>
            {s.published ? (
              <ButtonLink href={`/suppliers/${s.slug}`} target="_blank">
                Public profile
              </ButtonLink>
            ) : (
              <StatusChip tone="caution">Public profile hidden</StatusChip>
            )}
            <AdminSupplierRescoreButton id={s.id} />
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <TypeChip>{humanizeAdminToken(s.entity_type)}</TypeChip>
        {s.published ? <TypeChip>Visible to buyers</TypeChip> : <StatusChip tone="caution">Not visible</StatusChip>}
        {s.claimed_by ? <TypeChip>Claimed</TypeChip> : <StatusChip tone="caution">Unclaimed</StatusChip>}
        {s.sanctioned_flag ? <StatusChip tone="danger">Sanctioned</StatusChip> : <TypeChip>Sanctions clear</TypeChip>}
        {doc.pending_rescore_count > 0 ? <StatusChip tone="caution">{doc.pending_rescore_count} rescore pending</StatusChip> : null}
      </div>

      <AdminSection title="Publication readiness" description="Checks an admin should review before changing buyer visibility.">
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadinessItem
            label="Buyer visibility"
            value={s.published ? "Visible to buyers" : "Not visible"}
            tone={s.published ? "ok" : "caution"}
          />
          <ReadinessItem
            label="Verified evidence"
            value={`${activeTier13Sources.size} active Tier 1-3 source${activeTier13Sources.size === 1 ? "" : "s"}`}
            tone={canPublish ? "ok" : "danger"}
            hint={canPublish ? "Meets the database publish requirement." : "Publishing is blocked until active Tier 1-3 evidence exists."}
          />
          <ReadinessItem
            label="Open review items"
            value={String(openReviewCount)}
            tone={openReviewCount > 0 ? "caution" : "ok"}
            href={openReviewCount > 0 ? `/admin/queue` : undefined}
          />
        </div>
      </AdminSection>

      <AdminSection title="Editable buyer profile" description="Only approved admin fields can be changed here.">
        <AdminSupplierEditorForm
          id={s.id}
          initial={{
            name_display: s.name_display ?? "",
            description: s.description ?? "",
            entity_type: s.entity_type,
            published: s.published,
            sanctioned_flag: s.sanctioned_flag,
            sanctioned_reason: s.sanctioned_reason ?? "",
            notes_admin: s.notes_admin ?? "",
          }}
        />
      </AdminSection>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminSection title="Evidence from source records" description="Read-only facts pulled from source records.">
          <AdminFacts
            className="sm:grid-cols-1"
            rows={[
              { label: "Register company name", value: s.company_name, mono: true },
              { label: "Website", value: s.website, mono: true },
              { label: "Registered address", value: s.address_raw },
              { label: "Parent group", value: s.parent_group_name },
              { label: "Internal SBI total", value: s.sbi_total != null ? String(s.sbi_total) : null, mono: true },
              { label: "Source tags", value: s.source_tags && s.source_tags.length > 0 ? s.source_tags.join(", ") : null, mono: true },
            ]}
          />
        </AdminSection>

        <AdminSection title="Source records" meta={`${doc.source_records.length} rows`} flush>
          {doc.source_records.length === 0 ? (
            <p className="p-4 text-base text-ink-3">No source records.</p>
          ) : (
            <AdminRows className="text-sm">
              {doc.source_records.map((sr) => (
                <AdminRow key={sr.id}>
                  <span className="font-mono">
                    {sr.source_code} <span className="text-ink-3">[{sr.source_tier}]</span>
                  </span>
                  <span className="font-mono tabular-nums text-ink-3">
                    {sr.status} · {sr.fetched_at ? formatAdminDate(sr.fetched_at) : "—"}
                  </span>
                </AdminRow>
              ))}
            </AdminRows>
          )}
        </AdminSection>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminSection title="Certifications" meta={`${doc.certifications.length} rows`} flush>
          {doc.certifications.length === 0 ? (
            <p className="p-4 text-base text-ink-3">No certifications.</p>
          ) : (
            <AdminRows className="text-sm">
              {doc.certifications.map((c) => (
                <AdminRow key={c.id}>
                  <span className="font-mono">
                    {humanizeAdminToken(c.kind)}
                    {c.certificate_no ? ` · ${c.certificate_no}` : ""}
                  </span>
                  <span className="font-mono tabular-nums text-ink-3">exp {c.expires_on ? formatAdminDate(c.expires_on) : "—"}</span>
                </AdminRow>
              ))}
            </AdminRows>
          )}
        </AdminSection>

        <AdminSection title="Open review items" meta={`${openReviewCount} open · ${doc.verification_queue.length} total rows`} flush>
          {doc.verification_queue.length === 0 ? (
            <p className="p-4 text-base text-ink-3">No queue entries.</p>
          ) : (
            <AdminRows className="text-sm">
              {doc.verification_queue.map((v) => (
                <AdminRow key={v.id}>
                  <Link href={`/admin/queue?type=${encodeURIComponent(v.queue_type)}`} className={cn(linkClass, "font-mono")}>
                    {humanizeAdminToken(v.queue_type)}
                  </Link>
                  <span className="font-mono tabular-nums text-ink-3">
                    {v.admin_action ?? "pending"}
                    {v.confidence != null ? ` · conf ${v.confidence.toFixed(2)}` : ""}
                  </span>
                </AdminRow>
              ))}
            </AdminRows>
          )}
        </AdminSection>
      </div>

      <AdminSection title="Recent admin actions" meta={`Last ${doc.recent_audit.length} audit entries for this supplier`} flush>
        {doc.recent_audit.length === 0 ? (
          <p className="p-4 text-base text-ink-3">No admin actions logged for this supplier yet.</p>
        ) : (
          <AdminRows className="text-sm">
            {doc.recent_audit.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-mono text-ink">{a.action}</span>
                  <span className="font-mono tabular-nums text-ink-3">{formatAdminDateTime(a.created_at)}</span>
                </div>
                {a.patch ? <JsonBlock value={a.patch} className="mt-1" /> : null}
                {a.metadata ? <JsonBlock value={a.metadata} className="mt-1 text-ink-3" /> : null}
              </li>
            ))}
          </AdminRows>
        )}
      </AdminSection>
    </AdminColumn>
  );
}

function ReadinessItem({
  label,
  value,
  tone,
  hint,
  href,
}: {
  label: string;
  value: string;
  tone: "ok" | "caution" | "danger";
  hint?: string;
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        "h-full rounded-md border p-4",
        tone === "ok" ? "border-line bg-surface" : tone === "caution" ? "border-caution-icon bg-caution-tint" : "border-danger bg-danger-tint",
      )}
    >
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-sm text-ink-2">{hint}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {content}
    </Link>
  ) : (
    content
  );
}
