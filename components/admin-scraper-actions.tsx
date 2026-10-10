"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { adminFieldClass } from "@/components/admin/data-ui";
import { Button } from "@/components/kit";
import { formatInterval } from "@/lib/admin/etl-scrapers";
import { cn } from "@/lib/utils";

const TIMER_OPTIONS = [
  { label: "Timer off", value: 0 },
  { label: "Every hour", value: 60 },
  { label: "Daily", value: 1440 },
  { label: "Weekly", value: 10080 },
  { label: "Monthly", value: 43200 },
] as const;

/** POST a JSON body; the error words on failure, null on success (then the page refreshes). */
function usePost() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function post(url: string, body: unknown) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
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
  return { pending, error, post };
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p role="alert" className="text-sm text-danger">{error}</p> : null;
}

/** Queue one run of a source now (the worker picks it up within about a minute). */
export function RunNowButton({ scraperCode, kind = "primary" }: { scraperCode: string; kind?: "primary" | "secondary" }) {
  const { pending, error, post } = usePost();
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        kind={kind}
        disabled={pending}
        aria-label={`Run now: ${scraperCode}`}
        onClick={() =>
          post("/api/v1/admin/etl/enqueue", {
            scraper_code: scraperCode,
            priority: 100,
            metadata: { source: "admin_button" },
          })
        }
      >
        {pending ? "Queueing..." : "Run now"}
      </Button>
      <ErrorLine error={error} />
    </span>
  );
}

/**
 * Let a paused read finish, or mark what a list dropped as no longer listed. Two presses:
 * the first says what will happen, the second queues the run that carries the release
 * (etl/jobs/scraper_queue.py honours it only from an admin).
 */
export function ReleaseButton({ scraperCode, what }: { scraperCode: string; what: "changes" | "delistings" }) {
  const { pending, error, post } = usePost();
  const [sure, setSure] = useState(false);
  const label = what === "changes" ? "Let the rest through" : "Mark no longer listed";
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-2">
        {sure && !pending ? (
          <Button kind="secondary" onClick={() => setSure(false)}>
            Not yet
          </Button>
        ) : null}
        <Button
          kind={sure ? "primary" : "secondary"}
          disabled={pending}
          onClick={() => {
            if (!sure) return setSure(true);
            post("/api/v1/admin/etl/enqueue", {
              scraper_code: scraperCode,
              priority: 10,
              metadata: what === "changes"
                ? { source: "admin_release", accept_changes: true }
                : { source: "admin_release", accept_delistings: true },
            });
          }}
        >
          {pending ? "Starting..." : sure ? `Yes, ${label.toLowerCase()}` : label}
        </Button>
      </span>
      {sure && !pending && !error ? (
        <p className="text-sm text-ink-3">
          {what === "changes" ? "It reads the source again and updates the live site." : "They show as no longer listed on the live site."}
        </p>
      ) : null}
      <ErrorLine error={error} />
    </span>
  );
}

/**
 * The timer: off or an interval. Nothing is saved until Save is pressed, so a slip on
 * the select never switches a production schedule; Save shows only once it would change something.
 */
export function TimerControl({
  scraperCode,
  suggestedIntervalMinutes,
  enabled,
  intervalMinutes,
  alwaysShowSave = false,
}: {
  scraperCode: string;
  suggestedIntervalMinutes: number;
  enabled: boolean;
  intervalMinutes: number | null;
  alwaysShowSave?: boolean;
}) {
  const { pending, error, post } = usePost();
  const initial = String(enabled ? intervalMinutes ?? suggestedIntervalMinutes : 0);
  const [selected, setSelected] = useState(initial);
  const options: { label: string; value: number }[] = [...TIMER_OPTIONS];
  for (const extra of [suggestedIntervalMinutes, enabled ? intervalMinutes : null]) {
    if (extra && !options.some((o) => o.value === extra)) {
      options.push({ label: extra === suggestedIntervalMinutes ? `Suggested (${formatInterval(extra)})` : formatInterval(extra), value: extra });
    }
  }

  function save() {
    const interval = Number(selected);
    post("/api/v1/admin/etl/schedule", {
      scraper_code: scraperCode,
      enabled: interval > 0,
      interval_minutes: interval > 0 ? interval : suggestedIntervalMinutes,
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-2">
        <select
          value={selected}
          disabled={pending}
          onChange={(event) => setSelected(event.target.value)}
          className={cn(adminFieldClass, "w-auto")}
          aria-label={`Timer for ${scraperCode}`}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {alwaysShowSave || selected !== initial ? (
          <Button kind="secondary" disabled={pending} onClick={save}>
            {pending ? "Saving..." : "Save timer"}
          </Button>
        ) : null}
      </span>
      <ErrorLine error={error} />
    </span>
  );
}

export function AdminScraperActions(props: {
  scraperCode: string;
  suggestedIntervalMinutes: number;
  enabled: boolean;
  intervalMinutes: number | null;
}) {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <RunNowButton scraperCode={props.scraperCode} />
      <TimerControl {...props} alwaysShowSave />
    </div>
  );
}

export function AdminScraperJobAction({
  jobId,
  action,
  label,
}: {
  jobId: string;
  action: "cancel" | "retry";
  label?: string;
}) {
  const { pending, error, post } = usePost();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        kind="secondary"
        disabled={pending}
        onClick={() => post(`/api/v1/admin/etl/jobs/${jobId}/decision`, { action })}
        className={label ? undefined : "capitalize"}
      >
        {pending ? "Saving..." : (label ?? action)}
      </Button>
      {error ? <span role="alert" className="text-sm text-danger">{error}</span> : null}
    </span>
  );
}
