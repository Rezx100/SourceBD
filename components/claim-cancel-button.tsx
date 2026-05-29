"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

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
    <div className="space-y-1">
      <Button type="button" variant="danger" size="sm" onClick={cancel} disabled={pending}>
        {pending ? "Cancelling…" : "Cancel claim"}
      </Button>
      {error ? <p className="text-xs text-sem-red">{error}</p> : null}
    </div>
  );
}
