// Single claim status page (Spec S1).

import Link from "next/link";
import { notFound } from "next/navigation";

import { ClaimCancelButton } from "@/components/claim-cancel-button";
import { ClaimStatusChip, ClaimSteps } from "@/components/claim/parts";
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
      return "Awaiting email verification";
    case "email_verified":
      return "Awaiting admin review";
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

export default async function ClaimStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: mineData } = await supabase.rpc("claim_list_mine");
  const claims = ((mineData as { results?: ClaimRow[] } | null)?.results ??
    []) as ClaimRow[];
  const claim = claims.find((c) => c.id === id);
  if (!claim) notFound();

  const cancellable =
    claim.status === "pending_email" || claim.status === "email_verified";

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <Link href="/supplier/claim" className="w-fit text-sm text-ink-2 underline-offset-2 hover:text-ink hover:underline">
          ← All claims
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {claim.supplier.company_name}
        </h1>
        <p className="text-md text-ink-2">
          {[claim.supplier.city, claim.supplier.district]
            .filter(Boolean)
            .join(", ")}
        </p>
      </header>

      <ClaimSteps current={claim.status === "pending_email" ? 1 : 2} />

      <section aria-labelledby="claim-status" className="flex flex-col gap-4 rounded-md border border-line p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="claim-status" className="text-lg font-semibold text-ink">
            Status
          </h2>
          <p className="text-sm text-ink-3">
            {claim.method === "domain_email" ? "Domain proof" : "Manual review"}
          </p>
        </div>
        <div>
          <ClaimStatusChip status={claim.status}>{statusLabel(claim.status)}</ClaimStatusChip>
        </div>
        <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm text-ink-2">
          <dt>Proof email</dt>
          <dd className="font-mono text-ink">{claim.proof_email}</dd>
          <dt>Initiated</dt>
          <dd>{new Date(claim.created_at).toLocaleString()}</dd>
          {claim.token_expires_at ? (
            <>
              <dt>Link expires</dt>
              <dd>{new Date(claim.token_expires_at).toLocaleString()}</dd>
            </>
          ) : null}
          {claim.email_verified_at ? (
            <>
              <dt>Email verified</dt>
              <dd>{new Date(claim.email_verified_at).toLocaleString()}</dd>
            </>
          ) : null}
          {claim.decided_at ? (
            <>
              <dt>Decided</dt>
              <dd>{new Date(claim.decided_at).toLocaleString()}</dd>
            </>
          ) : null}
        </dl>
        {claim.decision_note ? (
          <p className="rounded-md bg-subtle p-3 text-sm text-ink-2">
            {claim.decision_note}
          </p>
        ) : null}
        {claim.status === "pending_email" ? (
          <p className="text-sm text-ink-3">
            Check {claim.proof_email} for a confirmation link from SourceBD.
            Links expire after 24 hours.
          </p>
        ) : null}
        {claim.status === "approved" ? (
          <p className="text-sm text-ink-2">
            You now own this profile. Profile editing ships in spec S2.
          </p>
        ) : null}
        {cancellable ? <ClaimCancelButton id={claim.id} /> : null}
      </section>
    </div>
  );
}
