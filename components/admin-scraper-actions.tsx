"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { formatInterval } from "@/lib/admin/etl-scrapers";

const TIMER_OPTIONS = [
  { label: "Timer off", value: 0 },
  { label: "Every hour", value: 60 },
  { label: "Daily", value: 1440 },
  { label: "Weekly", value: 10080 },
  { label: "Monthly", value: 43200 },
] as const;

export function AdminScraperActions({
  scraperCode,
  suggestedIntervalMinutes,
  enabled,
  intervalMinutes,
}: {
  scraperCode: string;
  suggestedIntervalMinutes: number;
  enabled: boolean;
  intervalMinutes: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<"run" | "schedule" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const initialInterval = enabled ? intervalMinutes ?? suggestedIntervalMinutes : 0;
  const [selectedInterval, setSelectedInterval] = useState(String(initialInterval));

  function runNow() {
    setActive("run");
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/etl/enqueue", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scraper_code: scraperCode,
            priority: 100,
            metadata: { source: "admin_button" },
          }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          setError(payload?.detail ?? payload?.error ?? `Failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function saveTimer() {
    const interval = Number(selectedInterval);
    setActive("schedule");
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/v1/admin/etl/schedule", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            scraper_code: scraperCode,
            enabled: interval > 0,
            interval_minutes: interval > 0 ? interval : suggestedIntervalMinutes,
          }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          setError(payload?.detail ?? payload?.error ?? `Failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const busy = pending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          disabled={busy}
          onClick={runNow}
          className="min-h-[40px]"
        >
          {busy && active === "run" ? "Queueing..." : "Run now"}
        </Button>
        <div className="flex min-h-[40px] overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <select
            value={selectedInterval}
            disabled={busy}
            onChange={(event) => setSelectedInterval(event.target.value)}
            className="min-h-[40px] bg-white px-3 text-sm text-ink-secondary outline-none"
            aria-label={`Timer for ${scraperCode}`}
          >
            {TIMER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {!TIMER_OPTIONS.some((option) => option.value === suggestedIntervalMinutes) ? (
              <option value={suggestedIntervalMinutes}>
                Suggested ({formatInterval(suggestedIntervalMinutes)})
              </option>
            ) : null}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={saveTimer}
            className="border-l border-neutral-200 px-3 text-sm font-semibold text-brand-forest transition hover:bg-brand-forest-tint disabled:opacity-60"
          >
            {busy && active === "schedule" ? "Saving..." : "Save timer"}
          </button>
        </div>
      </div>
      {error ? <p className="text-xs text-sem-red">{error}</p> : null}
    </div>
  );
}

export function AdminScraperJobAction({
  jobId,
  action,
}: {
  jobId: string;
  action: "cancel" | "retry";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/etl/jobs/${jobId}/decision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as
            | { detail?: string; error?: string }
            | null;
          setError(payload?.detail ?? payload?.error ?? `Failed (${res.status})`);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="rounded-pill border border-neutral-200 px-3 py-1.5 text-xs font-semibold capitalize text-ink-secondary transition hover:border-brand-forest/30 hover:bg-brand-forest-tint hover:text-brand-forest disabled:opacity-60"
      >
        {pending ? "Saving..." : action}
      </button>
      {error ? <span className="text-xs text-sem-red">{error}</span> : null}
    </span>
  );
}
