"use client";

// Admin decision island (Spec S1). Renders Approve + Reject buttons in a
// dialog opened from the row at /admin/claims.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Dialog, Input } from "@/components/kit";

export function ClaimAdminDecideButton({
  id,
  label,
}: {
  id: string;
  label?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    setSheetOpen(false);
    setRejecting(false);
    setNote("");
    setError(null);
  }

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
        close();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <Dialog
      open={sheetOpen}
      onOpenChange={(o) => (o ? setSheetOpen(true) : close())}
      kind="form"
      title={label ?? "Decide claim"}
      trigger={<Button type="button">Decide</Button>}
    >
      <Button type="button" kind="primary" onClick={() => decide(true)} disabled={pending} full>
        Approve
      </Button>
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <Input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason (optional)"
            aria-label="Reason for rejecting"
            maxLength={1000}
          />
          <Button type="button" kind="danger" onClick={() => decide(false)} disabled={pending} full>
            Confirm reject
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          kind="danger"
          onClick={() => {
            setRejecting(true);
            setError(null);
          }}
          disabled={pending}
          full
        >
          Reject
        </Button>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </Dialog>
  );
}
