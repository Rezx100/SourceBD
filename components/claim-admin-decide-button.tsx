"use client";

// Admin decision island (Spec S1). Renders Approve + Reject buttons inline
// in the admin queue at /admin/claims.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function ClaimAdminDecideButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function decide(approve: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/claims", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "admin_decide",
            id,
            approve,
            note: note.trim() || null,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
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
          onClick={() => decide(true)}
          disabled={pending}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => (open ? decide(false) : setOpen(true))}
          disabled={pending}
        >
          {open ? "Confirm reject" : "Reject"}
        </Button>
      </div>
      {open ? (
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (optional)"
          maxLength={1000}
          className="w-64 rounded-input border border-hairline bg-bg-l0 px-2 py-1 text-xs outline-none focus:border-accent-indigo"
        />
      ) : null}
      {error ? <p className="text-xs text-sem-red">{error}</p> : null}
    </div>
  );
}
