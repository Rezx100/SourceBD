// One RFQ (Paper `10 · RFQ detail in the pane`, `· quotes (page)`, `· error`, `11 · RFQ detail`):
// one view for the pane beside the list and the full page. The request and its facts at the
// top, the quotes side by side against the target, the quantity and the ship-by date, and the
// suppliers that have not answered. Desktop page from 1280: a table. In the pane, and on the
// page under 1280: a two-line row per quote. On a phone: a card per supplier with Accept as a
// 44-tall button. Only what `rfq_get` holds is drawn: there is no reminder, no source count and
// no per-supplier state beyond "has a quote on file".

import { ArrowLeft, ChatCircle, Warning, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { InlineError, Table, Td, Th, Tr, buttonClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { AcceptQuote } from "./accept";
import { RfqChip } from "./chip";
import { detailModel, type DetailModel, type NoReplyModel, type QuoteModel, type RfqDoc } from "./doc";
import { ShowMore } from "./show-more";
import { shortName } from "./words";

export type OrderRef = { id: string } | null;

const NAME = "rounded-sm font-medium text-ink underline decoration-line-strong decoration-1 [text-underline-position:from-font] outline-none hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const TABULAR = "[font-variant-numeric:tabular-nums]";
/** The quotes table's head: two lines allowed, a little side padding (Paper's dense head). */
const HEAD_WRAP = "h-auto min-h-row-head";
const DENSE = "h-auto min-h-row-head px-2 py-1 leading-4";

function Caution({ children, chip = false }: { children: ReactNode; chip?: boolean }) {
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium text-caution", chip && "w-fit rounded-sm bg-caution-tint px-1.5 py-px")}>
      <Warning size={12} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
      {children}
    </span>
  );
}

/** What stands where Accept does: the button on an open RFQ, the order on an accepted one, the outcome otherwise. */
function QuoteAction({ q, m, order, size = "md", full = false, best }: { q: QuoteModel; m: DetailModel; order: OrderRef; size?: "md" | "touch"; full?: boolean; best: boolean }) {
  if (q.status === "submitted" && m.canAccept) {
    return <AcceptQuote quoteId={q.id} shortName={shortName(q.supplier)} summary={q.summary} cautions={q.cautions} primary={best} size={size} full={full} />;
  }
  if (q.status === "accepted") {
    const link = order ? { href: `/app/orders/${order.id}`, label: "Open order", kind: "secondary" as const } : m.canAccept ? null : { href: `/app/orders/new?from_quote=${q.id}`, label: "Create order", kind: "primary" as const };
    return (
      <span className={cn("flex flex-col items-end gap-1.5", full && "items-stretch")}>
        <RfqChip tone="accepted" className={full ? "self-start" : undefined}>
          Accepted
        </RfqChip>
        {link ? (
          <Link href={link.href} prefetch={false} className={buttonClass({ kind: link.kind, size, full })}>
            {link.label}
          </Link>
        ) : null}
      </span>
    );
  }
  return <span className="text-sm text-ink-3">{q.status === "rejected" ? "Not chosen" : q.status === "withdrawn" ? "Withdrawn" : null}</span>;
}

function NoReplyNote({ n }: { n: NoReplyModel }) {
  return <>No reply yet · RFQ sent {n.sent}</>;
}

/** The quotes as the page draws them from 1280: a real table. */
function QuotesTable({ m, order }: { m: DetailModel; order: OrderRef }) {
  return (
    <Table className={cn("table-fixed max-xl:hidden", TABULAR)}>
      {/* Paper's widths: the supplier takes what is left; the figures wrap to two lines rather than push it. */}
      <thead>
        <tr>
          <Th className={HEAD_WRAP} inner={`${DENSE} pl-4`}>
            Supplier
          </Th>
          <Th align="right" className={`${HEAD_WRAP} w-[76px]`} inner={DENSE}>
            Price per piece
          </Th>
          <Th className={`${HEAD_WRAP} w-[88px]`} inner={DENSE}>
            {m.targetHead ?? "vs target"}
          </Th>
          <Th className={`${HEAD_WRAP} w-[72px]`} inner={DENSE}>
            MOQ
          </Th>
          <Th className={`${HEAD_WRAP} w-[108px]`} inner={DENSE}>
            Lead time
          </Th>
          <Th className={`${HEAD_WRAP} w-[88px]`} inner={DENSE}>
            Valid until
          </Th>
          <Th align="right" className={`${HEAD_WRAP} w-[108px]`} inner={DENSE}>
            Total
          </Th>
          <Th className={`${HEAD_WRAP} w-[128px]`} inner={DENSE}>
            <span className="sr-only">Action</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {m.quotes.map((q, i) => (
          <Tr key={q.id} className="align-top">
            <Td className="py-3 pl-4 pr-2">
              <Link href={`/app/suppliers/${q.slug}`} prefetch={false} className={NAME}>
                {q.supplier}
              </Link>
              <span className="block pt-0.5 text-xs text-ink-3">{q.place}</span>
              {q.notes ? <span className="block max-w-prose whitespace-pre-wrap pt-1.5 text-xs text-ink-2 [overflow-wrap:anywhere]">{q.notes}</span> : null}
            </Td>
            <Td align="right" className="px-2 py-3 text-md font-semibold text-ink">
              {q.price}
            </Td>
            <Td className="px-2 py-3 text-sm">{q.versus ?? <span className="text-ink-3">No target</span>}</Td>
            <Td className="px-2 py-3 text-sm">
              {q.moq ?? <span className="text-ink-3">Not given</span>}
              {q.moqWarn ? <Caution>{q.moqWarn}</Caution> : null}
            </Td>
            <Td className="px-2 py-3 text-sm">
              {q.lead ?? <span className="text-ink-3">Not given</span>}
              {q.missWords ? <Caution chip>Misses ship-by</Caution> : null}
            </Td>
            <Td className="px-2 py-3 text-sm">{q.valid ?? <span className="text-ink-3">Not given</span>}</Td>
            <Td align="right" className="px-2 py-3 font-semibold text-ink">
              {q.total}
            </Td>
            <Td align="right" className="py-3 pl-2 pr-4">
              <QuoteAction q={q} m={m} order={order} best={i === 0} />
            </Td>
          </Tr>
        ))}
        {m.noReply.map((n) => (
          <Tr key={n.id} className="bg-subtle hover:bg-subtle">
            <Td className="py-3 pl-4 pr-2">
              <Link href={`/app/suppliers/${n.slug}`} prefetch={false} className={NAME}>
                {n.supplier}
              </Link>
              <span className="block pt-0.5 text-xs text-ink-3">{n.place}</span>
            </Td>
            <Td colSpan={7} className="px-2 py-3 text-sm text-ink-3">
              <NoReplyNote n={n} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** The pane's quotes, and the page's under 1280: name and price on one line, the terms under it. Phones see cards instead. */
function QuoteRows({ m, order, pageOnly }: { m: DetailModel; order: OrderRef; pageOnly: boolean }) {
  return (
    <ul className={cn("flex flex-col max-sm:hidden", pageOnly && "xl:hidden", TABULAR)}>
      {m.quotes.map((q, i) => (
        <li key={q.id} className="flex flex-col gap-1.5 border-b border-line p-3">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={`/app/suppliers/${q.slug}`} prefetch={false} className={cn(NAME, "w-fit")}>
                {q.supplier}
              </Link>
              <span className="text-xs text-ink-3">{q.place}</span>
            </div>
            <span className="w-[84px] shrink-0 text-right text-md font-semibold text-ink">{q.price}</span>
            <span className="w-[90px] shrink-0 pl-2 text-sm text-ink-2">{q.versus ?? ""}</span>
            <span className="w-[102px] shrink-0 pr-2 text-right text-base font-semibold text-ink">{q.total}</span>
            <span className="flex w-[104px] shrink-0 justify-end">
              <QuoteAction q={q} m={m} order={order} best={i === 0} />
            </span>
          </div>
          <p className="text-sm text-ink-2">
            {[q.moq ? `MOQ ${q.moq}` : null, q.lead ? `Lead time ${q.lead}` : null, q.valid ? `Valid until ${q.valid}` : null].filter(Boolean).join(" · ") || "No terms given"}
          </p>
          {q.moqSentence ? <Caution>{q.moqSentence}</Caution> : null}
          {q.missWords ? <Caution>Misses ship-by: {q.missWords}</Caution> : null}
          {q.notes ? <p className="whitespace-pre-wrap text-xs text-ink-2 [overflow-wrap:anywhere]">{q.notes}</p> : null}
        </li>
      ))}
      {m.noReply.map((n) => (
        <li key={n.id} className="flex items-center gap-3 border-b border-line bg-subtle p-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <Link href={`/app/suppliers/${n.slug}`} prefetch={false} className={cn(NAME, "w-fit")}>
              {n.supplier}
            </Link>
            <span className="text-xs text-ink-3">{n.place}</span>
          </div>
          <span className="max-w-[170px] text-sm text-ink-3">
            <NoReplyNote n={n} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A phone's quotes: a card per supplier, the price and its difference first. */
function QuoteCards({ m, order }: { m: DetailModel; order: OrderRef }) {
  return (
    <ul className="flex flex-col gap-3 sm:hidden">
      {m.quotes.map((q, i) => (
        <li key={q.id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
          {/* A name, as the board draws it: the supplier's record is one tap away in "Sent to" below. */}
          <h3 className="text-md font-medium text-ink">{q.supplier}</h3>
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-xl font-semibold tracking-tight text-ink">{q.price}</span>
            <span className="text-sm text-ink-2">
              per {q.perUnit}
              {q.versus ? ` · ${q.versus} target` : ""}
            </span>
          </p>
          {q.moqSentence ? (
            <p className="flex items-start gap-1.5 text-sm font-medium text-caution">
              <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-caution-icon" aria-hidden />
              {q.moqSentence}
            </p>
          ) : (
            <p className="text-sm text-ink-2">
              {[q.moq ? `MOQ ${q.moq}` : null, q.lead, q.valid ? `valid until ${q.valid}` : null].filter(Boolean).join(" · ")}
            </p>
          )}
          {q.missWords ? (
            <p className="flex items-start gap-1.5 text-sm font-medium text-caution">
              <Warning size={14} weight="fill" className="mt-0.5 shrink-0 text-caution-icon" aria-hidden />
              Misses ship-by: {q.missWords}
            </p>
          ) : null}
          {q.notes ? <p className="whitespace-pre-wrap text-sm text-ink-2 [overflow-wrap:anywhere]">{q.notes}</p> : null}
          <QuoteAction q={q} m={m} order={order} size="touch" full best={i === 0} />
        </li>
      ))}
      {m.noReply.map((n) => (
        <li key={n.id} className="flex flex-col gap-1 rounded-lg border border-line bg-subtle p-4">
          <h3 className="text-md font-medium text-ink">{n.supplier}</h3>
          <p className="text-sm text-ink-3">
            <NoReplyNote n={n} />
          </p>
        </li>
      ))}
    </ul>
  );
}

export function QuotesSection({ m, order, mode }: { m: DetailModel; order: OrderRef; mode: "pane" | "page" }) {
  const none = m.quotes.length === 0 && m.noReply.length === 0;
  return (
    <section aria-label="Quotes" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h2 className="text-lg font-semibold text-ink">{m.quotesTitle}</h2>
          {m.notReplied ? <p className="text-base text-ink-3">{m.notReplied}</p> : null}
        </div>
        {m.quotes.length > 1 ? <p className="text-sm text-ink-3 max-sm:hidden">{m.sortWords}</p> : null}
      </div>
      {none ? (
        <p className="rounded-md border border-line p-5 text-base text-ink-2">No quotes yet. They appear here, lined up against your target, as suppliers answer.</p>
      ) : (
        <>
          <div className="overflow-clip rounded-md border border-line max-sm:hidden">
            {mode === "page" ? <QuotesTable m={m} order={order} /> : null}
            <QuoteRows m={m} order={order} pageOnly={mode === "page"} />
            <p className="border-t border-line px-3 py-2 text-xs text-ink-3">{m.footnote}</p>
          </div>
          <QuoteCards m={m} order={order} />
          <p className="text-xs text-ink-3 sm:hidden">{m.footnote}</p>
        </>
      )}
    </section>
  );
}

/** The quotes could not be read: the header stands and only this part says so. */
export function QuotesError({ retryHref }: { retryHref: string }) {
  return (
    <section aria-label="Quotes" className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-ink">Quotes</h2>
      <InlineError
        retry={
          <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "secondary" })}>
            Try again
          </Link>
        }
        className="bg-subtle"
      >
        We couldn&apos;t load the quotes.
      </InlineError>
      <p className="text-base text-ink-2">The quotes took too long to load. Your RFQ is safe and suppliers can still reply.</p>
    </section>
  );
}

/** What the buyer asked: details, their message, the questions, the suppliers it went to, and the other RFQs. */
export function RequestColumn({ rfq, others, split }: { rfq: RfqDoc; others: { id: string; line: string }[]; split: boolean }) {
  const rule = "h-px shrink-0 bg-line";
  return (
    <div className={cn("flex flex-col gap-5", split && "w-details shrink-0 border-l border-line px-6 py-5 max-lg:hidden")}>
      <RequestBody rfq={rfq} others={others} rule={rule} />
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span className="text-xs text-ink-3">{children}</span>;
}

function RequestBody({ rfq, others, rule }: { rfq: RfqDoc; others: { id: string; line: string }[]; rule: string }) {
  const questions = rfq.questions ?? [];
  const hasRequest = Boolean(rfq.product_description || rfq.message || questions.length);
  return (
    <>
      <section aria-label="Your request" className="flex flex-col gap-3">
        <h2 className="text-md font-semibold text-ink">Your request</h2>
        {hasRequest ? null : <p className="text-base text-ink-2">No details were added to this RFQ.</p>}
        {rfq.product_description ? (
          <div className="flex flex-col gap-0.5">
            <Label>Details</Label>
            <ShowMore text={rfq.product_description} />
          </div>
        ) : null}
        {rfq.message ? (
          <div className="flex flex-col gap-0.5">
            <Label>Your message</Label>
            <ShowMore text={rfq.message} label="Show all" />
          </div>
        ) : null}
        {questions.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            <Label>Your questions</Label>
            {questions.map((q) => (
              <p key={q} className="text-base text-ink-2 [overflow-wrap:anywhere]">
                {q}
              </p>
            ))}
          </div>
        ) : null}
      </section>
      <div className={rule} />
      <section aria-label="Suppliers" className="flex flex-col gap-2.5">
        <h2 className="text-md font-semibold text-ink">Sent to · {rfq.targets.length === 1 ? "1 supplier" : `${rfq.targets.length} suppliers`}</h2>
        {rfq.targets.map((t) => (
          <div key={t.id} className="flex flex-col">
            <Link href={`/app/suppliers/${t.slug}`} prefetch={false} className="inline-flex w-fit rounded-sm text-base font-medium text-ink outline-none max-sm:min-h-11 max-sm:items-center hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
              {t.company_name}
            </Link>
            <span className="text-xs text-ink-3">{entityPlace(t)}</span>
          </div>
        ))}
        <p className="text-sm text-ink-3">Each got its own copy. None sees the others.</p>
      </section>
      {others.length > 0 ? (
        <>
          <div className={rule} />
          <section aria-label="Your other RFQs" className="flex flex-col gap-1.5">
            <Label>Your other RFQs</Label>
            {others.map((o) => (
              <Link key={o.id} href={`/app/rfqs/${o.id}`} prefetch={false} className="inline-flex w-fit rounded-sm text-base text-ink underline max-sm:min-h-11 max-sm:items-center decoration-line-strong decoration-1 [text-underline-position:from-font] outline-none hover:decoration-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {o.line}
              </Link>
            ))}
          </section>
        </>
      ) : null}
    </>
  );
}

function entityPlace(t: RfqDoc["targets"][number]): string {
  const kind = t.entity_type === "factory" ? "Factory" : t.entity_type === "buying_house" ? "Buying house" : "Supplier";
  return [kind, [t.city, t.district].filter(Boolean).join(", ") || null].filter(Boolean).join(" · ");
}

const ICON_LINK = "inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-ink-2 outline-none hover:bg-sunken hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export type RfqDetailProps = {
  rfq: RfqDoc;
  mode: "pane" | "page";
  today: Date;
  /** The pane's Close and the page's way back: the list, on the tab it was on. */
  closeHref: string;
  /** The order that came from this RFQ, if one exists. */
  order?: OrderRef;
  /** The buyer's other RFQs for the full page's side column. */
  others?: { id: string; line: string }[];
};

export function RfqDetail({ rfq, mode, today, closeHref, order = null, others = [] }: RfqDetailProps) {
  const page = mode === "page";
  const m = detailModel(rfq, today);
  const Title = page ? "h1" : "h2";
  const isBuyer = rfq.viewer_role === "buyer" || rfq.viewer_role === "both";
  const messages =
    isBuyer && rfq.thread_id ? (
      <Link href={`/app/messages/${rfq.thread_id}`} prefetch={false} className={buttonClass({ kind: "secondary", className: "gap-1.5 pl-2.5" })}>
        <ChatCircle size={16} className="shrink-0 text-ink-2" aria-hidden />
        Open messages
      </Link>
    ) : null;
  const messagesPhone =
    isBuyer && rfq.thread_id ? (
      <Link href={`/app/messages/${rfq.thread_id}`} prefetch={false} className={buttonClass({ kind: "secondary", size: "touch", className: "gap-1.5 pl-3" })}>
        <ChatCircle size={20} className="shrink-0 text-ink-2" aria-hidden />
        Open messages
      </Link>
    ) : null;
  return (
    <section aria-label={`RFQ: ${rfq.product_title}`} data-record-pane={page ? undefined : ""} data-detail={page ? "" : undefined} tabIndex={page ? undefined : -1} className="flex min-h-0 flex-1 flex-col bg-surface outline-none">
      {page ? (
        <div className="flex h-12 items-center px-4 sm:h-auto sm:px-6 sm:pt-4">
          <Link href={closeHref} prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 sm:min-h-6 rounded-sm text-md font-medium text-ink-2 outline-none hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:text-base">
            <ArrowLeft size={16} className="shrink-0" aria-hidden />
            <span className="sm:hidden">Quotes</span>
            <span className="max-sm:hidden">Back to RFQs</span>
          </Link>
        </div>
      ) : null}
      <header className={cn("flex flex-col gap-1 border-b border-line px-4 pb-4 sm:px-6", page ? "pt-2 sm:pt-3" : "pt-4")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Title className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere] max-sm:text-lg">{rfq.product_title}</Title>
            {page ? <RfqChip tone={m.chip.tone}>{m.chip.label}</RfqChip> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {page ? (
              <span className="max-sm:hidden">{messages}</span>
            ) : (
              <>
                <Link href={`/app/rfqs/${rfq.id}`} prefetch={false} className="rounded-sm p-1.5 text-base font-medium text-brand underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand max-sm:hidden">
                  Open full page
                </Link>
                {/* Under 1280 the pane is the kit's drawer, which draws its own close. */}
                <Link href={closeHref} scroll={false} prefetch={false} aria-label="Close" className={cn(ICON_LINK, "max-xl:hidden")}>
                  <X size={20} aria-hidden />
                </Link>
              </>
            )}
          </div>
        </div>
        <p className="text-base text-ink-2 max-sm:text-md">{page ? m.facts : m.factsPane}</p>
        <p className="text-sm text-ink-3">{page ? m.sentLine : m.sentLinePane}</p>
        {page && messagesPhone ? <div className="pt-2 sm:hidden">{messagesPhone}</div> : null}
      </header>
      <div className={cn("flex min-h-0 flex-1", page && "lg:items-stretch")}>
        <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-5 sm:px-6">
          <QuotesSection m={m} order={order} mode={mode} />
          {/* Beside the quotes from 1024 on the page; under them in the pane and on a phone. */}
          <div className={cn("flex flex-col gap-5", page && "lg:hidden")}>
            {!page ? <div className="h-px bg-line" /> : null}
            <RequestBody rfq={rfq} others={page ? others : []} rule="h-px shrink-0 bg-line" />
          </div>
        </div>
        {page ? <RequestColumn rfq={rfq} others={others} split /> : null}
      </div>
    </section>
  );
}

/** The header and request with no quotes: the quotes could not be read, and this says so in their place. */
export function RfqDetailError({ rfq, mode, closeHref, retryHref }: { rfq: Pick<RfqDoc, "product_title" | "id">; mode: "pane" | "page"; closeHref: string; retryHref: string }) {
  const page = mode === "page";
  const Title = page ? "h1" : "h2";
  return (
    <section aria-label={`RFQ: ${rfq.product_title}`} data-record-pane={page ? undefined : ""} data-detail={page ? "" : undefined} tabIndex={page ? undefined : -1} className="flex min-h-0 flex-1 flex-col bg-surface outline-none">
      <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
        <Title className="text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{rfq.product_title}</Title>
        <Link href={closeHref} scroll={false} prefetch={false} aria-label={page ? "Back to RFQs" : "Close"} className={ICON_LINK}>
          {page ? <ArrowLeft size={20} aria-hidden /> : <X size={20} aria-hidden />}
        </Link>
      </header>
      <div className="px-4 py-5 sm:px-6">
        <QuotesError retryHref={retryHref} />
      </div>
    </section>
  );
}
