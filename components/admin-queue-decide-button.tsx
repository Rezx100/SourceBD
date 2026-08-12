"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

type Decision = "approve" | "release" | "reject" | "escalate";

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-pill border border-hairline px-4 text-xs font-semibold text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
      >
        Review
      </button>
      <Sheet open={open} onClose={close} side="bottom" label={label}>
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-ink-secondary">
            {destination
              ? `Release sends this to buyers as: ${destination}`
              : "Release moves or publishes the profile so a buyer can see the right company. Reject closes the ticket without changing what buyers see."}
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for the audit log"
            maxLength={2000}
            rows={3}
            className="w-full rounded-input border border-hairline bg-bg-l0 px-3 py-2 text-sm outline-none focus:border-accent-indigo"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className="min-h-[44px] w-full"
              onClick={() => {
                setActive("approve");
                decide("release");
              }}
            >
              {pending && active === "approve" ? "Saving..." : "Release"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              className="min-h-[44px] w-full"
              onClick={() => {
                setActive("reject");
                decide("reject");
              }}
            >
              {pending && active === "reject" ? "Saving..." : "Reject"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className="min-h-[44px] w-full"
              onClick={() => {
                setActive("escalate");
                decide("escalate");
              }}
            >
              {pending && active === "escalate" ? "Saving..." : "Escalate"}
            </Button>
          </div>
          {error ? <p className="text-xs text-sem-red">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
