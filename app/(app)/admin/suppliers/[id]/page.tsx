// Admin supplier editor page (Spec A2). Fetches single-supplier payload
// via `public.admin_supplier_get` and renders the editor island, rescore
// button island, and recent admin-audit history.

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
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
      <div className="mx-auto max-w-5xl space-y-6">
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load supplier: {error.message}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (data == null) notFound();

  const doc = data as Doc;
  const s = doc.supplier;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-2 border-b border-hairline pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-brand-forest">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
            Admin · supplier
          </p>
          <h1 className="font-display text-[24px] font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-primary sm:text-[28px]">
            {s.name_display ?? s.company_name}
          </h1>
          <p className="mt-1 text-[12px] text-ink-tertiary">
            <span className="font-mono">{s.slug}</span>
            {s.city || s.district
              ? ` · ${[s.city, s.district].filter(Boolean).join(", ")}`
              : ""}
            {s.country ? ` · ${s.country}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Tag tone="muted">{s.entity_type}</Tag>
            {s.published ? (
              <Tag tone="muted">published</Tag>
            ) : (
              <Tag tone="amber">unpublished</Tag>
            )}
            {s.claimed_by ? <Tag tone="muted">claimed</Tag> : null}
            {s.sanctioned_flag ? <Tag tone="red">sanctioned</Tag> : null}
            {doc.pending_rescore_count > 0 ? (
              <Tag tone="amber">
                {doc.pending_rescore_count} rescore pending
              </Tag>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/suppliers"
            className="rounded-pill border border-hairline px-3 py-1.5 text-[12px] text-ink-tertiary hover:text-ink-primary"
          >
            ← Back to list
          </Link>
          <Link
            href={`/suppliers/${s.slug}`}
            target="_blank"
            className="rounded-pill border border-hairline px-3 py-1.5 text-[12px] text-ink-tertiary hover:text-ink-primary"
          >
            Public profile ↗
          </Link>
          <AdminSupplierRescoreButton id={s.id} />
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Editable fields</CardTitle>
          <CardMeta>admin_supplier_update — whitelisted columns only</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
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
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Read-only register fields</CardTitle>
            <CardMeta>ETL-owned</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
              <Kv k="company_name" v={s.company_name} mono />
              <Kv k="website" v={s.website} mono />
              <Kv k="address_raw" v={s.address_raw} />
              <Kv k="parent_group" v={s.parent_group_name} />
              <Kv
                k="completeness_pct"
                v={s.completeness_pct != null ? `${s.completeness_pct}%` : null}
              />
              <Kv k="sbi_total" v={s.sbi_total != null ? String(s.sbi_total) : null} mono />
              <Kv
                k="source_tags"
                v={s.source_tags && s.source_tags.length > 0 ? s.source_tags.join(", ") : null}
                mono
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source records</CardTitle>
            <CardMeta>{doc.source_records.length} rows</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            {doc.source_records.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">No source records.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0 text-[12px]">
                {doc.source_records.map((sr) => (
                  <li
                    key={sr.id}
                    className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 last:border-b-0"
                  >
                    <span className="font-mono">
                      {sr.source_code}{" "}
                      <span className="text-ink-tertiary">[{sr.source_tier}]</span>
                    </span>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      {sr.status} ·{" "}
                      {sr.fetched_at
                        ? new Date(sr.fetched_at).toISOString().slice(0, 10)
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Certifications</CardTitle>
            <CardMeta>{doc.certifications.length} rows</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            {doc.certifications.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">No certifications.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0 text-[12px]">
                {doc.certifications.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 last:border-b-0"
                  >
                    <span className="font-mono">
                      {c.kind}
                      {c.certificate_no ? ` · ${c.certificate_no}` : ""}
                    </span>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      exp{" "}
                      {c.expires_on
                        ? new Date(c.expires_on).toISOString().slice(0, 10)
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification queue</CardTitle>
            <CardMeta>{doc.verification_queue.length} rows</CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            {doc.verification_queue.length === 0 ? (
              <p className="text-[13px] text-ink-tertiary">No queue entries.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col p-0 text-[12px]">
                {doc.verification_queue.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5 last:border-b-0"
                  >
                    <span className="font-mono">{v.queue_type}</span>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      {v.admin_action ?? "pending"}
                      {v.confidence != null
                        ? ` · conf ${v.confidence.toFixed(2)}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Recent admin actions</CardTitle>
          <CardMeta>admin_audit_log — last {doc.recent_audit.length}</CardMeta>
        </CardHeader>
        <CardContent className="pt-0">
          {doc.recent_audit.length === 0 ? (
            <p className="text-[13px] text-ink-tertiary">
              No admin actions logged for this supplier yet.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0 text-[12px]">
              {doc.recent_audit.map((a) => (
                <li
                  key={a.id}
                  className="border-b border-hairline py-2 last:border-b-0"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-ink-primary">{a.action}</span>
                    <span className="font-mono tabular-nums text-ink-tertiary">
                      {new Date(a.created_at).toISOString().replace("T", " ").slice(0, 19)}
                    </span>
                  </div>
                  {a.patch ? (
                    <pre className="mt-1 overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-2 font-mono text-[11px] text-ink-secondary">
                      {JSON.stringify(a.patch, null, 2)}
                    </pre>
                  ) : null}
                  {a.metadata ? (
                    <pre className="mt-1 overflow-x-auto rounded-input border border-hairline bg-bg-l0 p-2 font-mono text-[11px] text-ink-tertiary">
                      {JSON.stringify(a.metadata, null, 2)}
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

function Kv({
  k,
  v,
  mono,
}: {
  k: string;
  v: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-ink-tertiary">
        {k}
      </dt>
      <dd className={mono ? "font-mono text-ink-primary" : "text-ink-primary"}>
        {v ?? <span className="text-ink-tertiary">—</span>}
      </dd>
    </div>
  );
}
