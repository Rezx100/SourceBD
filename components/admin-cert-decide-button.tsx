"use client";

// Admin cert decide island (Spec A3). Approve fires immediately;
// reject reveals a required reason input and confirms on second click.
// R6: surfaced through a Sheet row-action menu with 44×44 controls.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

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
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-pill border border-hairline px-4 text-xs font-semibold text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
      >
        Review
      </button>
      <Sheet
        open={sheetOpen}
        onClose={close}
        side="bottom"
        label={label ?? "Review certification"}
      >
        <div className="flex flex-col gap-3 p-4">
          <Button
            type="button"
            variant="primary"
            onClick={() => decide("approve")}
            disabled={pending}
            className="min-h-[44px] w-full"
          >
            Approve
          </Button>
          {rejecting ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason (required)"
                maxLength={2000}
                className="min-h-[44px] w-full rounded-input border border-hairline bg-bg-l0 px-3 text-sm outline-none focus:border-accent-indigo"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  if (reason.trim().length === 0) {
                    setError("Reason is required when rejecting.");
                    return;
                  }
                  decide("reject");
                }}
                disabled={pending}
                className="min-h-[44px] w-full"
              >
                Confirm reject
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setRejecting(true);
                setError(null);
              }}
              disabled={pending}
              className="min-h-[44px] w-full"
            >
              Reject
            </Button>
          )}
          {error ? <p className="text-xs text-sem-red">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
