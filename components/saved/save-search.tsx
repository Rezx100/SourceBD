"use client";

// Save this search (Paper `10 · Save this search popover on results`, `11 · Save this search sheet on
// results`): a name, the filters in words with how many suppliers match today, Cancel and Save
// search. A 400 popover under the toolbar on a desktop (no scrim, nothing inert: the results stay
// live), a bottom sheet on a phone. It is in the address (`?save=1`), so the empty state's link and
// the toolbar's button open it the same way, and Close, Cancel and Escape go back to the search.
// "Tell me about new matches" (0113's `alert_weekly`, sent by the Monday job) is drawn only when the
// database has the switch (`alerts`), off until chosen. The search keeps its filters and sort, not its page.

import { X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, Field, IconButton, Input, Sheet, Switch } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import { saveSearchError } from "@/lib/saved-search-errors";
import { cn } from "@/lib/utils";

const ALERT_HINT = "One email on Monday, only when something new matches";

/** "knit · hiding sanctioned suppliers · 4,645 suppliers today": the filters, then what they find. */
export function saveSummary(filters: string, count: number | null): string {
  if (count === null) return filters;
  return `${filters} · ${new Intl.NumberFormat("en-GB").format(count)} ${count === 1 ? "supplier" : "suppliers"} today`;
}

export function SaveSearchForm({
  search,
  defaultName,
  nextHref,
  cancelHref,
  touch: touchProp = false,
  autoFocus = false,
  inset = false,
  alerts = false,
  between,
}: {
  /** Drawn between the name and the switch: the phone sheet's "What it looks for". */
  between?: ReactNode;
  /** The serialized search: filters and sort, not the page. */
  search: string;
  defaultName: string;
  /** Where a saved search lands: the search it sat beside, with the "Search saved" note. */
  nextHref: string;
  cancelHref: string;
  /** 48-tall field and a full-width button (a phone); "auto" follows the width (the page, which is both). */
  touch?: boolean | "auto";
  autoFocus?: boolean;
  /** Inside a padded box (the popover): the footer's rule runs the box's full width. */
  inset?: boolean;
  /** The database has the switch (0113, `alertsAvailable`): draw "Tell me about new matches". Off by default, so it is never offered unread. */
  alerts?: boolean;
}) {
  const router = useRouter();
  const phone = useIsPhone();
  const touch = touchProp === "auto" ? phone : touchProp;
  const [name, setName] = useState(defaultName.slice(0, 120));
  const [alert, setAlert] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only an error ABOUT the name marks the field invalid: "limit reached" or "too long" cannot be
  // fixed by editing the name.
  const [nameError, setNameError] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !name.trim()) return;
    setPending(true);
    setError(null);
    setNameError(false);
    let res: Response;
    try {
      res = await fetch("/api/v1/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, search, ...(alerts && alert ? { alert_weekly: true } : {}) }) });
    } catch {
      // A rejected fetch must not leave the button busy for good.
      setPending(false);
      setError("Could not save this search. There is no connection. Try again.");
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
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Name" help={between ? "Filled in from your filters. Only you see it." : undefined} error={nameError ? error : undefined}>
        {(a) => <Input {...a} name="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required autoFocus={autoFocus} size={touch ? "touch" : "md"} />}
      </Field>
      {between}
      {alerts ? (
        <div className="flex flex-col gap-1">
          <Switch size={touch ? "touch" : "md"} checked={alert} onChange={(e) => setAlert(e.currentTarget.checked)} hint={ALERT_HINT}>
            Tell me about new matches
          </Switch>
          {touch ? null : <p className="pl-10 text-sm text-ink-3">{ALERT_HINT}</p>}
        </div>
      ) : null}
      {/* The live region is always in the page, so a refusal that is not about the name is announced. */}
      {/* A name error is drawn by the field; the same words are spoken here, so every refusal is heard. */}
      <p role="status" aria-live="polite" className={cn(!nameError && error ? "text-sm text-danger" : "sr-only")}>
        {error ?? ""}
      </p>
      <div className={cn("flex gap-2", touch ? "flex-col pb-[max(1rem,env(safe-area-inset-bottom))]" : cn("justify-end", inset && "-mx-4 border-t border-line px-4 py-3"))}>
        {touch ? null : (
          <Button kind="quiet" onClick={() => router.push(cancelHref, { scroll: false })}>
            Cancel
          </Button>
        )}
        <Button type="submit" kind="primary" size={touch ? "touch" : "md"} full={touch} loading={pending} loadingLabel="Saving" disabled={!name.trim()}>
          Save search
        </Button>
      </div>
    </form>
  );
}

/** The popover or the sheet, open: the summary line over the form. */
export function SaveSearchPanel({
  search,
  defaultName,
  summary,
  closeHref,
  nextHref,
  alerts = false,
  count = null,
  filters = [],
}: {
  search: string;
  defaultName: string;
  /** `saveSummary(...)`: the filters and the live count. */
  summary: string;
  closeHref: string;
  nextHref: string;
  /** See `SaveSearchForm`. */
  alerts?: boolean;
  /** How many suppliers the search finds today, for the phone sheet's line under its title; null when unread. */
  count?: number | null;
  /** The search's filters as the results bar names them, for the phone sheet's "What it looks for". */
  filters?: readonly string[];
}) {
  const phone = useIsPhone();
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });
  if (phone) {
    // Paper page 36 `save-search`: the count under the title, the name, what it looks for, the weekly switch.
    const looksFor = (
      <div className="flex flex-col gap-3 border-y border-line py-5">
        <div className="flex flex-col gap-0.5">
          <p className="text-md/[22px] font-medium text-ink">What it looks for</p>
          <p className="text-sm text-ink-3">{filters.length === 0 ? "Every published supplier" : `${filters.length} ${filters.length === 1 ? "filter" : "filters"}, from the search you just ran`}</p>
        </div>
        {filters.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {filters.map((f) => (
              <li key={f} className="flex h-9 items-center rounded-full border border-line px-3.5 text-base font-medium text-ink">
                {f}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
    return (
      <Sheet open onOpenChange={(next) => (next ? null : close())} title="Save this search" flush>
        <div className="flex min-h-0 flex-col overflow-y-auto">
          {count === null ? null : (
            <p className="border-b border-line px-5 pb-3.5 text-sm text-ink-3">
              {new Intl.NumberFormat("en-GB").format(count)} {count === 1 ? "supplier matches" : "suppliers match"} it today
            </p>
          )}
          <div className="px-5 pt-5">
            <SaveSearchForm search={search} defaultName={defaultName} nextHref={nextHref} cancelHref={closeHref} touch alerts={alerts} between={looksFor} />
          </div>
        </div>
      </Sheet>
    );
  }
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape" && !e.defaultPrevented) close();
  };
  return (
    <section
      role="dialog"
      aria-label="Save this search"
      aria-modal="false"
      onKeyDown={onKeyDown}
      className="absolute right-6 top-full z-overlay mt-1 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border border-line bg-surface shadow-dialog max-md:hidden"
    >
      <div className="flex items-center justify-between pb-2 pl-4 pr-2 pt-3">
        <h2 className="text-md font-semibold text-ink">Save this search</h2>
        <IconButton icon={X} label="Close" kind="quiet" onClick={close} />
      </div>
      <p className="px-4 pb-4 text-sm text-ink-2 [overflow-wrap:anywhere]">{summary}</p>
      <div className="px-4">
        <SaveSearchForm search={search} defaultName={defaultName} nextHref={nextHref} cancelHref={closeHref} autoFocus inset alerts={alerts} />
      </div>
    </section>
  );
}
