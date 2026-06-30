// Admin certification verification queue (Spec A3). Calls
// `public.admin_cert_queue_list` with status/kind filters driven from
// URL search params. Admin-only; middleware gates `/admin/*` and the
// RPC re-checks role inside its body.

import Link from "next/link";

import { AdminCertDecideButton } from "@/components/admin-cert-decide-button";
import {
  ADMIN_SELECT_CLASS,
  AdminActionLink,
  AdminEmptyState,
  AdminField,
  AdminFilterPanel,
  AdminPage,
  AdminPageHeader,
  AdminPagination,
  AdminPanel,
  formatAdminDate,
  humanizeAdminToken,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  queue_id: string;
  queue_created_at: string;
  reviewed_at: string | null;
  admin_action: string | null;
  cert: {
    id: string;
    kind: string;
    certificate_no: string | null;
    issuer: string | null;
    issued_on: string | null;
    expires_on: string | null;
    scope: string | null;
    document_url: string | null;
    verified: boolean;
    rejected_at: string | null;
    rejected_reason: string | null;
  };
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
  };
  uploaded_by_email: string | null;
};

type Doc = { total: number; rows: Row[] };

const PAGE_SIZE = 50;

const STATUSES = ["open", "reviewed", "all"] as const;
type Status = (typeof STATUSES)[number];

const CERT_KINDS = [
  "wrap",
  "bsci",
  "sedex_smeta",
  "oeko_tex",
  "gots",
  "grs",
  "rcs",
  "bci",
  "fairtrade",
  "iso9001",
  "iso14001",
  "iso45001",
  "sa8000",
  "other",
] as const;

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

export default async function AdminCertificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusRaw = asStr(sp.status) || "open";
  const status: Status = (STATUSES as readonly string[]).includes(statusRaw)
    ? (statusRaw as Status)
    : "open";
  const kind = asStr(sp.kind);
  const page = Math.max(1, asInt(sp.page) ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("admin_cert_queue_list", {
    p_status: status,
    p_kind: kind || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
  });

  if (error || data == null) {
    return (
      <AdminPage maxWidth="5xl">
        <CertHeader />
        <AdminPanel>
          <p className="text-sm text-sem-red">
            Could not load queue
            {error?.message ? <>: {error.message}</> : null}.
          </p>
        </AdminPanel>
      </AdminPage>
    );
  }

  const doc = data as Doc;
  const totalPages = Math.max(1, Math.ceil(doc.total / PAGE_SIZE));

  const baseQuery = new URLSearchParams();
  if (status !== "open") baseQuery.set("status", status);
  if (kind) baseQuery.set("kind", kind);
  const pageHref = (n: number) => {
    const q = new URLSearchParams(baseQuery);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/admin/certifications?${s}` : "/admin/certifications";
  };

  return (
    <AdminPage maxWidth="5xl">
      <CertHeader total={doc.total} />

      <AdminFilterPanel
        title="Find certification reviews"
        description="Filter uploaded certificates by review state and certificate kind."
      >
          <form
            method="get"
            action="/admin/certifications"
            className="grid grid-cols-1 gap-3 sm:grid-cols-3"
          >
            <AdminField label="Status">
              <select
                name="status"
                defaultValue={status}
                className={ADMIN_SELECT_CLASS}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanizeAdminToken(s)}
                  </option>
                ))}
              </select>
            </AdminField>
            <AdminField label="Cert kind">
              <select
                name="kind"
                defaultValue={kind}
                className={ADMIN_SELECT_CLASS}
              >
                <option value="">Any</option>
                {CERT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {humanizeAdminToken(k)}
                  </option>
                ))}
              </select>
            </AdminField>
            <div className="flex items-end">
              <button
                type="submit"
                className="min-h-[44px] rounded-pill border border-brand-forest bg-brand-forest px-4 text-sm font-semibold text-white hover:bg-brand-forest-mid"
              >
                Apply
              </button>
            </div>
          </form>
      </AdminFilterPanel>

      <AdminPanel
        title="Certification queue"
        meta={`${doc.total} total · page ${page} / ${totalPages}`}
        padded={false}
      >
          {doc.rows.length === 0 ? (
            <div className="p-4 sm:p-5">
              <AdminEmptyState
                title="No certifications in this state"
                description="Try a different status or certificate kind."
              />
            </div>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={CERT_COLUMNS}
              rows={doc.rows}
              rowKey={(r) => r.queue_id}
              caption="Certification queue"
              className="border-0 shadow-none"
            />
          )}
      </AdminPanel>
      <AdminPagination page={page} totalPages={totalPages} pageHref={pageHref} />
    </AdminPage>
  );
}

const CERT_COLUMNS: Column<Row>[] = [
  {
    key: "supplier",
    label: "Supplier",
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/admin/suppliers/${r.supplier.id}`}
          className="text-sm font-semibold text-ink-primary hover:underline"
        >
          {r.supplier.company_name}
        </Link>
        <Tag>{humanizeAdminToken(r.supplier.entity_type)}</Tag>
      </span>
    ),
  },
  {
    key: "cert",
    label: "Certificate",
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge tone={r.cert.verified ? "success" : "neutral"}>
          {humanizeAdminToken(r.cert.kind)}
        </Badge>
        {r.cert.verified ? (
          <Badge tone="success">verified</Badge>
        ) : r.cert.rejected_at ? (
          <Badge tone="alert">rejected</Badge>
        ) : null}
        {r.admin_action ? <Tag>{r.admin_action}</Tag> : null}
      </span>
    ),
  },
  {
    key: "details",
    label: "Details",
    render: (r) => (
      <span className="block text-xs text-ink-tertiary">
        {r.cert.certificate_no ?? "—"} · issuer {r.cert.issuer ?? "—"} · expires{" "}
        {r.cert.expires_on ?? "—"}
        {r.cert.scope ? (
          <span className="block text-ink-secondary">{r.cert.scope}</span>
        ) : null}
        {r.cert.rejected_reason ? (
          <span className="block text-ink-secondary">
            Reason: {r.cert.rejected_reason}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    key: "document",
    label: "Document",
    render: (r) =>
      r.cert.document_url ? (
        <a
          href={r.cert.document_url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-accent-indigo hover:underline"
        >
          view
        </a>
      ) : (
        "—"
      ),
  },
  {
    key: "meta",
    label: "Submitted",
    render: (r) => (
      <span className="block text-[11px] text-ink-tertiary">
        by <span className="font-mono">{r.uploaded_by_email ?? "—"}</span> ·{" "}
        {formatAdminDate(r.queue_created_at)}
        {r.reviewed_at
          ? ` · reviewed ${formatAdminDate(r.reviewed_at)}`
          : ""}
      </span>
    ),
  },
  {
    key: "action",
    label: "",
    numeric: true,
    render: (r) =>
      r.reviewed_at == null ? (
        <AdminCertDecideButton
          queueId={r.queue_id}
          label={`${r.supplier.company_name} · ${r.cert.kind}`}
        />
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
];

function CertHeader({ total }: { total?: number }) {
  return (
    <AdminPageHeader
      kicker="Admin · Certifications"
      title="Certification queue"
      description={`Review supplier-uploaded certifications. Approve to mark the cert verified; reject to soft-delete with a reason.${typeof total === "number" ? ` ${total} total in current filter.` : ""}`}
      actions={<AdminActionLink href="/admin/queue?type=cert_doc_review">Review hub</AdminActionLink>}
    />
  );
}
