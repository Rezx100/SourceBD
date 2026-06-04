// Certification expiry dashboard — Spec B9 (/app/compliance/expiry).
//
// Server component. Calls compliance_expiring_certs(90) and renders a
// table grouped into 30 / 60 / 90 day urgency buckets, oldest-due first.

import Link from "next/link";
import { ArrowLeft, Certificate, FileText } from "@phosphor-icons/react/dist/ssr";

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
      <header className="space-y-2">
        <Link
          href="/app/compliance"
          className="inline-flex items-center gap-1 text-[12px] text-ink-tertiary hover:text-ink-secondary"
        >
          <ArrowLeft size={12} /> Compliance
        </Link>
        <h1 className="font-display text-2xl font-semibold text-ink-primary">
          Certification expiry — next 90 days
        </h1>
        <p className="text-sm text-ink-secondary">
          Tracks every cert (BSCI, WRAP, GOTS, SA8000, OCS, GRS, RCS, Sedex,
          Higg, Fairtrade) on your saved suppliers with a known expiry inside
          the next 90 days. OEKO-TEX has no expiry semantics and is excluded.
        </p>
      </header>

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

      <Bucket title="Under 30 days" tone="alert" rows={b30} />
      <Bucket title="30 – 60 days" tone="active" rows={b60} />
      <Bucket title="60 – 90 days" tone="neutral" rows={b90} />
    </div>
  );
}

function Bucket({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "neutral" | "active" | "alert";
  rows: CertRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardMeta>
            {rows.length} certification{rows.length === 1 ? "" : "s"}
          </CardMeta>
        </div>
        <Badge tone={tone}>{rows.length}</Badge>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-[11px] text-ink-tertiary">
                <th className="py-2 pr-4">Supplier</th>
                <th className="py-2 pr-4">Certification</th>
                <th className="py-2 pr-4">Issuer</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2 pr-4 text-right">Days</th>
                <th className="py-2 text-right">Doc</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.supplier.id}-${r.kind}-${r.certificate_no ?? i}`}
                  className="border-b border-hairline/60 last:border-0"
                >
                  <td className="py-2 pr-4">
                    <Link
                      href={`/app/suppliers/${r.supplier.slug}`}
                      className="font-medium text-ink-primary underline-offset-2 hover:underline"
                    >
                      {r.supplier.company_name}
                    </Link>
                    <div className="text-[11px] text-ink-tertiary">
                      {[r.supplier.city, r.supplier.district]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </div>
                  </td>
                  <td className="py-2 pr-4">
                    <Tag tone="neutral">
                      <Certificate size={12} weight="fill" />
                      {prettyCert(r.kind)}
                    </Tag>
                    {r.certificate_no ? (
                      <div className="mt-1 font-mono text-[11px] text-ink-tertiary">
                        {r.certificate_no}
                      </div>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 text-ink-secondary">
                    {r.issuer ?? "—"}
                  </td>
                  <td className="py-2 pr-4 tabular-nums text-ink-secondary">
                    {fmtDate(r.expires_on)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    <Badge
                      tone={
                        r.days_remaining < 30
                          ? "alert"
                          : r.days_remaining < 60
                            ? "active"
                            : "neutral"
                      }
                    >
                      {r.days_remaining}d
                    </Badge>
                  </td>
                  <td className="py-2 text-right">
                    {r.document_url ? (
                      <a
                        href={r.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[12px] text-accent-indigo underline-offset-2 hover:underline"
                      >
                        <FileText size={12} /> Open
                      </a>
                    ) : (
                      <span className="text-[12px] text-ink-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
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
