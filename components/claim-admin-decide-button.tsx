"use client";

// Admin decision island (Spec S1; 0129: any open stage). Approve + Reject in a dialog opened from the row at
// /admin/claims. A reject always needs a reason; an approve needs one too when the claim's email was never
// verified (the admin is vouching without the proof). The database refuses the same, so this only saves a
// round trip.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Dialog, Input } from "@/components/kit";

type Mode = "approve" | "reject" | null;

export function ClaimAdminDecideButton({
  id,
  label,
  stage = "email_verified",
}: {
  id: string;
  label?: string;
  /** The claim's status: a verified one approves without a reason; a pending or expired one needs one. */
  stage?: "pending_email" | "email_verified" | "expired";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [pending, startTransition] = useTransition();
  const verified = stage === "email_verified";

  function close() {
    setSheetOpen(false);
    setMode(null);
    setNote("");
    setError(null);
  }

  function decide(approve: boolean) {
    const reason = note.trim();
    if (!approve && reason.length === 0) {
      setError("A reason is required to reject.");
      return;
    }
    if (approve && !verified && reason.length === 0) {
      setError("A reason is required to approve a claim whose email was never verified.");
      return;
    }
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
            note: reason || null,
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

  const reasonField = (
    <Input
      type="text"
      value={note}
      onChange={(e) => setNote(e.target.value)}
      placeholder={mode === "approve" ? "Why approve without the email proof (required)" : "Reason (required)"}
      aria-label={mode === "approve" ? "Reason for approving" : "Reason for rejecting"}
      maxLength={1000}
    />
  );

  return (
    <Dialog
      open={sheetOpen}
      onOpenChange={(o) => (o ? setSheetOpen(true) : close())}
      kind="form"
      title={label ?? "Decide claim"}
      description={
        verified
          ? "The claimant has verified their proof email."
          : stage === "expired"
            ? "The verification link expired before it was clicked. Approving here means vouching without the email proof."
            : "The claimant has not clicked the verification link. Approving here means vouching without the email proof."
      }
      trigger={<Button type="button">Decide</Button>}
    >
      {mode === "approve" ? (
        <div className="flex flex-col gap-2">
          {reasonField}
          <Button type="button" kind="primary" onClick={() => decide(true)} disabled={pending} full>
            Confirm approve
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          kind="primary"
          onClick={() => {
            if (verified) decide(true);
            else {
              setMode("approve");
              setError(null);
            }
          }}
          disabled={pending}
          full
        >
          Approve
        </Button>
      )}
      {mode === "reject" ? (
        <div className="flex flex-col gap-2">
          {reasonField}
          <Button type="button" kind="danger" onClick={() => decide(false)} disabled={pending} full>
            Confirm reject
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          kind="danger"
          onClick={() => {
            setMode("reject");
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
