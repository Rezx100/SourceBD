"use client";

// The "Verify now" button of the activity record's health section (moderation plan 1e): re-checks every
// seal against the entries and the chain, and says what it found. The verdict is also kept by the
// database, so the page shows it on the next load.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/kit";

type Verdict = { ok: boolean | null; seals_checked?: number; first_broken_seal?: number | null; why?: string | null; unsealed_entries?: number };

export function LedgerVerifyButton() {
  const router = useRouter();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function verify() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/ledger/verify", { method: "POST" });
        const j = (await res.json().catch(() => null)) as (Verdict & { detail?: string; error?: string }) | null;
        if (!res.ok) {
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        setVerdict(j);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" onClick={verify} disabled={pending} loading={pending} loadingLabel="Checking every seal">
        Verify now
      </Button>
      {verdict ? (
        <p role="status" className={verdict.ok === false ? "text-sm font-medium text-danger" : "text-sm text-ink-2"}>
          {verdict.ok === true
            ? `Every one of ${verdict.seals_checked ?? 0} seals matches its entries and chains to the one before it. ${verdict.unsealed_entries ?? 0} entries wait for their hour.`
            : verdict.ok === false
              ? `The chain is broken at seal ${verdict.first_broken_seal ?? "?"}: ${verdict.why ?? "a seal no longer matches its entries"}.`
              : "No verdict."}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
