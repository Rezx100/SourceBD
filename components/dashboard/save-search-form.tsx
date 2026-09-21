"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/dashboard/controls";

export function SaveSearchForm({ search, defaultName }: { search: string; defaultName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName.slice(0, 120));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex max-w-lg flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
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
        if (res.status === 401) {
          setError("Sign in to save a search.");
          return;
        }
        if (!res.ok) {
          setError("Could not save this search.");
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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "save-search-error" : undefined}
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
