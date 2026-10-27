// UFLPA checks (Paper `10 · Compliance · UFLPA checks, populated`, `11 · Alerts · UFLPA checks`):
// the saved suppliers checked against the UFLPA Entity List, as three counts and one row per
// supplier with its result. "No link found" is not a clearance and says so. Server components.
// From 768 the page says only that entries added since the last read are not checked. A phone draws
// Paper page 36 (`UflpaPhone`): the list's own read date and entry count from `sanctions_lists_read()`.

import { ArrowSquareOut, CaretDown, Clock, FileText, Globe, Scales, Warning, XCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ErrorPanel, Table, Td, Th, Tr, Unpublished, buttonClass, rowLinkClass } from "@/components/kit";
import { LinkPending } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { BackToHub, PhoneSectionHead, PhoneSubHead } from "./hub";
import { DHS_LIST_URL, UFLPA_HREF, UFLPA_WORDS, uflpaCounts, uflpaEvidence, uflpaMore, uflpaPlace, uflpaReadLine, uflpaSourceLine, uflpaSubline, type ListRead, type UflpaPayload, type UflpaRow, type UflpaStatus } from "./words";

const textLink = "rounded-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** From 768: the way back, the title and the DHS link. A phone has `UflpaPhone`. */
export function UflpaHead() {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-line px-6 py-4 max-md:hidden">
      <BackToHub />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-ink">UFLPA checks</h1>
          <p className="max-w-prose text-base text-ink-3">Your saved suppliers, checked against the UFLPA Entity List (US DHS). Entries added since our last read are not checked.</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <p className="flex items-center gap-1.5 text-sm font-medium text-caution">
            <Clock size={14} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
            Entries added since our last read are not checked
          </p>
          <a href={DHS_LIST_URL} target="_blank" rel="noopener noreferrer" className={cn(textLink, "inline-flex items-center gap-1 text-sm")}>
            Open the list on dhs.gov
            <ArrowSquareOut size={14} className="shrink-0" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}

/** The three counts as cards, from 768. */
export function UflpaStats({ uflpa }: { uflpa: UflpaPayload }) {
  const counts = uflpaCounts(uflpa);
  return (
    <div className="flex gap-3 max-md:hidden">
      {counts.map((c) => (
        <div key={c.status} className="flex flex-1 flex-col gap-0.5 rounded-lg border border-line px-4 py-3">
          <p className="text-xl font-semibold tabular-nums text-ink">{c.count}</p>
          <p className="text-sm text-ink-2">{UFLPA_WORDS[c.status].label}</p>
        </div>
      ))}
    </div>
  );
}

const TONE: Record<UflpaStatus, string> = { hit: "text-sanction font-semibold", region_flag: "text-caution font-medium", clear: "text-ink-2" };

function Result({ r }: { r: UflpaRow }) {
  const evidence = uflpaEvidence(r);
  return (
    <span className="flex flex-col gap-0.5">
      <span className={TONE[r.status]}>{UFLPA_WORDS[r.status].label}</span>
      {evidence.map((e) => (
        <span key={e} className="text-xs text-ink-3 [overflow-wrap:anywhere]">
          {e}
        </span>
      ))}
    </span>
  );
}

/** One row per supplier with its result, from 768. */
export function UflpaTable({ rows }: { rows: readonly UflpaRow[] }) {
  return (
    <div className="max-md:hidden">
      <div className="overflow-clip rounded-md border border-line">
        <Table>
          <thead>
            <tr>
              <Th>Supplier</Th>
              <Th className="w-[150px]">District</Th>
              <Th className="w-[260px]">Result</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.supplier_id} className={cn(r.status === "hit" && "bg-sanction-tint")}>
                <Td className="pl-4">
                  <Link href={`/app/suppliers/${r.supplier_slug}`} prefetch={false} className={rowLinkClass}>
                    {r.company_name}
                  </Link>
                </Td>
                <Td>{uflpaPlace(r) ?? <Unpublished />}</Td>
                <Td>
                  <Result r={r} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}

export function UflpaError({ retryHref }: { retryHref: string }) {
  return (
    <ErrorPanel
      title="We couldn't load the UFLPA checks."
      retry={
        <Link href={retryHref} prefetch={false} className={buttonClass({ kind: "primary", className: "max-md:h-input-touch" })}>
          Try again
        </Link>
      }
    >
      The check did not answer. Your saved suppliers are safe.
    </ErrorPanel>
  );
}

