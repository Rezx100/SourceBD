"use client";

// Admin "trigger SBI recalc" island (Spec A2). POSTs to
// /api/v1/admin/suppliers/<id>/rescore which enqueues a row in
// public.score_recalc_jobs via SECURITY DEFINER RPC.

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

export function AdminSupplierRescoreButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function enqueue() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/suppliers/${id}/rescore`, {
          method: "POST",
        });
        const j = (await res.json().catch(() => null)) as
          | { job_id?: string; status?: string; detail?: string; error?: string }
          | null;
        if (!res.ok || !j?.job_id) {
          setError(j?.detail ?? j?.error ?? `Failed (${res.status})`);
          return;
        }
        setJobId(j.job_id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="primary" size="sm" onClick={enqueue} disabled={pending}>
        {pending ? "Enqueuing…" : "Queue SBI rescore"}
      </Button>
      {jobId ? (
        <p className="font-mono text-[11px] text-sem-green">
          queued · {jobId.slice(0, 8)}
        </p>
      ) : null}
      {error ? <p className="text-[11px] text-sem-red">{error}</p> : null}
    </div>
  );
}
