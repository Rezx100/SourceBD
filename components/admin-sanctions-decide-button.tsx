"use client";

// Admin sanctions decide island (Spec A4). Both Confirm and Clear
// reveal a required reason input on first click and commit on second
// click — the server-side RPC requires a non-blank reason for either
// decision. Surfaced through a dialog from the row's Decide button.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Dialog, Input } from "@/components/kit";

type Decision = "confirm" | "clear";

export function AdminSanctionsDecideButton({
  queueId,
  label,
}: {
  queueId: string;
  label?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [active, setActive] = useState<Decision | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setSheetOpen(false);
    setActive(null);
    setReason("");
    setError(null);
  }

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
        close();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function handle(decision: Decision) {
    if (active !== decision) {
      setActive(decision);
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
    <Dialog
      open={sheetOpen}
      onOpenChange={(o) => (o ? setSheetOpen(true) : close())}
      kind="form"
      title={label ?? "Decide sanctions hit"}
      trigger={<Button type="button">Decide</Button>}
    >
      <Button type="button" kind="danger" onClick={() => handle("confirm")} disabled={pending} full>
        {active === "confirm" ? "Confirm sanction" : "Confirm"}
      </Button>
      <Button type="button" kind="primary" onClick={() => handle("clear")} disabled={pending} full>
        {active === "clear" ? "Confirm clear" : "Clear"}
      </Button>
      {active ? (
        <Input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={
            active === "confirm"
              ? "Reason for confirming sanction (required)"
              : "Reason for clearing (required)"
          }
          aria-label="Reason"
          maxLength={2000}
        />
      ) : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </Dialog>
  );
}
