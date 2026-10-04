// UFLPA checks (Paper `10 · Compliance · UFLPA checks, populated`, `11 · Alerts · UFLPA checks`):
// the saved suppliers checked against the UFLPA Entity List, as three counts and one row per
// supplier with its result. "No link found" is not a clearance and says so. Server components.
// Paper's "160 entries · our copy from 14 May 2026" is not here: the tracker carries neither, so the
// page says only that entries added since the last read are not checked, and links to the list.

import { ArrowSquareOut, Clock } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ErrorPanel, Table, Td, Th, Tr, Unpublished, buttonClass, rowLinkClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { BackToHub } from "./hub";
import { DHS_LIST_URL, UFLPA_WORDS, uflpaCounts, uflpaEvidence, uflpaPlace, type UflpaPayload, type UflpaRow, type UflpaStatus } from "./words";

const textLink = "rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] outline-none hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export function UflpaHead({ saved }: { saved: number | null }) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-line px-6 py-4 max-md:border-b-0 max-md:px-4 max-md:pb-2 max-md:pt-1">
      <BackToHub />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-ink max-md:hidden">UFLPA checks</h1>
          <p className="max-w-prose text-base text-ink-3 max-md:hidden">Your saved suppliers, checked against the UFLPA Entity List (US DHS). Entries added since our last read are not checked.</p>
          <p className="text-base text-ink-3 md:hidden">
            {saved === null ? "Your saved suppliers" : `${saved} saved ${saved === 1 ? "supplier" : "suppliers"}`} against the UFLPA Entity List (US DHS)
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 max-md:items-start">
          <p className="flex items-center gap-1.5 text-sm font-medium text-caution">
            <Clock size={14} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
            Entries added since our last read are not checked
          </p>
          <a href={DHS_LIST_URL} target="_blank" rel="noopener noreferrer" className={cn(textLink, "inline-flex items-center gap-1 text-sm max-md:min-h-11")}>
            Open the list on dhs.gov
            <ArrowSquareOut size={14} className="shrink-0" aria-hidden />
          </a>
        </div>
      </div>
    </header>
  );
}

/** The three counts: cards from 768, rows with their meaning under the label on a phone. */
export function UflpaStats({ uflpa }: { uflpa: UflpaPayload }) {
  const counts = uflpaCounts(uflpa);
  return (
    <>
      <div className="flex gap-3 max-md:hidden">
        {counts.map((c) => (
          <div key={c.status} className="flex flex-1 flex-col gap-0.5 rounded-lg border border-line px-4 py-3">
            <p className="text-xl font-semibold tabular-nums text-ink">{c.count}</p>
            <p className="text-sm text-ink-2">{UFLPA_WORDS[c.status].label}</p>
          </div>
        ))}
      </div>
      <dl className="flex flex-col border-y border-line md:hidden">
        {counts.map((c) => (
          <div key={c.status} className="flex min-h-14 items-center justify-between gap-3 border-b border-line px-4 py-2 last:border-b-0">
            <div className="flex flex-col">
              <dt className="text-md font-medium text-ink">{UFLPA_WORDS[c.status].label}</dt>
              <dd className="text-sm text-ink-3">{UFLPA_WORDS[c.status].sub}</dd>
            </div>
            <p className="text-lg font-semibold tabular-nums text-ink">{c.count}</p>
          </div>
        ))}
      </dl>
    </>
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

export function UflpaTable({ rows }: { rows: readonly UflpaRow[] }) {
  return (
    <>
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
      <ul className="md:hidden">
        {rows.map((r) => (
          <li key={r.supplier_id} className={cn("border-b border-line", r.status === "hit" && "bg-sanction-tint")}>
            <Link href={`/app/suppliers/${r.supplier_slug}`} prefetch={false} className="flex min-h-11 flex-col gap-1 px-4 py-3">
              <span className="text-md font-medium text-ink">{r.company_name}</span>
              <span className="text-sm text-ink-3">{uflpaPlace(r) ?? "Place not published"}</span>
              <span className="text-base">
                <Result r={r} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
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
