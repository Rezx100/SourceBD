"use client";

// Admin decision island (Spec S1). Renders Approve + Reject buttons in a
// Sheet row-action menu (R6) at /admin/claims.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

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
        label={label ?? "Decide claim"}
      >
        <div className="flex flex-col gap-3 p-4">
          <Button
            type="button"
            variant="primary"
            onClick={() => decide(true)}
            disabled={pending}
            className="min-h-[44px] w-full"
          >
            Approve
          </Button>
          {rejecting ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason (optional)"
                maxLength={1000}
                className="min-h-[44px] w-full rounded-input border border-hairline bg-bg-l0 px-3 text-sm outline-none focus:border-accent-indigo"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => decide(false)}
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
