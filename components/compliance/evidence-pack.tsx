"use client";

// "Download an evidence pack" on Compliance (Paper `10 · Evidence pack download dialog`, gap row 8):
// the three sections as checkboxes, how many saved suppliers they cover, Cancel and Download pack. A
// dialog on a desktop, a sheet on a phone. The file is CSV only (no PDF library is in the repo), and
// there is no preview of its rows: reading them is the download, which is recorded and capped at 50 a
// day, so nothing here may read them early. Works once migration 0114 is applied.

import { FileArrowDown } from "@phosphor-icons/react";
import { useState } from "react";
import { Button, Checkbox, Dialog, Sheet, Toast } from "@/components/kit";
import { useIsPhone } from "@/components/kit/use-phone";
import { saveBlob } from "@/lib/dashboard/selection";
import { PACK_SECTIONS, runPackDownload, type PackSection } from "./pack";

export function EvidencePackButton({ saved, className }: { /** Saved suppliers the pack covers; null when it could not be read. */ saved: number | null; className?: string }) {
  const phone = useIsPhone();
  const [open, setOpenState] = useState(false);
  const [picked, setPicked] = useState<readonly PackSection[]>(PACK_SECTIONS.map((s) => s.key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState("");

  const setOpen = (next: boolean) => {
    if (!next && busy) return; // a download in flight finishes where the buyer can see it
    if (next) setError(null);
    setOpenState(next);
  };

  async function download() {
    if (busy || picked.length === 0) return;
    setBusy(true);
    setError(null);
    const result = await runPackDownload(picked, {
      fetch: (body) => fetch("/api/v1/evidence-pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      save: (blob, filename) => saveBlob(document, URL, (fn) => setTimeout(fn, 1000), blob, filename),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOpenState(false);
    setDone(result.message);
    setTimeout(() => setDone(""), 5000);
  }

  const body = (
    <div className="flex flex-col gap-4">
      <p className="text-base text-ink-2">One file for an auditor, from the suppliers on your saved list. Choose what it holds.</p>
      <fieldset className="flex flex-col gap-3 border-0 p-0">
        <legend className="sr-only">Sections</legend>
        {PACK_SECTIONS.map((s) => (
          <div key={s.key} className="flex flex-col gap-0.5">
            <Checkbox
              size={phone ? "touch" : "md"}
              checked={picked.includes(s.key)}
              onChange={(e) => setPicked(e.target.checked ? PACK_SECTIONS.map((x) => x.key).filter((k) => k === s.key || picked.includes(k)) : picked.filter((k) => k !== s.key))}
            >
              <span className="pl-2 text-base font-medium text-ink">{s.label}</span>
            </Checkbox>
            <p className="pl-8 text-sm text-ink-3 max-md:pl-9">{s.hint}</p>
          </div>
        ))}
      </fieldset>
      <dl className="flex flex-col gap-1 text-base">
        <div className="flex justify-between gap-3 border-t border-line pt-3">
          <dt className="text-ink-2">Saved suppliers</dt>
          <dd className="font-semibold tabular-nums text-ink">{saved === null ? "—" : saved}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-2">File</dt>
          <dd className="text-ink">CSV</dd>
        </div>
      </dl>
      <p className="text-xs text-ink-3">Each download is recorded in your account, up to 50 a day.</p>
      <p role="status" aria-live="polite" className={error ? "text-sm text-danger" : "sr-only"}>
        {error ?? ""}
      </p>
    </div>
  );
  const save = (
    <Button kind="primary" size={phone ? "touch" : "md"} full={phone} loading={busy} loadingLabel="Preparing" disabled={picked.length === 0} onClick={() => void download()}>
      Download pack
    </Button>
  );
  const cancel = (
    <Button kind={phone ? "secondary" : "quiet"} size={phone ? "touch" : "md"} full={phone} onClick={() => setOpen(false)}>
      Cancel
    </Button>
  );

  return (
    <>
      <Button icon={FileArrowDown} kind="secondary" onClick={() => setOpen(true)} className={className}>
        Download an evidence pack
      </Button>
      {phone ? (
        <Sheet open={open} onOpenChange={setOpen} title="Download an evidence pack" footer={<>{save}{cancel}</>}>
          {body}
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen} kind="form" title="Download an evidence pack" footer={<>{cancel}{save}</>}>
          {body}
        </Dialog>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {done}
      </span>
      {done ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-toast flex justify-center px-4 max-md:bottom-[calc(theme(spacing.tabbar)_+_1.5rem)]">
          <Toast className="pointer-events-auto">{done}</Toast>
        </div>
      ) : null}
    </>
  );
}
