"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, Dialog, fieldBox, fieldEdge } from "@/components/kit";
import { cn } from "@/lib/utils";

type Decision = "release" | "reject" | "escalate";

export function AdminQueueDecideButton({
  queueId,
  label,
  destination,
}: {
  queueId: string;
  label: string;
  destination?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setActive(null);
    setNote("");
    setError(null);
  }

  function decide(decision: Decision) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/queue/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            queue_id: queueId,
            decision,
            note: note.trim() || null,
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
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => (o ? setOpen(true) : close())}
      kind="form"
      title={label}
      trigger={<Button type="button">Review</Button>}
    >
      <p className="text-base text-ink-2">
        {destination
          ? `Release sends this to buyers as: ${destination}`
          : "Release moves or publishes the profile so a buyer can see the right company. Reject closes the ticket without changing what buyers see."}
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note for the audit log"
        aria-label="Note for the audit log"
        maxLength={2000}
        rows={3}
        className={cn(fieldBox, fieldEdge, "px-2.5 py-2 text-base")}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          type="button"
          disabled={pending}
          full
          onClick={() => {
            setActive("release");
            decide("release");
          }}
        >
          {pending && active === "release" ? "Saving..." : "Release"}
        </Button>
        <Button
          type="button"
          kind="danger"
          disabled={pending}
          full
          onClick={() => {
            setActive("reject");
            decide("reject");
          }}
        >
          {pending && active === "reject" ? "Saving..." : "Reject"}
        </Button>
        <Button
          type="button"
          disabled={pending}
          full
          onClick={() => {
            setActive("escalate");
            decide("escalate");
          }}
        >
          {pending && active === "escalate" ? "Saving..." : "Escalate"}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </Dialog>
  );
}
