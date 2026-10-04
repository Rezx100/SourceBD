"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/controls";
import { saveSearchError } from "@/lib/saved-search-errors";

// The sentences moved to `lib/saved-search-errors.ts` (B6b-2), where the v4 form reads them too.
export { saveSearchError };

export function SaveSearchForm({ search, defaultName, nextHref = "/app/searches" }: { search: string; defaultName: string; /** Where a successful save lands; the pane passes the search it sat beside. */ nextHref?: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName.slice(0, 120));
  const [error, setError] = useState<string | null>(null);
  // Only an error ABOUT the name marks the name field invalid (WCAG 3.3.1):
  // "limit reached" or "too long" cannot be fixed by editing the name.
  const [nameError, setNameError] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        setNameError(false);
        // Without the catch, a rejected fetch skipped setPending(false) and
        // left Save search disabled for good, announcing nothing.
        let res: Response;
        try {
          res = await fetch("/api/v1/saved-searches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, search }),
          });
        } catch {
          setPending(false);
          setError("Could not save this search — no connection. Try again.");
          return;
        }
        setPending(false);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          const refused = saveSearchError(res.status, body.error);
          setNameError(refused.onName);
          setError(refused.message);
          return;
        }
        router.push(nextHref, { scroll: false });
        router.refresh();
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink-strong">Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          aria-invalid={nameError || undefined}
          aria-describedby={nameError ? "save-search-error" : undefined}
          className="h-control rounded-sm border border-line-strong bg-surface px-3 text-ink-strong"
        />
      </label>
      {/* A failed save left this paragraph appearing with nothing announced:
          a screen-reader user was told nothing and walked away believing the
          search had saved. The live region is always in the DOM so the
          insertion is announced, and the field points at it. */}
      <p
        id="save-search-error"
        role="status"
        aria-live="polite"
        className={error ? "text-sm text-ink-strong" : "sr-only"}
      >
        {error ?? ""}
      </p>
      <Button type="submit" variant="primary" disabled={pending || !name.trim()}>
        Save search
      </Button>
    </form>
  );
}
