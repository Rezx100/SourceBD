"use client";

// Admin cert decide island (Spec A3). Approve fires immediately;
// reject reveals a required reason input and confirms on second click.
// Surfaced through a dialog from the row's Review button.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Dialog, Input } from "@/components/kit";

export function AdminCertDecideButton({
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
  const [rejecting, setRejecting] = useState(false);
  const [pending, startTransition] = useTransition();

  function close() {
    setSheetOpen(false);
    setRejecting(false);
    setReason("");
    setError(null);
  }

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
      title={label ?? "Review certification"}
      trigger={<Button type="button">Review</Button>}
    >
      <Button type="button" kind="primary" onClick={() => decide("approve")} disabled={pending} full>
        Approve
      </Button>
      {rejecting ? (
        <div className="flex flex-col gap-2">
          <Input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (required)"
            aria-label="Reason for rejecting"
            maxLength={2000}
          />
          <Button
            type="button"
            kind="danger"
            onClick={() => {
              if (reason.trim().length === 0) {
                setError("Reason is required when rejecting.");
                return;
              }
              decide("reject");
            }}
            disabled={pending}
            full
          >
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
