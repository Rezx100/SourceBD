"use client";

// Accept a quote (Paper `10 · Accept quote confirm dialog`, `11 · Accept quote confirm sheet`).
// Accepting closes the RFQ to every other quote, so it asks first: the price, the quantity,
// the order value and the lead time repeated, a caution for a lead time past the ship-by date
// or an MOQ above the quantity, and what happens next in words. A dialog on desktop, a bottom
// sheet on a phone. The safe answer ("Not now") has focus; only the dialog's own Accept
// POSTs `{action:"accept_quote", quote_id}` to /api/v1/rfqs and refreshes on success.

import { Warning } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Button, Dialog, DialogClose, Sheet } from "@/components/kit";

const PHONE = "(max-width: 767px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useIsPhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);

export type AcceptProps = {
  quoteId: string;
  /** The supplier's name as a sentence uses it: "Aboni Knitwear". */
  shortName: string;
  summary: { price: string; quantity: string; total: string; lead: string | null };
  cautions: string[];
  /** The best quote's button is the primary one; the rest are secondary. */
  primary?: boolean;
  /** `touch` is the phone's 44. */
  size?: "md" | "touch";
  full?: boolean;
};

/** What accepting does, in words: the RFQ closes to other quotes, and the order is the next step. */
export const acceptNext = (shortName: string) => `Accepting closes the RFQ to other quotes. You can then create the order with ${shortName} from this quote.`;

function Summary({ s }: { s: AcceptProps["summary"] }) {
  const rows: [string, string, boolean][] = [
    ["Price", s.price, true],
    ["Quantity", s.quantity, false],
    ["Order value", s.total, true],
    ...(s.lead ? ([["Lead time", s.lead, false]] as [string, string, boolean][]) : []),
  ];
  return (
    <dl className="flex flex-col gap-1.5 rounded-md bg-subtle p-4 text-base">
      {rows.map(([k, v, bold]) => (
        <div key={k} className="flex justify-between gap-4">
          <dt className="text-ink-2">{k}</dt>
          <dd className={bold ? "text-right font-semibold text-ink" : "text-right text-ink"}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The POST behind Accept: null when the quote was accepted, else the words to show. Never throws. */
export async function postAccept(quoteId: string, send: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await send("/api/v1/rfqs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "accept_quote", quote_id: quoteId }),
    });
    if (res.ok) return null;
    const j = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
    return j?.detail ?? j?.error ?? `The quote could not be accepted (error ${res.status}).`;
  } catch (e) {
    return e instanceof Error ? e.message : "The quote could not be accepted. Check your connection and try again.";
  }
}

/** What the dialog and the sheet say: the figures again, the cautions, and what accepting does. */
export function AcceptBody({ shortName, summary, cautions, error }: Pick<AcceptProps, "shortName" | "summary" | "cautions"> & { error?: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      <Summary s={summary} />
      {cautions.length > 0 ? (
        <div role="note" className="flex flex-col gap-2 rounded-md bg-caution-tint p-3 text-base text-caution">
          {cautions.map((c) => (
            <p key={c} className="flex items-start gap-2">
              <Warning size={16} weight="fill" className="mt-0.5 shrink-0 text-caution-icon" aria-hidden />
              <span>{c}</span>
            </p>
          ))}
        </div>
      ) : null}
      <p className="text-base text-ink-2">{acceptNext(shortName)}</p>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AcceptQuote({ quoteId, shortName, summary, cautions, primary = false, size = "md", full = false }: AcceptProps) {
  const router = useRouter();
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const failed = await postAccept(quoteId);
    setBusy(false);
    if (failed) return setError(failed);
    setOpen(false);
    router.refresh();
  }

  const title = `Accept ${shortName}'s quote?`;
  const body = <AcceptBody shortName={shortName} summary={summary} cautions={cautions} error={error} />;
  const tier = size === "touch" ? "touch" : "md";
  const trigger = (
    <Button kind={primary ? "primary" : "secondary"} size={tier} full={full} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      Accept quote
    </Button>
  );
  const leave = (
    <DialogClose asChild>
      <Button kind="secondary" size={phone ? "touch" : "md"} full={phone} data-autofocus disabled={busy}>
        Not now
      </Button>
    </DialogClose>
  );
  const confirm = (
    <Button kind="primary" size={phone ? "touch" : "md"} full={phone} loading={busy} loadingLabel="Accepting" onClick={accept}>
      Accept quote
    </Button>
  );
  return (
    <>
      {trigger}
      {phone ? (
        <Sheet open={open} onOpenChange={(v) => !busy && setOpen(v)} kind="confirm" title={title} footer={<>{confirm}{leave}</>}>
          {body}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)} title={title} footer={<>{leave}{confirm}</>}>
          {body}
        </Dialog>
      )}
    </>
  );
}
