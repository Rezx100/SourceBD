// Supplier claim landing page (Spec S1).
//
// Lists the supplier-role caller's claim history and exposes the
// search-and-initiate form. Server-rendered; the form is a client island
// that calls `/api/v1/claims`.

import Link from "next/link";

import { ClaimSearchForm } from "@/components/claim-search-form";
import { ClaimStatusChip, ClaimSteps } from "@/components/claim/parts";
import { Empty, ErrorPanel } from "@/components/kit";
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

  const { data: mineData, error: mineError } = await supabase.rpc("claim_list_mine");
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
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Claim your company</h1>
        <p className="text-md text-ink-2">
          Search the SourceBD directory, then verify ownership via your company email. If your email domain matches the published company domain, your claim is approved automatically.
        </p>
      </header>

      <ClaimSteps current={0} />

      <section aria-labelledby="claim-find" className="flex flex-col gap-4 rounded-md border border-line p-5">
        <h2 id="claim-find" className="text-lg font-semibold text-ink">
          Find your company
        </h2>
        <ClaimSearchForm prebound={prebound} />
      </section>

      <section aria-labelledby="claim-mine" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="claim-mine" className="text-lg font-semibold text-ink">
            Your claims
          </h2>
          {mineError ? null : <p className="text-sm text-ink-3">{claims.length} total</p>}
        </div>
        {mineError ? (
          <ErrorPanel title="Could not load your claims">Reload the page to try again.</ErrorPanel>
        ) : claims.length === 0 ? (
          <Empty title="No claim requests yet." />
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {claims.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/supplier/claim/${c.id}`}
                    className="text-base font-medium text-ink underline-offset-2 hover:underline"
                  >
                    {c.supplier.company_name}
                  </Link>
                  <p className="text-sm text-ink-3">
                    {[c.supplier.city, c.supplier.district]
                      .filter(Boolean)
                      .join(", ")}{" "}
                    · {c.proof_email}
                  </p>
                  <p className="mt-1 text-sm text-ink-3">
                    Started {new Date(c.created_at).toLocaleDateString()} ·{" "}
                    {c.method === "domain_email" ? "Domain proof" : "Manual review"}
                  </p>
                </div>
                <ClaimStatusChip status={c.status}>{statusLabel(c.status)}</ClaimStatusChip>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
