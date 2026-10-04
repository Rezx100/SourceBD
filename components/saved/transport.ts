// Removing from Saved and putting back, out of React so a test can run them (the pattern of
// `runBulkSave` in lib/dashboard/selection.ts: the caller injects `fetch`). Removal is one
// `DELETE /api/v1/saved?supplier_id=` per supplier, the route's own shape; Undo is the bar's own bulk
// save, so a 429 or a supplier no longer listed is explained in the same words the search's Save uses.

import { runBulkSave } from "@/lib/dashboard/selection";

export type Removable = { id: string; name: string };

type Res = { ok: boolean; status: number; json(): Promise<unknown> };
export type Fetch = (url: string, init?: { method: string; headers?: Record<string, string>; body?: string }) => Promise<Res>;

/** What a removal that did not fully work says, in words; null when everything was removed. */
export function removeMessage(failed: number, total: number): string | null {
  if (failed <= 0) return null;
  return failed === total ? "Could not remove them. Nothing was changed. Try again." : `Could not remove ${failed} of ${total}. The others were removed.`;
}

/** Remove each supplier; resolves to the ones that went, how many did not, and the sentence for the ones that did not. */
export async function runRemove(items: readonly Removable[], deps: { fetch: Fetch }): Promise<{ gone: Removable[]; failed: number; message: string | null }> {
  const results = await Promise.all(
    items.map(async (i) => {
      try {
        return (await deps.fetch(`/api/v1/saved?supplier_id=${encodeURIComponent(i.id)}`, { method: "DELETE" })).ok;
      } catch {
        return false;
      }
    }),
  );
  const gone = items.filter((_, n) => results[n]);
  const failed = items.length - gone.length;
  return { gone, failed, message: removeMessage(failed, items.length) };
}

/** Put them back. `message` says why it did not work, in the words the search's bulk Save uses; null on success. */
export async function runUndo(ids: readonly string[], deps: { fetch: Fetch }): Promise<{ ok: boolean; message: string | null }> {
  let saved = false;
  const said = await runBulkSave(ids, {
    fetch: (url, init) => deps.fetch(url, init),
    onSaved: () => {
      saved = true;
    },
  });
  return { ok: saved, message: saved ? null : said };
}
