"use client";

// "Save your last search?" (gap row 14, migration 0113): the search the buyer ran most recently, in
// the last 7 days, that no saved search holds yet, offered at the top of Saved searches. Saving it is
// one click under the name its filters give it; the page then refreshes and the card is gone because
// a saved search now holds it. `RecordLastSearch` is the other half: the results page tells the
// server which search was just run.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/kit";
import { saveSearchError } from "@/lib/saved-search-errors";
import type { LastSearchCard } from "./words";

/** Keeps the search that was run, once for each distinct search in this tab. Nothing is drawn. */
export function RecordLastSearch({ search }: { search: string }) {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("sourcebd.last-search") === search) return;
    } catch {
      // No storage: the search is kept again, which is harmless.
    }
    void fetch("/api/v1/saved-searches/last", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ search }), keepalive: true })
      .then((res) => {
        if (!res.ok) return;
        try {
          window.sessionStorage.setItem("sourcebd.last-search", search);
        } catch {
          // Nothing to remember it in.
        }
      })
      .catch(() => {});
  }, [search]);
  return null;
}

export function LastSearchCardView({ card }: { card: LastSearchCard }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: card.name, search: card.search }) });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(saveSearchError(res.status, body.error).message);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not save this search. There is no connection. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Save your last search?" className="mx-6 mt-4 flex items-center gap-4 rounded-lg border border-line bg-brand-wash p-4 max-md:mx-4 max-md:flex-col max-md:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="text-md font-semibold text-ink">Save your last search?</h2>
        <p className="text-sm text-ink-2 [overflow-wrap:anywhere]">{card.filters}</p>
        <p className="text-xs text-ink-3">You ran it {card.when}. Only you see your saved searches.</p>
        <p role="status" aria-live="polite" className={error ? "pt-1 text-sm text-danger" : "sr-only"}>
          {error ?? ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 max-md:flex-col max-md:items-stretch">
        <ButtonLink href={card.runHref} prefetch={false} size="md" className="max-md:h-input-touch">
          Run search
        </ButtonLink>
        <Button kind="primary" loading={pending} loadingLabel="Saving" onClick={() => void save()} className="max-md:h-input-touch">
          Save search
        </Button>
      </div>
    </section>
  );
}
