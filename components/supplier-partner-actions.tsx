"use client";

// Spec S5 — accept/reject/revoke action buttons on /supplier/partners.
// Thin client island that POSTs to /api/v1/supplier/relationships and
// refreshes the server-rendered list.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function PartnerActionButtons({
  id,
  canDecide,
  canRevoke,
}: {
  id: string;
  canDecide: boolean;
  canRevoke: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function call(payload: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/v1/supplier/relationships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        setError(j.detail ?? j.error ?? "Action failed.");
        return;
      }
      router.refresh();
    });
  }

  if (!canDecide && !canRevoke) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {canDecide ? (
          <>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => call({ action: "decide", id, accept: true })}
            >
              Accept
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => call({ action: "decide", id, accept: false })}
            >
              Reject
            </Button>
          </>
        ) : null}
        {canRevoke ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (
                typeof window !== "undefined" &&
                !window.confirm("Revoke this partnership?")
              ) {
                return;
              }
              call({ action: "revoke", id });
            }}
          >
            Revoke
          </Button>
        ) : null}
      </div>
      {error ? <p className="text-[11px] text-sem-red">{error}</p> : null}
    </div>
  );
}
