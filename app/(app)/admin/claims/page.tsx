// Admin claim queue (Spec S1 — minimal stub).
//
// Lists `email_verified` claims (`manual_review` method that has cleared
// email verification and is awaiting an admin decision). The full
// admin-console page lands in spec A3 (Phase 4); this stub gives admins a
// way to act on S1 traffic now.

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
import { ClaimAdminDecideButton } from "@/components/claim-admin-decide-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AdminRow = {
  id: string;
  status: string;
  method: string;
  proof_email: string;
  note: string | null;
  created_at: string;
  email_verified_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  claimant_email: string;
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    city: string | null;
    district: string | null;
    website: string | null;
  };
};

export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "email_verified";
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_admin_list", {
    p_status: status,
  });
  const rows = ((data as { results?: AdminRow[] } | null)?.results ??
    []) as AdminRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="mb-2 inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-brand-forest">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-forest" />
            Admin
          </p>
          <h1 className="font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink-primary sm:text-[32px]">
            Supplier claims
          </h1>
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-ink-secondary">
            Manual-review claims that have cleared email verification.
            Filter: <strong>{status}</strong>.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-xs">
          {(["email_verified", "approved", "rejected", "all"] as const).map(
            (s) => (
              <Link
                key={s}
                href={`/admin/claims?status=${s}`}
                className={`rounded-pill border px-2 py-1 ${
                  s === status
                    ? "border-accent-indigo text-accent-indigo"
                    : "border-hairline text-ink-tertiary hover:text-ink-primary"
                }`}
              >
                {s.replace("_", " ")}
              </Link>
            ),
          )}
        </nav>
      </div>

      {error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-sem-red">
              Failed to load: {error.message}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
          <CardMeta>{rows.length} shown</CardMeta>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-ink-tertiary">No claims in this state.</p>
          ) : (
            <ResponsiveTable
              mode="stacked"
              columns={CLAIM_COLUMNS}
              rows={rows}
              rowKey={(r) => r.id}
              caption="Supplier claims"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const CLAIM_COLUMNS: Column<AdminRow>[] = [
  {
    key: "supplier",
    label: "Supplier",
    render: (r) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Link
          href={`/suppliers/${r.supplier.slug}`}
          className="text-sm font-semibold text-ink-primary hover:underline"
          target="_blank"
        >
          {r.supplier.company_name}
        </Link>
        <Tag>{r.method === "domain_email" ? "Domain" : "Manual"}</Tag>
        <Tag>{r.status}</Tag>
      </span>
    ),
  },
  {
    key: "where",
    label: "Entity",
    render: (r) => (
      <span className="block text-xs text-ink-tertiary">
        {r.supplier.entity_type.replace(/_/g, " ")} ·{" "}
        {[r.supplier.city, r.supplier.district].filter(Boolean).join(", ") ||
          "—"}
        {r.supplier.website ? ` · ${r.supplier.website}` : ""}
      </span>
    ),
  },
  {
    key: "proof",
    label: "Proof",
    render: (r) => (
      <span className="block text-xs text-ink-secondary">
        <span className="font-mono text-ink-primary">{r.proof_email}</span> ·
        claimant <span className="font-mono">{r.claimant_email}</span>
      </span>
    ),
  },
  {
    key: "meta",
    label: "Verified",
    render: (r) => (
      <span className="block text-[11px] text-ink-tertiary">
        {r.email_verified_at
          ? new Date(r.email_verified_at).toLocaleDateString()
          : "—"}
        {r.decided_at
          ? ` · decided ${new Date(r.decided_at).toLocaleDateString()}`
          : ""}
        {r.note ? <span className="block text-ink-secondary">{r.note}</span> : null}
        {r.decision_note ? (
          <span className="block">Decision: {r.decision_note}</span>
        ) : null}
      </span>
    ),
  },
  {
    key: "action",
    label: "",
    numeric: true,
    render: (r) =>
      r.status === "email_verified" ? (
        <ClaimAdminDecideButton id={r.id} label={r.supplier.company_name} />
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
];

