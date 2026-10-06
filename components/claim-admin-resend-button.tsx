"use client";

// Resend a claim's verification link (0129). One click: the database issues a fresh 24-hour token and the
// route emails it through the journaled sender, so the row's "Verification email" cell shows the result on
// the refresh that follows.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/kit";

export function ClaimAdminResendButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resend() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/claims", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "admin_resend", id }),
        });
        const j = (await res.json().catch(() => null)) as { detail?: string; error?: string; email_sent?: boolean } | null;
        if (!res.ok) {
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        setDone(j?.email_sent ? "Sent" : "Link renewed; the email did not go out (see the journal)");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <Button type="button" onClick={resend} disabled={pending} loading={pending} loadingLabel="Sending">
        Resend link
      </Button>
      {done ? <span className="text-sm text-ink-3">{done}</span> : null}
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
