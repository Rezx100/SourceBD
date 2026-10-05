"use client";

// The saved suppliers on a phone (Paper `11 · Saved · 3 selected, one RFQ`): a row is a 44 tick, the
// name, "Factory · Dhaka · 8 sources · 1,408 workers", and the first certificate to check; tapping
// the name opens the record as a page. Ticking shows "3 selected · Clear" under the tabs and an
// action bar above the tab bar: Remove, and one RFQ to everyone ticked. Client: it reads the selection.

import { Check } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/kit";
import { buttonClass } from "@/components/kit/button-class";
import { useSelection } from "@/components/search/selection";
import { SEND_RFQ_MAX } from "@/lib/dashboard/selection";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import { useRemove } from "./actions";
import { CertCellView } from "./table";
import { TOO_MANY, rfqHref, typeAndPlace, type SavedItem } from "./words";

const noun = (n: number) => `${n} ${n === 1 ? "source" : "sources"}`;

/** The line under a name: "Factory · Dhaka · 8 sources · 1,408 workers". */
export function phoneLine(i: SavedItem): string {
  return [typeAndPlace(i), noun(i.sources), i.workers ? `${i.workers} workers` : null].filter(Boolean).join(" · ");
}

export function SavedPhoneList({ items }: { items: readonly SavedItem[] }) {
  const sel = useSelection();
  const { remove, busy, error } = useRemove();
  const chosen = items.filter((i) => sel.isSelected(i.id));
  const count = chosen.length;
  return (
    // With the action bar up (64) the last rows keep their own room above it.
    <div className={cn("md:hidden", count > 0 && "pb-20")}>
      {count > 0 ? (
        <div className="flex h-11 items-center justify-between border-y border-cert-valid-edge bg-subtle px-4">
          <p className="text-md font-semibold text-ink">{formatCount(count)} selected</p>
          <button type="button" onClick={sel.clear} className="flex h-11 items-center rounded-sm text-md font-medium text-brand underline decoration-1 [text-underline-position:from-font] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
            Clear
          </button>
        </div>
      ) : null}
      <ul>
        {items.map((i) => {
          const on = sel.interactive && sel.isSelected(i.id);
          return (
            <li key={i.id} className={cn("flex gap-1 border-b border-line py-3 pl-1 pr-4", on && "bg-brand-tint")}>
              <label className="flex size-11 shrink-0 items-center justify-center">
                <input type="checkbox" aria-label={`Select ${i.name}`} checked={on} disabled={!sel.interactive} onChange={() => sel.toggle(i.id)} className="peer sr-only" />
                <span
                  aria-hidden
                  className="flex size-[22px] items-center justify-center rounded-sm border-[1.5px] border-line-strong bg-surface text-transparent peer-checked:border-brand peer-checked:bg-brand peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"
                >
                  <Check size={16} />
                </span>
              </label>
              <Link href={i.pageHref} prefetch={false} className="flex min-h-11 min-w-0 flex-1 flex-col gap-1 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                <span className="text-md font-medium text-ink">{i.name}</span>
                <span className="text-sm text-ink-3">{phoneLine(i)}</span>
                <span className="text-sm">
                  <CertCellView cell={i.cert} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="px-4 pt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {count > SEND_RFQ_MAX ? <p className="px-4 pt-3 text-xs text-caution">{TOO_MANY}</p> : null}
      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))] z-raised flex h-16 items-center gap-2 border-t border-line bg-surface px-4">
          <Button
            kind="secondary"
            size="touch"
            loading={busy}
            loadingLabel="Removing"
            onClick={async () => {
              const done = await remove(chosen.map((c) => ({ id: c.id, name: c.name })));
              if (done) sel.clear();
            }}
          >
            Remove
          </Button>
          {count <= SEND_RFQ_MAX ? (
            <Link href={rfqHref(chosen.map((c) => c.id))} className={buttonClass({ kind: "primary", size: "touch", className: "min-w-0 flex-1 font-semibold" })}>
              Send one RFQ to {count}
            </Link>
          ) : (
            <span aria-disabled="true" className={buttonClass({ kind: "primary", size: "touch", className: "min-w-0 flex-1 font-semibold" })}>
              Send one RFQ to {count}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
