// Certification expiry dashboard — Spec B9 (/app/compliance/expiry).
//
// Server component. Calls compliance_expiring_certs(90) and renders a
// table grouped into 30 / 60 / 90 day urgency buckets, oldest-due first.

import Link from "next/link";
import {
  ArrowLeft,
  Certificate,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-dynamic";

type CertRow = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  expires_on: string;
  document_url: string | null;
  days_remaining: number;
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    city: string | null;
    district: string | null;
  };
};
type ExpiryPayload = {
  window_days: number;
  bucket_30: number;
  bucket_60: number;
  bucket_90: number;
  total: number;
  rows: CertRow[];
};

export default async function ExpiryPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("compliance_expiring_certs", {
    p_window_days: 90,
  });
  const payload = (data ?? null) as ExpiryPayload | null;

  const b30 = (payload?.rows ?? []).filter((r) => r.days_remaining < 30);
  const b60 = (payload?.rows ?? []).filter(
    (r) => r.days_remaining >= 30 && r.days_remaining < 60,
  );
  const b90 = (payload?.rows ?? []).filter(
    (r) => r.days_remaining >= 60 && r.days_remaining < 90,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/app/compliance"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-tertiary transition-colors hover:text-ink-primary"
        >
          <ArrowLeft size={13} weight="bold" aria-hidden /> Compliance
        </Link>
        <PageHeader
          kicker="Compliance"
          title="Certification expiry — next 90 days"
          description="Renewal dates for saved suppliers, grouped by urgency so your team can follow up before a certificate lapses."
        />
      </div>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load expiring certifications.
          </CardContent>
        </Card>
      ) : null}

      {payload && payload.total === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-ink-secondary">
            No certifications expiring on your saved set in the next 90 days.
          </CardContent>
        </Card>
      ) : null}

      {payload ? (
        <section
          aria-label="Expiry summary"
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <SummaryCard label="Needs action" value={b30.length} hint="<30 days" tone="alert" />
          <SummaryCard label="Plan next" value={b60.length} hint="30-60 days" tone="active" />
          <SummaryCard label="Watchlist" value={b90.length} hint="60-90 days" tone="neutral" />
          <SummaryCard label="Total" value={payload.total} hint="saved set" tone="neutral" />
        </section>
      ) : null}

      <Bucket
        title="Needs action now"
        description="Certificates that are close enough to follow up this week."
        tone="alert"
        rows={b30}
      />
      <Bucket
        title="Plan next"
        description="Renewals to schedule with the supplier before they become urgent."
        tone="active"
        rows={b60}
        showEvidence={false}
      />
      <Bucket
        title="Watchlist"
        description="Later renewals inside the 90-day window."
        tone="neutral"
        rows={b90}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "neutral" | "active" | "alert";
}) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-ink-tertiary">{label}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink-primary">
            {value.toLocaleString()}
          </p>
        </div>
        <Badge tone={tone}>{hint}</Badge>
      </div>
    </Card>
  );
}

function Bucket({
  title,
  description,
  tone,
  rows,
  showEvidence = true,
}: {
  title: string;
  description: string;
  tone: "neutral" | "active" | "alert";
  rows: CertRow[];
  showEvidence?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col items-start gap-3 border-b border-hairline bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <CardMeta className="mt-1 block max-w-2xl whitespace-normal font-body text-[13px] leading-relaxed">
            {description}
          </CardMeta>
        </div>
        <Badge tone={tone}>
          {rows.length} renewal{rows.length === 1 ? "" : "s"}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className={
            showEvidence
              ? "hidden grid-cols-[minmax(0,1.35fr)_minmax(150px,0.85fr)_minmax(130px,0.7fr)_auto] gap-4 border-b border-hairline bg-bg-l0 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-tertiary md:grid"
              : "hidden grid-cols-[minmax(0,1.35fr)_minmax(170px,0.9fr)_minmax(140px,0.55fr)] gap-4 border-b border-hairline bg-bg-l0 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-tertiary md:grid"
          }
        >
          <span>Supplier</span>
          <span>Certificate</span>
          <span>Renewal date</span>
          {showEvidence ? <span className="text-right">Evidence</span> : null}
        </div>
        <div className="divide-y divide-hairline">
          {rows.map((row) => (
            <CertRenewalRow
              key={`${row.supplier.id}-${row.kind}-${row.certificate_no ?? row.expires_on}`}
              row={row}
              showEvidence={showEvidence}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CertRenewalRow({
  row,
  showEvidence,
}: {
  row: CertRow;
  showEvidence: boolean;
}) {
  const cert = prettyCert(row.kind);
  const location =
    [row.supplier.city, row.supplier.district].filter(Boolean).join(", ") ||
    "Location not listed";
  const badgeTone =
    row.days_remaining < 30
      ? "alert"
      : row.days_remaining < 60
        ? "active"
        : "neutral";

  return (
    <div
      className={
        showEvidence
          ? "grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.35fr)_minmax(150px,0.85fr)_minmax(130px,0.7fr)_auto] md:items-start md:gap-4"
          : "grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.35fr)_minmax(170px,0.9fr)_minmax(140px,0.55fr)] md:items-start md:gap-4"
      }
    >
      <div className="min-w-0">
        <Link
          href={`/app/suppliers/${row.supplier.slug}`}
          className="font-medium text-ink-primary underline-offset-2 hover:underline"
        >
          {row.supplier.company_name}
        </Link>
        <p className="mt-0.5 text-[12px] text-ink-tertiary">{location}</p>
      </div>

      <div className="min-w-0">
        <Tag tone="neutral">
          <Certificate size={12} weight="fill" />
          {cert}
        </Tag>
        {row.certificate_no ? (
          <p className="mt-1 font-mono text-[11px] text-ink-tertiary">
            {row.certificate_no}
          </p>
        ) : null}
        <p className="mt-1 text-[12px] text-ink-tertiary">
          Issued by {row.issuer ?? cert}
        </p>
      </div>

      <div className="flex items-center gap-2 md:block">
        <p className="text-sm tabular-nums text-ink-primary">
          {fmtDate(row.expires_on)}
        </p>
        <Badge tone={badgeTone} className="mt-0 md:mt-1">
          <WarningCircle size={11} weight="fill" />
          {row.days_remaining}d
        </Badge>
      </div>

      {showEvidence ? (
        <div className="md:text-right">
          {row.document_url ? (
            <a
              href={row.document_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-control border border-hairline bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-secondary transition-colors hover:border-neutral-300 hover:text-ink-primary"
            >
              <FileText size={12} /> Open document
            </a>
          ) : (
            <span className="text-[12px] text-ink-tertiary">No document</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function prettyCert(k: string): string {
  switch (k) {
    case "wrap":
      return "WRAP";
    case "oeko_tex":
      return "OEKO-TEX";
    case "gots":
      return "GOTS";
    case "sa8000":
      return "SA8000";
    case "bsci":
      return "BSCI";
    case "ocs":
      return "OCS";
    case "grs":
      return "GRS";
    case "rcs":
      return "RCS";
    case "sedex":
      return "Sedex";
    case "higg":
      return "Higg";
    case "fairtrade":
      return "Fairtrade";
    default:
      return k.toUpperCase();
  }
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
