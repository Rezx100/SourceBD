"use client";

// Phase 7 P3 — In-app feedback slide-over (? hotkey).

import * as React from "react";
import { usePathname } from "next/navigation";
import { CaretLeft, ChatCircleDots, X } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COLLAPSED_STORAGE_KEY = "sourcebd-feedback-widget-collapsed";

export function FeedbackMount({ userId }: { userId: string | null }) {
  if (!userId) return null;
  return <FeedbackPanel />;
}

function FeedbackPanel() {
  const pathname = usePathname() ?? "/app";
  const hasBottomActionBar =
    pathname === "/app/rfqs/new" ||
    pathname === "/app/orders/new" ||
    pathname === "/app/match" ||
    pathname.startsWith("/supplier/rfqs") ||
    pathname.startsWith("/supplier/profile") ||
    pathname.startsWith("/supplier/claim") ||
    pathname.startsWith("/admin/suppliers");
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Minimised to a slim edge tab so the round FAB never sits on top of page
  // content on phones. Persisted so it stays out of the way across
  // navigations/reloads; a tap on the tab brings the full button back.
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1");
    } catch {
      // localStorage unavailable (privacy mode etc.) — default expanded.
    }
  }, []);

  function setCollapsedPersisted(value: boolean) {
    setCollapsed(value);
    try {
      window.localStorage.setItem(COLLAPSED_STORAGE_KEY, value ? "1" : "0");
    } catch {
      // Best-effort only.
    }
  }

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "?") return;
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      e.preventDefault();
      setCollapsedPersisted(false);
      setOpen((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      setError("Please enter at least 10 characters.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ page_path: pathname, message: message.trim() }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(j?.error ?? `Failed (${res.status})`);
      }
      setDone(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  const bottomOffsetClass = hasBottomActionBar
    ? "bottom-[calc(56px+env(safe-area-inset-bottom,0px)+84px+1rem)]"
    : "bottom-[calc(56px+env(safe-area-inset-bottom,0px)+1rem)]";

  return (
    <>
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsedPersisted(false)}
          aria-label="Show feedback button"
          title="Show feedback button"
          className={cn(
            "fixed right-0 z-40 flex h-10 w-6 items-center justify-center rounded-l-full border border-r-0 border-neutral-200 bg-white text-neutral-400 shadow-sm transition hover:text-brand-forest md:bottom-6",
            bottomOffsetClass,
          )}
        >
          <CaretLeft size={13} weight="bold" aria-hidden />
        </button>
      ) : (
        <span className={cn("fixed right-4 z-40 md:bottom-6", bottomOffsetClass)}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Send feedback"
            title="Send feedback (?)"
            className="flex size-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-brand-forest shadow-sm transition hover:bg-brand-forest-soft"
          >
            <ChatCircleDots size={22} weight="bold" aria-hidden />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsedPersisted(true);
            }}
            aria-label="Hide feedback button"
            title="Hide feedback button"
            className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm transition hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X size={11} weight="bold" aria-hidden />
          </button>
        </span>
      )}

      <div
        className={cn(
          "fixed inset-0 z-50 transition",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/20 transition-opacity",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Send feedback"
          className={cn(
            "absolute right-0 top-0 flex h-dvh w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl transition-transform duration-200",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 safe-pt">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-primary">
                Send feedback
              </h2>
              <p className="text-[13px] text-ink-tertiary">
                Press <kbd className="rounded border border-neutral-200 px-1">?</kbd> to toggle
              </p>
            </div>
            <button
              type="button"
              aria-label="Close feedback"
              onClick={() => setOpen(false)}
              className="flex size-9 items-center justify-center rounded-md text-ink-secondary hover:bg-neutral-100"
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          <form onSubmit={submit} className="flex flex-1 flex-col gap-4 p-5">
            <p className="text-[14px] text-ink-secondary">
              Page: <span className="font-mono text-ink-primary">{pathname}</span>
            </p>
            {done ? (
              <p className="rounded-lg border border-sem-green/30 bg-sem-green-soft px-3 py-2 text-sm text-sem-green">
                Thank you — your note is in the admin queue.
              </p>
            ) : null}
            <label className="flex flex-1 flex-col gap-2 text-sm text-ink-secondary">
              What should we improve?
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                maxLength={4000}
                className="min-h-[160px] w-full flex-1 resize-y rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-ink-primary outline-none focus:border-brand-forest/40"
                placeholder="Describe the issue, missing data, or workflow friction…"
              />
            </label>
            {error ? <p className="text-sm text-sem-red">{error}</p> : null}
            <Button type="submit" variant="primary" disabled={pending} className="min-h-[44px]">
              {pending ? "Sending…" : "Submit feedback"}
            </Button>
          </form>
        </aside>
      </div>
    </>
  );
}
