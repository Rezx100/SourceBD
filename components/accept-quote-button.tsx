"use client";

// Client button that POSTs `{action:"accept_quote", quote_id}` to
// /api/v1/rfqs and reloads on success.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function AcceptQuoteButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/rfqs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept_quote", quote_id: quoteId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { detail?: string; error?: string }
          | null;
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="primary"
        onClick={accept}
        disabled={busy || pending}
      >
        {busy || pending ? "Accepting…" : "Accept"}
      </Button>
      {error ? <span className="text-[12px] text-sem-red">{error}</span> : null}
    </div>
  );
}
