"use client";

// Admin sanctions decide island (Spec A4). Both Confirm and Clear
// reveal a required reason input on first click and commit on second
// click — the server-side RPC requires a non-blank reason for either
// decision. R6: surfaced through a Sheet row-action menu with 44×44
// controls.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

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
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-pill border border-hairline px-4 text-xs font-semibold text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
      >
        Decide
      </button>
      <Sheet
        open={sheetOpen}
        onClose={close}
        side="bottom"
        label={label ?? "Decide sanctions hit"}
      >
        <div className="flex flex-col gap-3 p-4">
          <Button
            type="button"
            variant="danger"
            onClick={() => handle("confirm")}
            disabled={pending}
            className="min-h-[44px] w-full"
          >
            {active === "confirm" ? "Confirm sanction" : "Confirm"}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => handle("clear")}
            disabled={pending}
            className="min-h-[44px] w-full"
          >
            {active === "clear" ? "Confirm clear" : "Clear"}
          </Button>
          {active ? (
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                active === "confirm"
                  ? "Reason for confirming sanction (required)"
                  : "Reason for clearing (required)"
              }
              maxLength={2000}
              className="min-h-[44px] w-full rounded-input border border-hairline bg-bg-l0 px-3 text-sm outline-none focus:border-accent-indigo"
            />
          ) : null}
          {error ? <p className="text-xs text-sem-red">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
