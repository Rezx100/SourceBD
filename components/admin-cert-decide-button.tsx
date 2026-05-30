"use client";

// Admin cert decide island (Spec A3). Approve fires immediately;
// reject reveals a required reason input and confirms on second click.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function AdminCertDecideButton({ queueId }: { queueId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function decide(decision: "approve" | "reject") {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/certifications/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            queue_id: queueId,
            decision,
            reason: decision === "reject" ? reason.trim() : null,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
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
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => decide("approve")}
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => {
            if (!open) {
              setOpen(true);
              return;
            }
            if (reason.trim().length === 0) {
              setError("Reason is required when rejecting.");
              return;
            }
            decide("reject");
          }}
          disabled={pending}
        >
          {open ? "Confirm reject" : "Reject"}
        </Button>
      </div>
      {open ? (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required)"
          maxLength={2000}
          className="w-72 rounded-input border border-hairline bg-bg-l0 px-2 py-1 text-xs outline-none focus:border-accent-indigo"
        />
      ) : null}
      {error ? <p className="text-xs text-sem-red">{error}</p> : null}
    </div>
  );
}
