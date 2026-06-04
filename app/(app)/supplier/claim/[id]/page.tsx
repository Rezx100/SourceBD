// Single claim status page (Spec S1).

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
import { ClaimCancelButton } from "@/components/claim-cancel-button";
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
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link
          href="/supplier/claim"
          className="text-xs text-ink-tertiary hover:text-ink-primary"
        >
          ← All claims
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          {claim.supplier.company_name}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {[claim.supplier.city, claim.supplier.district]
            .filter(Boolean)
            .join(", ")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardMeta>{claim.method === "domain_email" ? "Domain proof" : "Manual review"}</CardMeta>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Tag>{statusLabel(claim.status)}</Tag>
          </div>
          <dl className="grid grid-cols-[140px_1fr] gap-y-1 text-xs text-ink-secondary">
            <dt>Proof email</dt>
            <dd className="font-mono text-ink-primary">{claim.proof_email}</dd>
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
            <p className="rounded-input border border-hairline bg-bg-l0 p-3 text-xs text-ink-secondary">
              {claim.decision_note}
            </p>
          ) : null}
          {claim.status === "pending_email" ? (
            <p className="text-xs text-ink-tertiary">
              Check {claim.proof_email} for a confirmation link from SourceBD.
              Links expire after 24 hours.
            </p>
          ) : null}
          {claim.status === "approved" ? (
            <p className="text-xs text-ink-secondary">
              You now own this profile. Profile editing ships in spec S2.
            </p>
          ) : null}
          {cancellable ? <ClaimCancelButton id={claim.id} /> : null}
        </CardContent>
      </Card>
    </div>
  );
}
