"use client";

// The bar over the table: the filter bar while nothing is ticked, the ink bulk bar while
// something is (Paper `10 · Results, 3 selected`). "3 suppliers selected · Select all 25 on
// this page", Save, Download CSV, "Send RFQ to 3 suppliers", and the × that clears. Save and
// Download say how they ended in a live region, even after the selection is cleared. The
// rules (the 50-supplier cap on one RFQ, what a partial save says, the CSV's refusals) are
// `lib/dashboard/selection.ts`.

import { X } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { BulkBar, bulkActionClass, bulkCloseClass } from "@/components/kit";
import { SEND_RFQ_MAX, announceBulkSaved, bulkExportHref, clearKeepingFocus, interceptPlainClick, rfqHref, runBulkSave, runExport, saveBlob } from "@/lib/dashboard/selection";
import { useRouter } from "next/navigation";
import { SELECT_ALL_ID, useSelection } from "./selection";

export const TOO_MANY = `One RFQ goes to up to ${SEND_RFQ_MAX} suppliers. Untick some to send.`;
export const STILL_SAVING = "Still saving. Its result will show here.";
export const SAVING = "Saving…";
export const PREPARING = "Preparing the download…";
export const STILL_PREPARING = "Still preparing the download. Its result will show here.";
/** A result that lands after the selection changed says which selection it was for. */
export const EARLIER = "For your earlier selection: ";

const sentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

export function ResultsBar({
  toolbar,
  exportHref,
  searchHref,
  pageSize,
  narrow = false,
}: {
  /** The filter bar, drawn by the page; shown while nothing is ticked. */
  toolbar: ReactNode;
  exportHref: string;
  /** The search these rows belong to; the bulk RFQ opens on it. */
  searchHref: string;
  /** How many suppliers this page lists: "Select all 25 on this page". */
  pageSize: number;
  /** Beside a pane (576 wide): "3 selected", no Select all, "Send RFQ to 3", so the bar stays one line. */
  narrow?: boolean;
}) {
  const sel = useSelection();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState("");
  const noteId = useId();
  // Bumped on every edit so a result that lands later can say which selection it was for.
  const generation = useRef(0);
  const saving = useRef(false);
  const exporting = useRef(false);
  const count = sel.selected.size;

  useEffect(() => {
    generation.current += 1;
    if (!saving.current) setStatus("");
    if (!exporting.current) setDownloadStatus("");
  }, [sel.edits]);

  const ids = [...sel.selected];
  const message = [status, downloadStatus].filter(Boolean).map(sentence).join(" ");

  async function save() {
    if (saving.current) return setStatus(STILL_SAVING);
    saving.current = true;
    setBusy(true);
    setStatus(SAVING);
    const asked = generation.current;
    const said = await runBulkSave(ids, {
      fetch: (url, init) => fetch(url, init),
      onSaved: (saved) => {
        announceBulkSaved(window, saved);
        router.refresh();
      },
    });
    saving.current = false;
    setBusy(false);
    setStatus(generation.current === asked ? said : `${EARLIER}${said}`);
  }

  async function download(e: MouseEvent<HTMLElement>) {
    if (!interceptPlainClick(e)) return;
    if (exporting.current) return setDownloadStatus(STILL_PREPARING);
    exporting.current = true;
    setDownloading(true);
    setDownloadStatus(PREPARING);
    const asked = generation.current;
    const said = await runExport(bulkExportHref(exportHref, ids), count, {
      fetch: (url) => fetch(url),
      save: (blob, filename) => saveBlob(document, URL, (fn) => setTimeout(fn, 1000), blob, filename),
    });
    exporting.current = false;
    setDownloading(false);
    setDownloadStatus(generation.current === asked ? said : `${EARLIER}${said}`);
  }

  const announcer = sel.interactive ? (
    <span role="status" aria-live="polite" className="sr-only">
      {count > 0 ? `${count} selected. Bulk actions are above the results.` : ""}
    </span>
  ) : null;

  if (!sel.interactive || (count === 0 && !message)) {
    return (
      <>
        {announcer}
        {toolbar}
      </>
    );
  }

  return (
    <>
      {announcer}
      {count > 0 ? (
        <BulkBar
          summary={narrow ? `${count} selected` : `${count} ${count === 1 ? "supplier" : "suppliers"} selected`}
          selectAll={
            sel.allState === true || narrow ? null : (
              <button type="button" onClick={sel.toggleAllOnPage} className="rounded-sm font-medium underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface">
                Select all {pageSize} on this page
              </button>
            )
          }
          clear={
            <button type="button" aria-label="Clear selection" className={bulkCloseClass} onClick={() => clearKeepingFocus(document.getElementById(SELECT_ALL_ID), sel.clear)}>
              <X size={16} aria-hidden />
            </button>
          }
        >
          <button type="button" onClick={save} aria-busy={busy || undefined} className={bulkActionClass()}>
            Save
          </button>
          <a href={bulkExportHref(exportHref, ids)} onClick={download} aria-busy={downloading || undefined} className={bulkActionClass()}>
            Download CSV
          </a>
          {count <= SEND_RFQ_MAX ? (
            <Link href={rfqHref(searchHref, ids)} scroll={false} className={bulkActionClass(true)}>
              Send RFQ to {count}
              {narrow ? null : ` ${count === 1 ? "supplier" : "suppliers"}`}
            </Link>
          ) : (
            <span aria-disabled="true" aria-describedby={noteId} className={`${bulkActionClass(true)} cursor-not-allowed text-disabled`}>
              Send RFQ to {count} suppliers
            </span>
          )}
        </BulkBar>
      ) : (
        toolbar
      )}
      <div className="flex flex-col gap-0.5 pt-1.5">
        <p role="status" aria-live="polite" className="min-h-4 text-xs text-ink-3">
          {message}
        </p>
        {count > SEND_RFQ_MAX ? (
          <p id={noteId} className="text-xs text-caution">
            {TOO_MANY}
          </p>
        ) : null}
      </div>
    </>
  );
}
