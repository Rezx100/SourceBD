// Verification consumer (Spec S1).
//
// The email link points here with `?token=…`. We hit the API route (so all
// auth/anon semantics live in one place), then redirect to the claim
// status page on success or render an error card on failure.

import { headers } from "next/headers";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";

export const dynamic = "force-dynamic";

function originFromHeaders(headers: Headers): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = headers.get("x-forwarded-proto") ?? "http";
  const host =
    headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

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
  const origin = originFromHeaders(h as unknown as Headers);

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
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Email verified</CardTitle>
          <CardMeta>Spec S1</CardMeta>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Tag>{approved ? "Claim approved" : "Awaiting admin review"}</Tag>
          <p className="text-ink-secondary">
            {approved
              ? "Your domain matched the company record. You now own this profile."
              : "Thanks. An admin will review your request and notify you of the decision."}
          </p>
          {result.claim_id ? (
            <Button asChild variant="primary">
              <Link href={`/supplier/claim/${result.claim_id}`}>View claim</Link>
            </Button>
          ) : (
            <Button asChild variant="primary">
              <Link href="/supplier/claim">Back to claims</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ErrorCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardMeta>Spec S1</CardMeta>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-ink-secondary">{detail}</p>
          <Button asChild variant="outline">
            <Link href="/supplier/claim">Back to claims</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
