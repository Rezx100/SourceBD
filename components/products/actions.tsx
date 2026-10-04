"use client";

// Archive, restore and delete on the Products list (Paper `10 · Products` row menu). Archive and
// Restore are done and then said, with Undo: they can be undone, so they are not asked about.
// Delete cannot be undone, so it asks once (a dialog; a sheet on a phone). A failure is said
// beside the list, never as a toast: an error does not toast.

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, Dialog, Sheet, Toast } from "@/components/kit";
import { toastActionClass } from "@/components/kit/classes";
import { useIsPhone } from "@/components/kit/use-phone";
import { runDelete, runSetStatus } from "./transport";
import { DELETE_BODY, RESTORED_STATUS, deleteTitle, statusChangeWords, type ProductRow, type ProductStatus } from "./words";

type Target = Pick<ProductRow, "id" | "name" | "status">;

type Ctx = {
  /** Archive an active or draft product; Restore an archived one. */
  toggleArchive: (p: Target) => Promise<void>;
  /** Open the delete question for this product. */
  askDelete: (p: Target) => void;
  busy: boolean;
  error: string | null;
};

const ProductActions = createContext<Ctx | null>(null);

export function useProductActions(): Ctx {
  return useContext(ProductActions) ?? { toggleArchive: async () => {}, askDelete: () => {}, busy: false, error: null };
}

const TOAST_MS = 8000;

export function ProductActionsProvider({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const phone = useIsPhone();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ words: string; id: string; back: ProductStatus } | null>(null);
  const [asking, setAsking] = useState<Target | null>(null);
  const working = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const change = useCallback(
    async (id: string, to: ProductStatus): Promise<{ ok: boolean }> => {
      if (working.current) return { ok: false };
      working.current = true;
      setBusy(true);
      setError(null);
      const r = await runSetStatus(id, to, { fetch: (url, init) => fetch(url, init) });
      working.current = false;
      setBusy(false);
      if (!r.ok) {
        setError(r.message);
        return { ok: false };
      }
      router.refresh();
      return { ok: true };
    },
    [router],
  );

  const toggleArchive = useCallback(
    async (p: Target) => {
      const to: ProductStatus = p.status === "archived" ? RESTORED_STATUS : "archived";
      const done = await change(p.id, to);
      if (done.ok) setToast({ words: statusChangeWords(p.name, to), id: p.id, back: p.status });
    },
    [change],
  );

  const undo = async () => {
    if (!toast) return;
    const { id, back } = toast;
    setToast(null);
    await change(id, back);
  };

  const confirmDelete = async () => {
    if (!asking || working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    const r = await runDelete(asking.id, { fetch: (url, init) => fetch(url, init) });
    working.current = false;
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setAsking(null);
    router.refresh();
  };

  const value = useMemo(() => ({ toggleArchive, askDelete: (p: Target) => setAsking(p), busy, error }), [toggleArchive, busy, error]);
  const title = asking ? deleteTitle(asking.name) : "";
  const body = (
    <>
      <p>{DELETE_BODY}</p>
      {error ? (
        <p role="alert" className="pt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </>
  );
  const onOpenChange = (v: boolean) => {
    if (!v && !busy) {
      setAsking(null);
      setError(null);
    }
  };

  return (
    <ProductActions.Provider value={value}>
      {children}
      {error && !asking ? (
        <p role="alert" className="px-6 pt-3 text-sm text-danger max-md:px-4">
          {error}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="sr-only">
        {toast?.words ?? ""}
      </p>
      {toast ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-[calc(theme(spacing.tabbar)+1rem+env(safe-area-inset-bottom))]">
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
      {phone ? (
        <Sheet
          open={asking !== null}
          onOpenChange={onOpenChange}
          kind="confirm"
          title={title}
          footer={
            <>
              <Button kind="danger" size="touch" full loading={busy} loadingLabel="Deleting" onClick={confirmDelete}>
                Delete product
              </Button>
              <Button kind="secondary" size="touch" full data-autofocus onClick={() => onOpenChange(false)}>
                Keep product
              </Button>
            </>
          }
        >
          {body}
        </Sheet>
      ) : (
        <Dialog
          open={asking !== null}
          onOpenChange={onOpenChange}
          kind="confirm"
          title={title}
          footer={
            <>
              <Button kind="secondary" data-autofocus onClick={() => onOpenChange(false)}>
                Keep product
              </Button>
              <Button kind="danger" loading={busy} loadingLabel="Deleting" onClick={confirmDelete}>
                Delete product
              </Button>
            </>
          }
        >
          {body}
        </Dialog>
      )}
    </ProductActions.Provider>
  );
}
