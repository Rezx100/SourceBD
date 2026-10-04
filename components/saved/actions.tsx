"use client";

// Removing from Saved (B6b, Paper `10 · States · Saved removed, with undo (SV-03)`). A removal
// is not asked about: it is done, and a toast says so with Undo. Same transport as the Save
// button: `DELETE /api/v1/saved?supplier_id=` for each one, `POST /api/v1/saved` to put them back.
// A failure is said where the buyer is, never as a toast: an error does not toast.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Toast } from "@/components/kit";
import { toastActionClass } from "@/components/kit/classes";
import { removedWords } from "./words";

export type Removable = { id: string; name: string };

type Ctx = {
  remove: (items: readonly Removable[]) => Promise<boolean>;
  busy: boolean;
  /** The last removal that failed, in words; cleared by the next try. */
  error: string | null;
};

const RemoveContext = createContext<Ctx | null>(null);

export function useRemove(): Ctx {
  return useContext(RemoveContext) ?? { remove: async () => false, busy: false, error: null };
}

const TOAST_MS = 8000;

export function RemoveProvider({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ words: string; ids: string[] } | null>(null);
  const working = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const remove = useCallback(
    async (items: readonly Removable[]) => {
      if (working.current || items.length === 0) return false;
      working.current = true;
      setBusy(true);
      setError(null);
      const results = await Promise.all(
        items.map(async (i) => {
          try {
            const res = await fetch(`/api/v1/saved?supplier_id=${encodeURIComponent(i.id)}`, { method: "DELETE" });
            return res.ok;
          } catch {
            return false;
          }
        }),
      );
      working.current = false;
      setBusy(false);
      const gone = items.filter((_, n) => results[n]);
      const failed = items.length - gone.length;
      if (failed > 0) setError(failed === items.length ? "Could not remove them. Nothing was changed. Try again." : `Could not remove ${failed} of ${items.length}. The others were removed.`);
      if (gone.length > 0) {
        setToast({ words: removedWords(gone.map((g) => g.name)), ids: gone.map((g) => g.id) });
        router.refresh();
      }
      return failed === 0;
    },
    [router],
  );

  const undo = async () => {
    if (!toast || working.current) return;
    working.current = true;
    setBusy(true);
    let ok = false;
    try {
      const res = await fetch("/api/v1/saved", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ supplier_ids: toast.ids }) });
      ok = res.ok;
    } catch {
      ok = false;
    }
    working.current = false;
    setBusy(false);
    if (ok) {
      setToast(null);
      router.refresh();
    } else {
      setToast(null);
      setError("Could not put them back. Save them again from search or their record.");
    }
  };

  const value = useMemo(() => ({ remove, busy, error }), [remove, busy, error]);
  return (
    <RemoveContext.Provider value={value}>
      {children}
      {/* A removal is heard as well as seen. */}
      <p role="status" aria-live="polite" className="sr-only">
        {toast?.words ?? ""}
      </p>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-24">
          <Toast
            action={
              <button type="button" onClick={undo} className={toastActionClass}>
                Undo
              </button>
            }
            className="pointer-events-auto"
          >
            {toast.words}
          </Toast>
        </div>
      ) : null}
    </RemoveContext.Provider>
  );
}
