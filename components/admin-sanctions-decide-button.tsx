"use client";

// Admin sanctions decide island (Spec A4). Both Confirm and Clear
// reveal a required reason input on first click and commit on second
// click — the server-side RPC requires a non-blank reason for either
// decision.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

type Decision = "confirm" | "clear";

export function AdminSanctionsDecideButton({ queueId }: { queueId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState<Decision | null>(null);
  const [pending, startTransition] = useTransition();

  function fire(decision: Decision) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/sanctions/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            queue_id: queueId,
            decision,
            reason: reason.trim(),
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

  function handle(decision: Decision) {
    if (open !== decision) {
      setOpen(decision);
      setError(null);
      return;
    }
    if (reason.trim().length === 0) {
      setError("Reason is required.");
      return;
    }
    fire(decision);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => handle("confirm")}
          disabled={pending}
        >
          {open === "confirm" ? "Confirm sanction" : "Confirm"}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => handle("clear")}
          disabled={pending}
        >
          {open === "clear" ? "Confirm clear" : "Clear"}
        </Button>
      </div>
      {open ? (
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            open === "confirm"
              ? "Reason for confirming sanction (required)"
              : "Reason for clearing (required)"
          }
          maxLength={2000}
          className="w-80 rounded-input border border-hairline bg-bg-l0 px-2 py-1 text-xs outline-none focus:border-accent-indigo"
        />
      ) : null}
      {error ? <p className="text-xs text-sem-red">{error}</p> : null}
    </div>
  );
}
