// Admin certification verification queue (Spec A3). Calls
// `public.admin_cert_queue_list` with status/kind filters driven from
// URL search params. Admin-only; middleware gates `/admin/*` and the
// RPC re-checks role inside its body.

import { CheckCircle } from "@phosphor-icons/react/dist/ssr";

import { AdminCertDecideButton } from "@/components/admin-cert-decide-button";
import {
  Button,
  Chip,
  Empty,
  FactChip,
  Field,
  InlineError,
  Select,
  Table,
  Td,
  Th,
  Tr,
  TypeChip,
} from "@/components/kit";
import {
  HeadLink,
  OutLink,
  QueueColumn,
  QueueFilter,
  QueueHead,
  QueueTable,
  SupplierLink,
  formatAdminDate,
  humanizeAdminToken,
} from "@/components/admin/queue-parts";
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

// The kit Select cannot hold an empty value, so its "Any" row posts this word; the page reads it as no filter.
const ANY = "__any";

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
  const kind = asStr(sp.kind) === ANY ? "" : asStr(sp.kind);
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
      <QueueColumn>
        <QueueHead title="Certification queue" lede={LEDE} />
        <InlineError>
          Could not load queue
          {error?.message ? <>: {error.message}</> : null}.
        </InlineError>
      </QueueColumn>
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
    <QueueColumn>
      <QueueHead
        title="Certification queue"
        lede={`${LEDE} ${doc.total} total in current filter.`}
        actions={<HeadLink href="/admin/queue?type=cert_doc_review">Review hub</HeadLink>}
      />

      <QueueFilter action="/admin/certifications">
        <Field label="Status" className="min-w-[200px]">
          {(a) => (
            <Select
              {...a}
              name="status"
              defaultValue={status}
              options={STATUSES.map((s) => ({ value: s, label: humanizeAdminToken(s) }))}
            />
          )}
        </Field>
        <Field label="Cert kind" className="min-w-[200px]">
          {(a) => (
            <Select
              {...a}
              name="kind"
              defaultValue={kind || ANY}
              options={[
                { value: ANY, label: "Any" },
                ...CERT_KINDS.map((k) => ({ value: k, label: humanizeAdminToken(k) })),
              ]}
            />
          )}
        </Field>
        <Button type="submit" kind="primary">
          Apply
        </Button>
      </QueueFilter>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-semibold text-ink">Certification queue</h2>
          <p className="text-sm text-ink-3">{`${doc.total} total · page ${page} / ${totalPages}`}</p>
        </div>
        {doc.rows.length === 0 ? (
          <Empty title="No certifications in this state">Try a different status or certificate kind.</Empty>
        ) : (
          <QueueTable
            noun="certifications"
            total={doc.total}
            page={page}
            pages={totalPages}
            perPage={PAGE_SIZE}
            shown={doc.rows.length}
            pageHref={pageHref}
          >
            <Table>
              <caption className="sr-only">Certification queue</caption>
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th>Certificate</Th>
                  <Th>Details</Th>
                  <Th>Document</Th>
                  <Th>Submitted</Th>
                  <Th align="right">
                    <span className="sr-only">Action</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {doc.rows.map((r) => (
                  <Tr key={r.queue_id} className="align-top">
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <SupplierLink id={r.supplier.id}>{r.supplier.company_name}</SupplierLink>
                        <TypeChip>{humanizeAdminToken(r.supplier.entity_type)}</TypeChip>
                      </span>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <TypeChip>{humanizeAdminToken(r.cert.kind)}</TypeChip>
                        {r.cert.verified ? (
                          <Chip icon={CheckCircle}>verified</Chip>
                        ) : r.cert.rejected_at ? (
                          <FactChip state="disagree">rejected</FactChip>
                        ) : null}
                        {r.admin_action ? <TypeChip>{r.admin_action}</TypeChip> : null}
                      </span>
                    </Td>
                    <Td>
                      <span className="block text-sm text-ink-3">
                        {r.cert.certificate_no ?? "—"} · issuer {r.cert.issuer ?? "—"} · expires{" "}
                        {r.cert.expires_on ?? "—"}
                        {r.cert.scope ? <span className="block text-ink-2">{r.cert.scope}</span> : null}
                        {r.cert.rejected_reason ? (
                          <span className="block text-ink-2">Reason: {r.cert.rejected_reason}</span>
                        ) : null}
                      </span>
                    </Td>
                    <Td>{r.cert.document_url ? <OutLink href={r.cert.document_url} /> : "—"}</Td>
                    <Td>
                      <span className="block text-sm text-ink-3">
                        by <span className="font-mono">{r.uploaded_by_email ?? "—"}</span> ·{" "}
                        {formatAdminDate(r.queue_created_at)}
                        {r.reviewed_at ? ` · reviewed ${formatAdminDate(r.reviewed_at)}` : ""}
                      </span>
                    </Td>
                    <Td align="right">
                      {r.reviewed_at == null ? (
                        <AdminCertDecideButton
                          queueId={r.queue_id}
                          label={`${r.supplier.company_name} · ${r.cert.kind}`}
                        />
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </QueueTable>
        )}
      </section>
    </QueueColumn>
  );
}

const LEDE =
  "Review supplier-uploaded certifications. Approve to mark the cert verified; reject to soft-delete with a reason.";
