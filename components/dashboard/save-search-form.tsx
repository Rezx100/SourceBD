"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/controls";

/** What the form says for a refused save, and whether it is the NAME's fault
 * (only then is the name field marked invalid — WCAG 3.3.1). */
export function saveSearchError(status: number, error: string | undefined): { message: string; onName: boolean } {
  if (status === 401) return { message: "Sign in to save a search.", onName: false };
  if (status === 409) return { message: "You have reached the limit of 200 saved searches. Delete one to save this.", onName: false };
  if (status === 400 && error === "invalid name") return { message: "Give the search a name of 120 characters or fewer.", onName: true };
  if (status === 400 && error === "search too long to save") {
    return { message: "This search is too long to save. Remove some filters or shorten the words.", onName: false };
  }
  return { message: "Could not save this search.", onName: false };
}

export function SaveSearchForm({ search, defaultName }: { search: string; defaultName: string }) {
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
        router.push("/app/searches");
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
