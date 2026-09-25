"use client";

// The record bar's "more" menu (REZ-C §3.3: "more (Report a problem → existing
// feedback endpoint)"). It posts to `POST /api/v1/feedback` — the Phase 7
// endpoint the admin queue at /admin/feedback reads — with the record's URL as
// the page, so the report arrives already naming the company.
//
// A native <details>: it opens and closes without script, needs no focus trap
// and cannot outlive the sheet it sits in.

import { useState, type FormEvent } from "react";
import { Button } from "./controls";
import { Icon } from "./icons";

export const FEEDBACK_ENDPOINT = "/api/v1/feedback";

/** The body `app/api/v1/feedback/route.ts` validates: the page (≤ 500 chars) and the note. */
export function feedbackBody(page: string, message: string): { page_path: string; message: string } {
  return { page_path: page.slice(0, 500), message: message.trim() };
}

export function ReportProblem() {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    // The endpoint refuses fewer than 10 characters; say so here, not as a 400.
    if (message.trim().length < 10) {
      setError("Please write at least 10 characters.");
      return;
    }
    setState("sending");
    setError(null);
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(feedbackBody(`${window.location.pathname}${window.location.search}`, message)),
      });
      if (res.status === 401) {
        // Trying again cannot help an expired session; say what will.
        setState("failed");
        setError("Your session has ended. Sign in again to send the report.");
        return;
      }
      if (!res.ok) throw new Error(`status ${res.status}`);
      setState("sent");
      setMessage("");
    } catch {
      setState("failed");
      setError("Could not send the report. Please try again.");
    }
  }

  return (
    <details
      className="relative"
      data-report-problem="true"
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !e.currentTarget.open) return;
        // Escape closes the menu, not the sheet around it.
        e.stopPropagation();
        e.currentTarget.open = false;
        e.currentTarget.querySelector("summary")?.focus();
      }}
    >
      <summary
        aria-label="More"
        className="flex h-control w-control cursor-pointer list-none items-center justify-center rounded-sm text-ink-muted hover:bg-surface-sunken [&::-webkit-details-marker]:hidden"
      >
        <Icon name="dots" />
      </summary>
      <form
        onSubmit={submit}
        className="absolute right-0 top-full z-10 mt-1 flex w-72 flex-col gap-2 rounded-md border border-line bg-surface p-3 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-ink-strong">
          Report a problem
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              // A new report is not the one just thanked for.
              if (state === "sent") setState("idle");
            }}
            rows={4}
            maxLength={4000}
            className="rounded-sm border border-line bg-surface p-2 text-sm font-normal text-ink"
            placeholder="What is wrong or missing on this record?"
          />
        </label>
        <span role="status" aria-live="polite" className="text-xs text-ink-subtle">
          {state === "sent" ? "Thank you — the report is with our team." : (error ?? "")}
        </span>
        <Button type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send report"}
        </Button>
      </form>
    </details>
  );
}
