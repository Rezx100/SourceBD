// A supplier record opened in the pane beside a list that is not the search:
// the conversation on /app/messages/[thread] (`?record=`) and the Saved list
// (`?open=`). One read and one pane for both, so a failed read is said the
// same way on each — and never as an empty record.
//
// Server-only: the read goes through `loadRecordSheet`, which carries the
// contact-COUNT rule (no contact value reaches this HTML) and the caller-owned
// RFQ filter.

import { ProfileReadTimeout, loadRecordSheet } from "@/lib/dashboard/load-record";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { SaveRecordButton } from "./save-record-button";
import { RecordPane, SheetNotice } from "./sheet";
import { SupplierSheet } from "./supplier-sheet";

export type RecordBesideRead = { slug: string; model: SupplierSheetModel | null; slow: boolean };

/** Read the record for the pane. Never throws: a slow read and a missing record come back as states the pane says out loud. */
export async function readRecordBeside(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client, as loadRecordSheet takes it.
  supabase: any,
  slug: string,
  closeHref: string,
  today: Date = new Date(),
  /** The record's id when the list row that opened it carries it (`SheetView.supplierId`). */
  supplierId: string | null = null,
): Promise<RecordBesideRead> {
  try {
    return { slug, model: await loadRecordSheet(supabase, slug, today, { closeHref, supplierId }), slow: false };
  } catch (err) {
    return { slug, model: null, slow: err instanceof ProfileReadTimeout };
  }
}

/** The pane: the record, or the notice that says why there is none. Close (and Escape) return to `closeHref`. */
export function RecordBeside({ read, closeHref, retryHref }: { read: RecordBesideRead; closeHref: string; retryHref: string }) {
  const { slug, model } = read;
  return (
    <RecordPane closeHref={closeHref} openKey={`${model ? "record" : "notice"}:${slug}`}>
      <RecordBesideBody read={read} closeHref={closeHref} retryHref={retryHref} />
    </RecordPane>
  );
}

/**
 * What goes inside the pane, without the pane: Saved draws its pane at once
 * and streams this into it behind the record's silhouette, so the list never
 * waits on the record's reads.
 */
export function RecordBesideBody({ read, closeHref, retryHref }: { read: RecordBesideRead; closeHref: string; retryHref: string }) {
  const { model, slow } = read;
  return (
    <>
      {model ? (
        <SupplierSheet
          model={model}
          backHref={retryHref}
          save={model.supplierId ? <SaveRecordButton supplierId={model.supplierId} saved={model.saved} /> : undefined}
        />
      ) : slow ? (
        <SheetNotice
          title="This record could not be read in time"
          body="The database is under load. The company is still on SourceBD — this read simply took too long."
          action={{ label: "Try again", href: retryHref }}
          closeHref={closeHref}
        />
      ) : (
        <SheetNotice
          title="No record for that link"
          body="It may have been unpublished, the link may be wrong, or it could not be read just now."
          closeHref={closeHref}
        />
      )}
    </>
  );
}
