// Supplier claim landing page (Spec S1).
//
// Lists the supplier-role caller's claim history and exposes the
// search-and-initiate form. Server-rendered; the form is a client island
// that calls `/api/v1/claims`.

import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { ClaimSearchForm } from "@/components/claim-search-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ClaimRow = {
  id: string;
  status: string;
  method: string;
  proof_email: string;
  created_at: string;
  email_verified_at: string | null;
  token_expires_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  note: string | null;
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    city: string | null;
    district: string | null;
  };
};

function statusLabel(status: string): string {
  switch (status) {
    case "pending_email":
      return "Pending email";
    case "email_verified":
      return "Awaiting admin";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export default async function SupplierClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  const { data: mineData } = await supabase.rpc("claim_list_mine");
  const claims = ((mineData as { results?: ClaimRow[] } | null)?.results ??
    []) as ClaimRow[];

  let prebound: { id: string; company_name: string; slug: string } | null = null;
  if (sp.supplier) {
    const { data: s } = await supabase
      .from("suppliers")
      .select("id, slug, company_name, is_published, is_sanctioned, claimed_by")
      .eq("slug", sp.supplier)
      .maybeSingle();
    if (
      s &&
      s.is_published &&
      !s.is_sanctioned &&
      s.claimed_by === null
    ) {
      prebound = { id: s.id, slug: s.slug, company_name: s.company_name };
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Supplier
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Claim your company
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Search the SourceBD directory, then verify ownership via your
          company email. If your email domain matches the published company
          domain, your claim is approved automatically.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Find your company</CardTitle>
          <CardMeta>Spec S1</CardMeta>
        </CardHeader>
        <CardContent>
          <ClaimSearchForm prebound={prebound} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your claims</CardTitle>
          <CardMeta>{claims.length} total</CardMeta>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <p className="text-sm text-ink-tertiary">
              No claim requests yet.
            </p>
          ) : (
            <ul className="divide-y divide-hairline">
              {claims.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <Link
                      href={`/supplier/claim/${c.id}`}
                      className="text-sm font-semibold text-ink-primary hover:underline"
                    >
                      {c.supplier.company_name}
                    </Link>
                    <p className="text-xs text-ink-tertiary">
                      {[c.supplier.city, c.supplier.district]
                        .filter(Boolean)
                        .join(", ")}{" "}
                      · {c.proof_email}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-tertiary">
                      Started {new Date(c.created_at).toLocaleDateString()} ·{" "}
                      {c.method === "domain_email" ? "Domain proof" : "Manual review"}
                    </p>
                  </div>
                  <Tag>{statusLabel(c.status)}</Tag>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
