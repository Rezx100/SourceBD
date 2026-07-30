"use client";

// Repair actions for one problem citation.
//
// `Recheck` is offered first and deliberately needs no note: most rows an
// operator sees are a source that was unreachable or reshuffled, not a fact that
// was withdrawn, and the cheap correct move is to look again. `Retire` is last
// and demands a note, because it withdraws the evidence behind a fact a buyer
// may already have read.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

type Action = "recheck" | "acknowledge" | "retire";

const NEEDS_NOTE: Action = "retire";

export function AdminEvidenceDecideButton({
  claimId,
  label,
}: {
  claimId: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Action | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close() {
    setOpen(false);
    setActive(null);
    setNote("");
    setError(null);
  }

  function fire(action: Action) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/evidence/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ claim_id: claimId, action, note: note.trim() }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          setError(payload?.detail ?? payload?.error ?? `Failed (${res.status})`);
          return;
        }
        close();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function handle(action: Action) {
    if (action === NEEDS_NOTE) {
      if (active !== action) {
        setActive(action);
        setError(null);
        return;
      }
      if (note.trim().length === 0) {
        setError("A note is required when retiring a claim.");
        return;
      }
    }
    fire(action);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-[44px] min-w-[44px] items-center justify-center rounded-pill border border-hairline px-4 text-xs font-semibold text-ink-secondary hover:border-accent-indigo hover:text-accent-indigo"
      >
        Resolve
      </button>
      <Sheet open={open} onClose={close} side="bottom" label={label ?? "Resolve citation"}>
        <div className="flex flex-col gap-3 p-4">
          <Button
            type="button"
            variant="primary"
            onClick={() => handle("recheck")}
            disabled={pending}
            className="min-h-[44px] w-full"
          >
            Re-check now
          </Button>
          <p className="text-xs text-ink-tertiary">
            Puts this page at the front of the verifier&apos;s queue. Use this first — a
            timeout or a block at check time says nothing about whether the fact is still
            published.
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handle("acknowledge")}
            disabled={pending}
            className="min-h-[44px] w-full"
          >
            Acknowledge
          </Button>
          <p className="text-xs text-ink-tertiary">
            Keeps the claim as it is and marks it reviewed, so it drops out of the unread
            worklist.
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => handle("retire")}
            disabled={pending}
            className="min-h-[44px] w-full"
          >
            {active === "retire" ? "Confirm retire" : "Retire claim"}
          </Button>
          <p className="text-xs text-ink-tertiary">
            Withdraws the citation. The fact keeps its history and the archived snapshot,
            but nothing live supports it any more.
          </p>
          {active === "retire" ? (
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why is this claim being retired? (required)"
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
