"use client";

// The two controls on the Saved pages that need script: the Saved list's sort,
// which applies the moment it changes, and a saved search's Delete with its
// inline confirm. Everything else on those pages renders on the server.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Form from "next/form";
import { useContext, useId, useState } from "react";
import { Button } from "./controls";
import { SelectInput } from "./fields";

/**
 * The sort: a GET form on `/app/saved`, submitted as soon as the choice
 * changes (`next/form`, so it is a client navigation). Without script the
 * visually hidden Apply submits it; it shows itself when a keyboard reaches it.
 */
export function SavedSort({
  sort,
  options,
}: {
  sort: string;
  options: readonly { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <Form action="/app/saved" scroll={false} className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink-muted">
        Sort
      </label>
      <SelectInput id={id} name="sort" defaultValue={sort} className="w-auto" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </SelectInput>
      <Button type="submit" size="sm" className="sr-only focus:not-sr-only">
        Apply
      </Button>
    </Form>
  );
}

/**
 * Delete a saved search: the row's Delete asks once, inline ("Delete this
 * search?" · Delete · Cancel), then calls `DELETE /api/v1/saved-searches?id=`,
 * which checks the caller owns the row. The list refreshes on success; a
 * failure says so beside the row and deletes nothing.
 */
export function DeleteSavedSearch({ id, name }: { id: string; name: string }) {
  // Not `useRouter()`, which throws outside a mounted app router (the render tests draw this with none).
  const router = useContext(AppRouterContext);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Focus follows the control it replaced: into Cancel when asking, back to Delete after Cancel.
  const [returned, setReturned] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Delete ${name}`}
        autoFocus={returned}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Delete
      </Button>
    );
  }

  return (
    <span role="group" aria-label={`Delete ${name}?`} className="inline-flex flex-wrap items-center justify-end gap-1.5">
      <span className="text-xs text-ink-muted">Delete this search?</span>
      <Button
        variant="danger"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch(`/api/v1/saved-searches?id=${encodeURIComponent(id)}`, { method: "DELETE" });
            if (!res.ok) {
              setError("Could not delete it. Nothing was removed; try again.");
              return;
            }
            router?.refresh();
          } catch {
            setError("Could not reach SourceBD. Nothing was removed; try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Delete
      </Button>
      <Button
        variant="ghost"
        size="sm"
        autoFocus
        disabled={busy}
        onClick={() => {
          setConfirming(false);
          setReturned(true);
        }}
      >
        Cancel
      </Button>
      {error ? (
        <span role="alert" className="basis-full text-right text-xs text-danger-ink">
          {error}
        </span>
      ) : null}
    </span>
  );
}
