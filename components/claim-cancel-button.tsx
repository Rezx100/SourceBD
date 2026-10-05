"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, InlineError } from "@/components/kit";

export function ClaimCancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    if (!confirm("Cancel this claim request?")) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/claims", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "cancel", id }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        router.refresh();
        router.push("/supplier/claim");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button type="button" kind="danger" onClick={cancel} loading={pending} loadingLabel="Cancelling…">
          Cancel claim
        </Button>
      </div>
      {error ? <InlineError>{error}</InlineError> : null}
    </div>
  );
}
