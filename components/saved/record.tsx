// A saved supplier's record in the pane beside the list (`/app/saved?open=<slug>`): the same record
// view the search draws, read with the same loader, so a failed or slow read is said in the pane
// and never as an empty record. Server component.

import Link from "next/link";
import { buttonClass } from "@/components/kit";
import { RecordView, parseTab, type TabId } from "@/components/record";
import { PaneFrame } from "@/components/search/pane";
import { ProfileReadTimeout, loadRecordSheet } from "@/lib/dashboard/load-record";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { savedHref, type SavedView } from "./words";

export type SavedRecordRead = { slug: string; model: SupplierSheetModel | null; slow: boolean };

/** Never throws: a slow read and a missing record come back as states the pane says out loud. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as loadRecordSheet takes it.
export async function readSavedRecord(supabase: any, slug: string, today: Date, view: SavedView, supplierId: string | null = null): Promise<SavedRecordRead> {
  try {
    const model = await loadRecordSheet(supabase, slug, today, {
      pins: parseTab(view.tab ?? undefined) === "sites",
      closeHref: savedHref({ ...view, open: null }),
      fullHref: `/app/suppliers/${slug}`,
      supplierId,
    });
    return { slug, model, slow: false };
  } catch (err) {
    return { slug, model: null, slow: err instanceof ProfileReadTimeout };
  }
}

export function SavedRecordPane({ read, view, today }: { read: SavedRecordRead; view: SavedView; today: Date }) {
  const { slug, model, slow } = read;
  const closeHref = savedHref({ ...view, open: null });
  if (model) {
    const tab: TabId = parseTab(view.tab ?? undefined);
    return (
      <PaneFrame openKey={`record:${slug}`}>
        <RecordView model={model} mode="pane" tab={tab} tabHref={(t) => savedHref({ ...view, open: slug, tab: t })} today={today} backHref={closeHref} />
      </PaneFrame>
    );
  }
  return (
    <PaneFrame openKey={`notice:${slug}`}>
      <div data-record-pane="" tabIndex={-1} aria-label="Supplier record" role="region" className="flex flex-col gap-3 p-6 outline-none">
        <h2 className="text-lg font-semibold text-ink">{slow ? "This record could not be read in time" : "No record for that link"}</h2>
        <p className="text-base text-ink-2">
          {slow
            ? "The database is under load. The company is still on SourceBD; this read simply took too long. Your saved list is still here behind this."
            : "It may have been unpublished, the link may be wrong, or it could not be read just now. Your saved list is still here behind this."}
        </p>
        <div className="flex gap-2 pt-1">
          {slow ? (
            <Link href={savedHref({ ...view, open: slug })} scroll={false} prefetch={false} className={buttonClass({ kind: "primary" })}>
              Try again
            </Link>
          ) : null}
          <Link href={closeHref} scroll={false} prefetch={false} className={buttonClass({ kind: "secondary" })}>
            Close
          </Link>
        </div>
      </div>
    </PaneFrame>
  );
}
