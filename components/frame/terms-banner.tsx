"use client";

// The terms a supplier has not yet accepted (moderation plan 1d, legal track 4.10): a banner on the portal
// home naming the current version with one button. Accepting posts to /api/v1/settings, which writes
// profiles.terms_version through `terms_accept`; the record's trigger on profiles keeps the acceptance as
// `account.terms_accepted`, with the time, the account and where it came from.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, linkClass } from "@/components/kit";
import { cn } from "@/lib/utils";

export function TermsAcceptBanner({ version, accepted }: { version: string; accepted: string | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/settings", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "accept_terms", version }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <section aria-label="Terms of Service" className="flex flex-col gap-3 rounded-md border border-line bg-subtle p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-base font-medium text-ink">
          {accepted ? `Our Terms of Service changed (version ${version}).` : "Please accept the Terms of Service to use the supplier portal."}
        </p>
        <p className="text-sm text-ink-2">
          {accepted ? `You accepted version ${accepted}. ` : ""}
          Read the{" "}
          <a href="/legal/terms" className={cn(linkClass)} target="_blank" rel="noreferrer">
            Terms of Service
          </a>{" "}
          and the{" "}
          <a href="/legal/privacy" className={cn(linkClass)} target="_blank" rel="noreferrer">
            Privacy Notice
          </a>
          . Your acceptance is recorded with the date and your account.
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      <Button kind="primary" onClick={accept} disabled={pending} loading={pending} loadingLabel="Saving" className="shrink-0">
        I accept the terms
      </Button>
    </section>
  );
}
