// Admin supplier editor page (Spec A2). Fetches single-supplier payload
// via `public.admin_supplier_get` and renders the editor island, rescore
// button island, and recent admin-audit history.

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminActionLink,
  AdminKeyValueList,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminRow,
  AdminRowList,
  formatAdminDate,
  formatAdminDateTime,
  humanizeAdminToken,
} from "@/components/admin/admin-ui";
import { Tag } from "@/components/ui/tag";
import { AdminSupplierEditorForm } from "@/components/admin-supplier-editor-form";
import { AdminSupplierRescoreButton } from "@/components/admin-supplier-rescore-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
      <AdminPage maxWidth="5xl">
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load supplier: {error.message}
          </p>
        </AdminPanel>
      </AdminPage>
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
    <AdminPage maxWidth="6xl">
      <AdminPageHeader
        kicker="Admin · Supplier"
        title={s.name_display ?? s.company_name}
        description={
          <>
            <span className="font-mono">{s.slug}</span>
            {s.city || s.district
              ? ` · ${[s.city, s.district].filter(Boolean).join(", ")}`
              : ""}
            {s.country ? ` · ${s.country}` : ""}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminActionLink href="/admin/suppliers">Back to list</AdminActionLink>
            {s.published ? (
              <AdminActionLink href={`/suppliers/${s.slug}`} target="_blank">
                Public profile
              </AdminActionLink>
            ) : (
              <span className="inline-flex min-h-[40px] items-center rounded-pill border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800">
                Public profile hidden
              </span>
            )}
            <AdminSupplierRescoreButton id={s.id} />
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Tag tone="muted">{humanizeAdminToken(s.entity_type)}</Tag>
        {s.published ? <Tag tone="muted">Visible to buyers</Tag> : <Tag tone="amber">Not visible</Tag>}
        {s.claimed_by ? <Tag tone="muted">Claimed</Tag> : <Tag tone="amber">Unclaimed</Tag>}
        {s.sanctioned_flag ? <Tag tone="red">Sanctioned</Tag> : <Tag tone="muted">Sanctions clear</Tag>}
        {doc.pending_rescore_count > 0 ? (
          <Tag tone="amber">{doc.pending_rescore_count} rescore pending</Tag>
        ) : null}
      </div>

      <AdminPanel
        title="Publication readiness"
        description="Checks an admin should review before changing buyer visibility."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <ReadinessItem
            label="Buyer visibility"
            value={s.published ? "Visible to buyers" : "Not visible"}
            tone={s.published ? "green" : "amber"}
          />
          <ReadinessItem
            label="Verified evidence"
            value={`${activeTier13Sources.size} active Tier 1-3 source${activeTier13Sources.size === 1 ? "" : "s"}`}
            tone={canPublish ? "green" : "red"}
            hint={
              canPublish
                ? "Meets the database publish requirement."
                : "Publishing is blocked until active Tier 1-3 evidence exists."
            }
          />
          <ReadinessItem
            label="Open review items"
            value={String(openReviewCount)}
            tone={openReviewCount > 0 ? "amber" : "green"}
            href={openReviewCount > 0 ? `/admin/queue` : undefined}
          />
        </div>
      </AdminPanel>

      <AdminPanel
        title="Editable buyer profile"
        description="Only approved admin fields can be changed here."
      >
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
      </AdminPanel>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminPanel
          title="Evidence from source records"
          description="Read-only facts pulled from source records."
        >
            <AdminKeyValueList
              rows={[
                { label: "Register company name", value: s.company_name, mono: true },
                { label: "Website", value: s.website, mono: true },
                { label: "Registered address", value: s.address_raw },
                { label: "Parent group", value: s.parent_group_name },
                { label: "Internal SBI total", value: s.sbi_total != null ? String(s.sbi_total) : null, mono: true },
                { label: "Source tags", value: s.source_tags && s.source_tags.length > 0 ? s.source_tags.join(", ") : null, mono: true },
              ]}
            />
        </AdminPanel>

        <AdminPanel
          title="Source records"
          meta={`${doc.source_records.length} rows`}
          padded={false}
        >
            {doc.source_records.length === 0 ? (
              <p className="p-4 text-[14px] text-ink-tertiary sm:p-5">No source records.</p>
            ) : (
              <AdminRowList className="text-[13px]">
                {doc.source_records.map((sr) => (
                  <AdminRow key={sr.id}>
                    <span className="font-mono">
                      {sr.source_code}{" "}
                      <span className="text-ink-tertiary">[{sr.source_tier}]</span>
                    </span>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      {sr.status} ·{" "}
                      {sr.fetched_at
                        ? formatAdminDate(sr.fetched_at)
                        : "—"}
                    </span>
                  </AdminRow>
                ))}
              </AdminRowList>
            )}
        </AdminPanel>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminPanel
          title="Certifications"
          meta={`${doc.certifications.length} rows`}
          padded={false}
        >
            {doc.certifications.length === 0 ? (
              <p className="p-4 text-[14px] text-ink-tertiary sm:p-5">No certifications.</p>
            ) : (
              <AdminRowList className="text-[13px]">
                {doc.certifications.map((c) => (
                  <AdminRow key={c.id}>
                    <span className="font-mono">
                      {humanizeAdminToken(c.kind)}
                      {c.certificate_no ? ` · ${c.certificate_no}` : ""}
                    </span>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      exp{" "}
                      {c.expires_on
                        ? formatAdminDate(c.expires_on)
                        : "—"}
                    </span>
                  </AdminRow>
                ))}
              </AdminRowList>
            )}
        </AdminPanel>

        <AdminPanel
          title="Open review items"
          meta={`${openReviewCount} open · ${doc.verification_queue.length} total rows`}
          padded={false}
        >
            {doc.verification_queue.length === 0 ? (
              <p className="p-4 text-[14px] text-ink-tertiary sm:p-5">No queue entries.</p>
            ) : (
              <AdminRowList className="text-[13px]">
                {doc.verification_queue.map((v) => (
                  <AdminRow key={v.id}>
                    <Link
                      href={`/admin/queue?type=${encodeURIComponent(v.queue_type)}`}
                      className="font-mono text-ink-primary hover:underline"
                    >
                      {humanizeAdminToken(v.queue_type)}
                    </Link>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      {v.admin_action ?? "pending"}
                      {v.confidence != null
                        ? ` · conf ${v.confidence.toFixed(2)}`
                        : ""}
                    </span>
                  </AdminRow>
                ))}
              </AdminRowList>
            )}
        </AdminPanel>
      </section>

      <AdminPanel
        title="Recent admin actions"
        meta={`Last ${doc.recent_audit.length} audit entries for this supplier`}
        padded={false}
      >
          {doc.recent_audit.length === 0 ? (
            <p className="p-4 text-[14px] text-ink-tertiary sm:p-5">
              No admin actions logged for this supplier yet.
            </p>
          ) : (
            <AdminRowList className="text-[13px]">
              {doc.recent_audit.map((a) => (
                <li
                  key={a.id}
                  className="px-4 py-3 last:border-b-0 sm:px-5"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-ink-primary">{a.action}</span>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      {formatAdminDateTime(a.created_at)}
                    </span>
                  </div>
                  {a.patch ? (
                    <pre className="mt-1 overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-2 font-mono text-[12px] text-ink-secondary">
                      {JSON.stringify(a.patch, null, 2)}
                    </pre>
                  ) : null}
                  {a.metadata ? (
                    <pre className="mt-1 overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-2 font-mono text-[12px] text-ink-tertiary">
                      {JSON.stringify(a.metadata, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </AdminRowList>
          )}
      </AdminPanel>
    </AdminPage>
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
  tone: "green" | "amber" | "red";
  hint?: string;
  href?: string;
}) {
  const content = (
    <div
      className={
        "rounded-lg border p-4 " +
        (tone === "green"
          ? "border-emerald-200 bg-emerald-50"
          : tone === "amber"
            ? "border-amber-200 bg-amber-50"
            : "border-red-200 bg-red-50")
      }
    >
      <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-ink-tertiary">
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-ink-primary">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[13px] text-ink-secondary">{hint}</p> : null}
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

