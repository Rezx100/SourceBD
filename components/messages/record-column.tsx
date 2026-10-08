// The supplier's record beside a conversation (B6a, Paper `10 · Messages · thread with record
// beside`, `11 · record as a sheet`): the 344 column. It is a summary built from the same record
// model as the pane and the page, so it can say only what the registers filed: the name and what it
// is, the RFQ this conversation is about, four lines (certificates, RSC, workers, contact), the
// certificates and the sources. A contact value never reaches it, only how many are on file.
// Server component; `beside.tsx` places it.

import { X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { buttonClass } from "@/components/kit";
import { CertTable, REFUSAL, SanctionBanner, SourceList, onFileWords, type SourceEntry } from "@/components/patterns";
import { certRows, dayOfWords, recordSubline, summaryCells } from "@/components/record/words";
import { formatDay } from "@/lib/dashboard/facts";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import type { RfqDoc } from "@/components/rfqs/doc";
import { quantityWords } from "@/components/rfqs/words";
import { cn } from "@/lib/utils";

const textLink = "rounded-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function Row({ label, children, muted }: { label: string; children: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-sm text-ink-3">{label}</dt>
      <dd className={cn("text-right text-base", muted ? "text-ink-2" : "font-medium text-ink")}>{children}</dd>
    </div>
  );
}

/** The record could not be opened: too slow, or no record for the link. The conversation beside it keeps working. */
export function ColumnNotice({ slow, retryHref, closeHref }: { slow: boolean; retryHref: string; closeHref: string }) {
  return (
    <div data-record-column="" role="region" aria-label="Supplier record" className="flex flex-col gap-3 p-5">
      <h2 className="text-md font-semibold text-ink">{slow ? "This record could not be read in time" : "No record for that link"}</h2>
      <p className="text-base text-ink-2">
        {slow
          ? "The database is under load. The company is still on SourceBD; this read simply took too long."
          : "It may have been unpublished, the link may be wrong, or it could not be read just now. Your conversation is still here."}
      </p>
      <div className="flex gap-2 pt-1">
        {slow ? (
          <Link href={retryHref} prefetch={false} scroll={false} className={buttonClass({ kind: "primary" })}>
            Try again
          </Link>
        ) : null}
        <Link href={closeHref} prefetch={false} scroll={false} className={buttonClass({ kind: "secondary" })}>
          Close
        </Link>
      </div>
    </div>
  );
}

export function RecordColumn({
  model,
  today,
  rfq,
  quote,
  closeHref,
}: {
  model: SupplierSheetModel;
  today: Date;
  /** The RFQ this conversation is about, when it could be read. */
  rfq: RfqDoc | null;
  /** What this supplier has said about it, in the words the strip uses. */
  quote: string | null;
  closeHref: string;
}) {
  const cells = summaryCells(model, today);
  const cell = (key: string) => cells.find((c) => c.key === key)!;
  const certs = cell("certificates");
  const rsc = cell("rsc");
  const workers = cell("workers");
  const counts = model.contact.counts;
  const locked = counts ? onFileWords(counts.emails, counts.phones, counts.website, counts.representatives) : null;
  const sources: SourceEntry[] = model.sources.map((s) => ({ source: s.mark.code, label: s.mark.label, fullName: s.name, checkedOn: dayOfWords(s.readDate) }));
  const list = model.sanctions[0] ?? null;
  const listName = list?.list ?? "sanctions list";
  const joined = (c: { value: string; sub: string | null }) => [c.value, c.sub].filter(Boolean).join(" · ");

  return (
    <div data-record-column="" role="region" aria-label="Supplier record" className="flex min-h-0 flex-1 flex-col bg-surface">
      {model.sanctioned ? <SanctionBanner title={`On the ${listName}${list?.listedOn ? ` since ${list.listedOn}` : ""}.`} detail={REFUSAL} /> : null}
      <header className="flex flex-col gap-1 border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-2 max-xl:hidden">
          <h2 className="text-lg font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{model.name}</h2>
          <Link href={closeHref} scroll={false} prefetch={false} aria-label="Close record" className={buttonClass({ kind: "quiet", size: "icon-32" })}>
            <X size={20} aria-hidden />
          </Link>
        </div>
        <p className="text-base text-ink-2">{recordSubline(model)}</p>
        <Link href={model.fullHref} prefetch={false} className={cn(textLink, "self-start text-base max-md:flex max-md:min-h-11 max-md:items-center")}>
          Open full record
        </Link>
      </header>

      {rfq ? (
        <section aria-label="Your RFQ in this conversation" className="flex flex-col gap-2 border-b border-line px-5 py-4">
          <h3 className="text-xs font-semibold text-ink-3">Your RFQ in this conversation</h3>
          <p className="text-base font-medium text-ink">{rfq.product_title}</p>
          <p className="text-sm text-ink-2">{[quantityWords(rfq.quantity, rfq.quantity_unit), rfq.ship_by ? `ship by ${formatDay(rfq.ship_by)}` : null, `sent ${formatDay(rfq.created_at) ?? "date not recorded"}`].filter(Boolean).join(" · ")}</p>
          <div className="flex items-center justify-between gap-3">
            {quote ? <span className="flex h-6 items-center rounded-sm border border-line px-2 text-sm font-medium text-ink-2">{quote}</span> : <span />}
            <Link href={`/app/rfqs?open=${encodeURIComponent(rfq.id)}`} prefetch={false} className={cn(textLink, "text-base max-md:flex max-md:min-h-11 max-md:items-center")}>
              View RFQ
            </Link>
          </div>
        </section>
      ) : null}

      <dl className="flex flex-col border-b border-line px-5 pb-4 pt-2">
        <Row label="Certificates">{joined(certs)}</Row>
        <Row label="RSC safety inspections">{joined(rsc)}</Row>
        <Row label="Workers" muted={Boolean(workers.valueWords)}>
          {workers.valueWords ? "Workforce not published" : joined(workers)}
        </Row>
        <Row label="Contact" muted>
          {locked ? `${locked} · locked` : "Details are locked until the supplier replies"}
        </Row>
      </dl>

      {model.certs.length > 0 ? (
        <div className="border-b border-line px-5 py-4">
          <CertTable certs={certRows(model, today)} today={today} compact />
        </div>
      ) : null}

      {sources.length > 0 ? (
        <div className="px-5 py-4">
          <SourceList sources={sources} today={today} />
        </div>
      ) : null}
    </div>
  );
}
