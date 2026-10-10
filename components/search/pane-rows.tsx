"use client";

// The narrow list beside an open record or the composer is a ledger too (critique of 8 Oct 2026,
// round 3, item 2): each row has the table's tick, its keys (↑ ↓ j k, Enter, Space, r, s) and its ⋯
// menu, so a buyer can open a record, tick five suppliers and write one RFQ to them without closing
// the pane. The name opens the record; the open one keeps `aria-current`. Client: it reads the selection.

import { ABSENT, CertSummaryCell, SupplierRow } from "@/components/patterns";
import { Checkbox, Unpublished } from "@/components/kit";
import { onRowKey } from "./keys";
import type { ResultRow } from "./model";
import { useSelection } from "./selection";
import { RowActions, useRowSave } from "./table";

/** The same cell the table draws, so a certificate looks the same beside a pane and on a phone; `reveal` where it sits outside the row's link. */
export function Problem({ r, reveal }: { r: ResultRow; reveal?: boolean }) {
  return r.certCell ? <CertSummaryCell cert={r.certCell} reveal={reveal} /> : <Unpublished>{ABSENT.certificates}</Unpublished>;
}

/** Beside a pane: tick, name, type and place, the first certificate problem, the source count, the ⋯ menu. */
export function PaneRows({ rows, currentSlug }: { rows: readonly ResultRow[]; currentSlug?: string | null }) {
  const sel = useSelection();
  const { save, toast } = useRowSave();
  return (
    <>
      {/* With a record open the arrows change it, as in the table (`data-follow`). */}
      <ul onKeyDown={onRowKey} data-follow={currentSlug != null ? "record" : undefined}>
        {rows.map((r) => {
          const selectable = sel.interactive && Boolean(r.supplierId);
          const ticked = selectable && sel.isSelected(r.supplierId!);
          return (
            <li key={r.slug} data-row="result" tabIndex={0} aria-current={r.slug === currentSlug ? "true" : undefined} className="outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus">
              <SupplierRow
                layout="pane"
                href={r.paneHref}
                name={r.name}
                type={r.type}
                place={r.place}
                sources={r.sources}
                problem={<Problem r={r} />}
                selected={r.slug === currentSlug}
                ticked={ticked}
                select={<Checkbox aria-label={`Select ${r.name}`} checked={ticked} disabled={!selectable} onChange={selectable ? () => sel.toggle(r.supplierId!) : () => {}} />}
                actions={<RowActions r={r} save={save} />}
              />
            </li>
          );
        })}
      </ul>
      {toast}
    </>
  );
}
