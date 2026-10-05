// Verification consumer (Spec S1).
//
// The email link points here with `?token=…`. We hit the API route (so all
// auth/anon semantics live in one place), then redirect to the claim
// status page on success or render an error card on failure.

import { headers } from "next/headers";

import { ClaimStatusChip, ClaimSteps } from "@/components/claim/parts";
import { ButtonLink, ErrorPanel } from "@/components/kit";
import { AppOriginError, getCanonicalAppOrigin } from "@/lib/app-origin";

export const dynamic = "force-dynamic";

export default async function ClaimVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = sp.token?.trim();

  if (!token) {
    return (
      <ErrorCard
        title="Missing token"
        detail="The verification link is malformed. Try opening it from your email again."
      />
    );
  }

  const h = await headers();
  let origin: string;
  try {
    origin = getCanonicalAppOrigin(h as unknown as Headers);
  } catch (err) {
    return (
      <ErrorCard
        title="Configuration error"
        detail={
          err instanceof AppOriginError
            ? err.message
            : "Unable to resolve the app origin."
        }
      />
    );
  }

  let result: {
    ok?: boolean;
    error?: string;
    detail?: string;
    claim_id?: string;
    outcome?: "approved" | "pending_admin";
  } = {};
  try {
    const res = await fetch(`${origin}/api/v1/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ action: "verify", token }),
    });
    result = (await res.json()) as typeof result;
    if (!res.ok) result.ok = false;
  } catch (e) {
    return (
      <ErrorCard
        title="Could not verify"
        detail={e instanceof Error ? e.message : String(e)}
      />
    );
  }

  if (!result.ok) {
    return (
      <ErrorCard
        title="Verification failed"
        detail={result.detail ?? result.error ?? "Unknown error"}
      />
    );
  }

  const approved = result.outcome === "approved";
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <ClaimSteps current={2} />
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Email verified</h1>
      </header>
      <div>
        <ClaimStatusChip status={approved ? "approved" : "email_verified"}>
          {approved ? "Claim approved" : "Awaiting admin review"}
        </ClaimStatusChip>
      </div>
      <p className="text-md text-ink-2">
        {approved
          ? "Your domain matched the company record. You now own this profile."
          : "Thanks. An admin will review your request and notify you of the decision."}
      </p>
      <div>
        {result.claim_id ? (
          <ButtonLink kind="primary" href={`/supplier/claim/${result.claim_id}`}>
            View claim
          </ButtonLink>
        ) : (
          <ButtonLink kind="primary" href="/supplier/claim">
            Back to claims
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      </header>
      <ErrorPanel title={detail} retry={<ButtonLink href="/supplier/claim">Back to claims</ButtonLink>} />
    </div>
  );
}
