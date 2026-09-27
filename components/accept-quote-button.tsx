"use client";

// A quote the buyer can accept, as its table rows. Accepting closes the RFQ
// to every other quote, so it asks first: the row's Accept (secondary) opens
// a confirm row under the quote, and only that row's Accept — the screen's
// one primary while it is open — POSTs `{action:"accept_quote", quote_id}` to
// /api/v1/rfqs and refreshes on success.

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/dashboard/controls";
import { Cell, rowClass } from "@/components/dashboard/page";
import { cn } from "@/lib/utils";

export const ACCEPT_CLOSES_COPY = "This closes the RFQ to other quotes.";

export function AcceptQuoteRows({
  quoteId,
  question,
  colSpan,
  cells,
  after,
  joined = false,
}: {
  quoteId: string;
  /** "Accept 6.15 USD/pcs from Aboni Knitwear Ltd?" */
  question: string;
  /** The table's column count, for the confirm row. */
  colSpan: number;
  /** The quote row's cells, drawn by the server; this adds the Accept cell after them. */
  cells: ReactNode;
  /** The row under the quote (its notes), drawn before the confirm row. */
  after?: ReactNode;
  /** The quote row runs on into `after`, so its Accept cell carries no rule either. */
  joined?: boolean;
}) {
  // Not `useRouter()`, which throws outside a mounted app router.
  const router = useContext(AppRouterContext);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/rfqs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept_quote", quote_id: quoteId }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
        setError(j?.detail ?? j?.error ?? `error ${res.status}`);
        return;
      }
      startTransition(() => router?.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <tr className={rowClass({ current: confirming })}>
        {cells}
        {/* Pinned right, as the quotes table's action column is: Accept never scrolls out of a pane. */}
        <Cell align="right" className={cn("sticky right-0 border-l border-line-subtle bg-surface", joined && "border-b-0")}>
          <Button size="sm" onClick={() => setConfirming(true)} aria-expanded={confirming}>
            Accept
          </Button>
        </Cell>
      </tr>
      {after}
      {confirming ? (
        <tr>
          <td colSpan={colSpan} className="border-b border-line-subtle bg-surface-sunken px-4 py-3">
            <div role="group" aria-label="Accept this quote" className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="m-0 min-w-0 flex-1 text-sm text-ink-strong [overflow-wrap:anywhere]">
                {question} {ACCEPT_CLOSES_COPY}
              </p>
              <Button variant="primary" size="sm" onClick={accept} loading={busy || pending}>
                Accept
              </Button>
              {/* Focus lands on the answer that changes nothing, as a browser's own confirm does. */}
              <Button
                variant="ghost"
                size="sm"
                autoFocus
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                disabled={busy || pending}
              >
                Keep looking
              </Button>
            </div>
            {error ? (
              <p role="alert" className="m-0 mt-2 text-xs text-danger-ink">
                {error}
              </p>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  );
}