export function UflpaEmpty() {
  return (
    <div className="flex max-w-prose flex-col gap-3 py-8">
      <h2 className="text-lg font-semibold text-ink">No saved suppliers yet.</h2>
      <p className="text-md text-ink-2">Every supplier you save is checked against the UFLPA Entity List and listed here.</p>
      <div>
        <Link href="/app" prefetch={false} className={buttonClass({ kind: "primary", size: "lg", className: "max-md:h-input-touch max-md:w-full" })}>
          Search suppliers
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the phone (Paper page 36) */

const COUNT_ICON = { hit: XCircle, region_flag: Warning, clear: Scales } as const;
const PHONE_TONE: Record<UflpaStatus, string> = { hit: "font-semibold text-sanction", region_flag: "font-medium text-caution", clear: "text-ink-2" };
/** Rows shown before the fold; hits and flags come first (the tracker's order), so the fold only hides the rest. */
const SHOWN = 4;

function PhoneRow({ r }: { r: UflpaRow }) {
  return (
    <Link href={`/app/suppliers/${r.supplier_slug}`} className={cn("flex min-h-[60px] items-center gap-3 px-4 py-2.5 outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus", r.status === "hit" && "bg-sanction-tint")}>
      <span className="flex min-w-0 grow basis-0 flex-col">
        <span className="text-[15px]/[22px] font-medium text-ink">{r.company_name}</span>
        <span className="text-sm text-ink-3">{uflpaPlace(r) ?? "Place not published"}</span>
        {uflpaEvidence(r).map((e) => (
          <span key={e} className="text-xs text-ink-3">
            {e}
          </span>
        ))}
      </span>
      <span className={cn("text-right text-sm", PHONE_TONE[r.status])}>{UFLPA_WORDS[r.status].label}</span>
      <LinkPending />
    </Link>
  );
}

/** UFLPA checks on a phone: the head with the way back, what is matched, the three counts and every supplier. */
export function UflpaPhone({ uflpa: u, read, today }: { uflpa: UflpaPayload | null; read: ListRead | null; today: Date }) {
  const shown = u?.rows.slice(0, SHOWN) ?? [];
  const rest = u?.rows.slice(SHOWN) ?? [];
  return (
    <div className="flex flex-col md:hidden">
      <PhoneSubHead title="UFLPA checks" line={uflpaSubline(u?.total ?? null)} />
      <div className="flex flex-col px-5 pb-12 pt-2">
        <div className="flex flex-col gap-3">
          <p className="text-[15px]/[22px] text-ink-2">Each saved supplier is matched against the UFLPA Entity List, kept by the US Department of Homeland Security. We also look for Xinjiang in its record.</p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-caution">
            <Clock size={14} weight="thin" className="shrink-0 text-caution-icon" aria-hidden />
            {uflpaReadLine(read, today)}
          </p>
          <a href={DHS_LIST_URL} target="_blank" rel="noopener noreferrer" className="flex h-11 items-center gap-1.5 self-start rounded-full bg-sunken px-3.5 text-base font-medium text-ink outline-none active:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <Globe size={16} weight="thin" className="shrink-0" aria-hidden />
            Open the list on dhs.gov
          </a>
        </div>
        {u === null ? (
          <div className="pt-6">
            <UflpaError retryHref={UFLPA_HREF} />
          </div>
        ) : u.rows.length === 0 ? (
          <UflpaEmpty />
        ) : (
          <>
            <PhoneSectionHead title="Result" aside="Most serious first" />
            <dl className="flex flex-col divide-y divide-line overflow-clip rounded-[10px] border border-line">
              {uflpaCounts(u).map((c) => {
                const G = COUNT_ICON[c.status];
                return (
                  <div key={c.status} className="flex min-h-14 items-center gap-2.5 px-4 py-3">
                    <G size={18} weight="thin" className={cn("shrink-0", c.count > 0 ? "text-ink-2" : "text-ink-3")} aria-hidden />
                    <div className="flex grow basis-0 flex-col">
                      <dt className="text-base font-medium text-ink">{UFLPA_WORDS[c.status].label}</dt>
                      <dd className="text-xs text-ink-3">{UFLPA_WORDS[c.status].sub}</dd>
                    </div>
                    <dd className={cn("text-xl font-medium tabular-nums", c.count > 0 ? "text-ink" : "text-ink-3")}>{c.count}</dd>
                  </div>
                );
              })}
            </dl>
            <PhoneSectionHead title="Suppliers" count={u.rows.length} aside={u.hits + u.flags > 0 ? "Most serious first" : "A to Z"} />
            <div className="flex flex-col divide-y divide-line overflow-clip rounded-[10px] border border-line">
              {shown.map((r) => (
                <PhoneRow key={r.supplier_id} r={r} />
              ))}
              {rest.length > 0 ? (
                <details className="group">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between bg-subtle px-4 py-3 text-sm text-ink-2 outline-none active:bg-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
                    {uflpaMore(rest)}
                    <CaretDown size={16} weight="thin" className="shrink-0 text-ink-3 group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="flex flex-col divide-y divide-line border-t border-line">
                    {rest.map((r) => (
                      <PhoneRow key={r.supplier_id} r={r} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 pt-4 text-xs text-ink-3">
              <FileText size={14} weight="thin" className="shrink-0" aria-hidden />
              {uflpaSourceLine(read, today)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
