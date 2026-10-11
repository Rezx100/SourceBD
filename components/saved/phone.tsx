"use client";

// The saved suppliers on a phone (Paper `11 · Saved · 3 selected, one RFQ`): a row is a 44 tick, the
// name, "Factory · Dhaka · 8 sources · 1,408 workers", and the first certificate to check; tapping
// the name opens the record as a page. Ticking shows "3 selected · Clear" under the tabs and an
// action bar above the tab bar: Remove, and one RFQ to everyone ticked. Client: it reads the selection.

import { Check } from "@phosphor-icons/react";
import Link from "next/link";
import { Button } from "@/components/kit";
import { buttonClass } from "@/components/kit/button-class";
import { LinkPending } from "@/components/patterns/link-pending";
import { useSelection } from "@/components/search/selection";
import { SEND_RFQ_MAX, rfqHref } from "@/lib/dashboard/selection";
import { formatCount, nameSecondLine, splitQualifier } from "@/lib/dashboard/facts";
import { oneLine } from "@/components/kit/classes";
import { cn } from "@/lib/utils";
import { useRemove } from "./actions";
import { CertCellView } from "./table";
import { TOO_MANY, typeAndPlace, type SavedItem } from "./words";

const noun = (n: number) => `${n} ${n === 1 ? "source" : "sources"}`;

/** The line under a name: "Factory · Dhaka · 8 sources · 1,408 workers", led by the name's qualifier when it has one. */
export function phoneLine(i: SavedItem): string {
  return [nameSecondLine(i.name, typeAndPlace(i)), noun(i.sources), i.workers ? `${i.workers} workers` : null].filter(Boolean).join(" · ");
}

export function SavedPhoneList({ items }: { items: readonly SavedItem[] }) {
  const sel = useSelection();
  const { remove, busy, error } = useRemove();
  const chosen = items.filter((i) => sel.isSelected(i.id));
  const count = chosen.length;
  return (
    // With the action bar up (64) the last rows keep their own room above it.
    <div className={cn("md:hidden", count > 0 && "pb-20")}>
      <div className="flex flex-col px-5 pt-4">
        {count > 0 ? (
          <div className="flex items-center justify-between pb-2 pt-1">
            <p className="text-[15px]/[18px] font-semibold text-ink">{formatCount(count)} selected</p>
            <button type="button" onClick={sel.clear} className="-mr-2 flex h-11 items-center rounded-sm px-2 text-base/[18px] font-medium text-ink-2 outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
              Clear
            </button>
          </div>
        ) : null}
        <ul className="flex flex-col overflow-clip rounded-[12px] border border-line">
          {items.map((i) => {
            const on = sel.interactive && sel.isSelected(i.id);
            return (
              <li key={i.id} className={cn("flex items-start gap-3 border-t border-line px-4 py-3.5 first:border-t-0", on && "bg-subtle")}>
                {/* A 22 box in a 44 target that reaches into the row's padding. */}
                <label className="-m-[11px] flex size-11 shrink-0 items-center justify-center">
                  <input type="checkbox" aria-label={`Select ${i.name}`} checked={on} disabled={!sel.interactive} onChange={() => sel.toggle(i.id)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className="flex size-[22px] items-center justify-center rounded-md border-[1.5px] border-line-strong bg-surface text-transparent peer-checked:border-ink peer-checked:bg-ink peer-checked:text-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus"
                  >
                    <Check size={14} />
                  </span>
                </label>
                <Link
                  href={i.pageHref}
                  prefetch={false}
                  className={cn("flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus", on ? "active:bg-line" : "active:bg-sunken")}
                >
                  <span className="flex items-center gap-1.5">
                    <span data-name="" title={i.name} className={cn(oneLine, "text-[15px]/[18px] font-medium text-ink")}>
                      {splitQualifier(i.name).qualifier ? (
                        <>
                          <span aria-hidden="true">{splitQualifier(i.name).base}</span>
                          <span className="sr-only">{i.name}</span>
                        </>
                      ) : (
                        i.name
                      )}
                    </span>
                    <LinkPending />
                  </span>
                  <span data-name="" className={cn(oneLine, "text-xs text-ink-3")}>
                    {phoneLine(i)}
                  </span>
                  <span className="pt-0.5 text-sm">
                    <CertCellView cell={i.cert} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      {error ? (
        <p role="alert" className="px-5 pt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {count > SEND_RFQ_MAX ? <p className="px-5 pt-3 text-xs text-caution">{TOO_MANY}</p> : null}
      {count > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(theme(spacing.tabbar)+env(safe-area-inset-bottom))] z-raised flex items-center gap-2 border-t border-line bg-surface px-4 pb-1.5 pt-2.5">
          <Button
            kind="secondary"
            size="touch"
            className="w-[110px] rounded-lg"
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
            <Link href={rfqHref(chosen[0]!.listHref, chosen.map((c) => c.id))} className={buttonClass({ kind: "primary", size: "touch", className: "min-w-0 flex-1 rounded-lg" })}>
              Send one RFQ to {count}
            </Link>
          ) : (
            <span aria-disabled="true" className={buttonClass({ kind: "primary", size: "touch", className: "min-w-0 flex-1 rounded-lg" })}>
              Send one RFQ to {count}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
