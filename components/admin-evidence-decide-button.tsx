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

import { Button, Dialog, Input } from "@/components/kit";

type Action = "recheck" | "acknowledge" | "retire";

const NEEDS_NOTE: Action = "retire";

const BLOCK = "flex flex-col gap-2 rounded-md border border-line bg-subtle p-3";
const HELP = "text-sm text-ink-2";

export function AdminEvidenceDecideButton({
  claimId,
  label,
  onResolved,
}: {
  claimId: string;
  label?: string;
  /** Called immediately after a successful action so the parent can
   *  optimistically remove the row without waiting for router.refresh(). */
  onResolved?: (claimId: string) => void;
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
        // Notify parent first so optimistic removal fires before the refresh.
        onResolved?.(claimId);
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
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
      kind="form"
      title={label ?? "Resolve citation"}
      trigger={<Button kind="secondary">Resolve</Button>}
    >
      {/* Re-check */}
      <div className={BLOCK}>
        <Button kind="primary" full onClick={() => handle("recheck")} disabled={pending}>
          Re-check now
        </Button>
        <p className={HELP}>
          Puts this page at the front of the verifier&apos;s queue. Use this first — a timeout or a block at check time says nothing about whether
          the fact is still published.
        </p>
      </div>

      {/* Acknowledge */}
      <div className={BLOCK}>
        <Button kind="secondary" full onClick={() => handle("acknowledge")} disabled={pending}>
          Acknowledge
        </Button>
        <p className={HELP}>Keeps the claim as it is and marks it reviewed, so it drops out of the unread worklist.</p>
      </div>

      {/* Retire */}
      <div className={BLOCK}>
        {active === "retire" ? (
          <>
            <Input
              type="text"
              aria-label="Why is this claim being retired?"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why is this claim being retired? (required)"
              maxLength={2000}
              autoFocus
            />
            <Button kind="danger" full onClick={() => handle("retire")} disabled={pending}>
              Confirm retire
            </Button>
          </>
        ) : (
          <Button kind="danger" full onClick={() => handle("retire")} disabled={pending}>
            Retire claim
          </Button>
        )}
        <p className={HELP}>Withdraws the citation. The fact keeps its history and the archived snapshot, but nothing live supports it any more.</p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-tint px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
