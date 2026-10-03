// Quote comparison (`03 Patterns · 8`, a sample state until real quotes exist: the RFQ and the
// supplier names are real, every price, MOQ and lead time is a sample figure and says so).
// Desktop: a table, best against target first, no-reply rows stay. Phone: one card per
// supplier, the price and its difference first; Accept opens a confirm sheet that repeats
// price, quantity and total. Server-safe: the actions come in as nodes.

import { Warning } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { Table, Td, Th, TableFrame, Tr } from "@/components/kit";
import { cn } from "@/lib/utils";
import { moqWarning, usd, vsTarget } from "./words";

export type Quote =
  | {
      status: "quoted";
      supplier: string;
      price: number;
      moq: number;
      leadDays: number;
      /** "30 Oct 2026" */
      validUntil: string;
      /** The Accept quote button; the best one is primary, the rest secondary. */
      action: ReactNode;
    }
  | { status: "no-reply"; supplier: string; /** "18 Jul 2026" */ sentOn: string; /** Send reminder */ action?: ReactNode };

type Quoted = Extract<Quote, { status: "quoted" }>;
const isQuoted = (q: Quote): q is Quoted => q.status === "quoted";

/** Best against target first (the cheapest); no-reply rows stay, after the quotes. */
export function sortQuotes(quotes: Quote[]): Quote[] {
  const quoted = quotes.filter(isQuoted).sort((a, b) => a.price - b.price);
  return [...quoted, ...quotes.filter((q) => !isQuoted(q))];
}

/** The mark every sample figure carries. */
export function SampleLabel({ children = "Sample figures", className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-block self-start rounded-sm border border-dashed border-line-strong px-1.5 py-0.5 text-xs font-semibold text-ink-2", className)}>{children}</span>
  );
}

export function QuoteComparison({
  title,
  quantity,
  shipBy,
  target,
  quotes,
  sample = false,
}: {
  title: string;
  quantity: number;
  shipBy: string;
  target: number;
  quotes: Quote[];
  sample?: boolean;
}) {
  const rows = sortQuotes(quotes);
  const replied = rows.filter(isQuoted).length;
  return (
    <section aria-label="Quotes" className="flex flex-col gap-3 sm:gap-4">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="text-md font-semibold text-ink sm:text-lg">{title}</h3>
        <p className="text-sm text-ink-3 sm:text-base sm:text-ink-2">
          <span className="sm:hidden">
            {quantity.toLocaleString("en-GB")} pieces · target {usd(target)} · {replied} {replied === 1 ? "quote" : "quotes"}
            {rows.length > replied ? `, ${rows.length - replied} no reply` : ""}
          </span>
          <span className="max-sm:hidden">
            {quantity.toLocaleString("en-GB")} pieces · ship by {shipBy} · target {usd(target)} per piece
          </span>
        </p>
        {sample ? <SampleLabel>Sample target</SampleLabel> : null}
      </header>

      <TableFrame className="max-sm:hidden">
        {sample ? (
          <p className="flex h-8 items-center border-b border-dashed border-line-strong bg-subtle px-4 text-xs font-semibold text-ink-2">
            Sample figures: prices, MOQs, lead times and dates below are not real quotes.
          </p>
        ) : null}
        <Table>
          <thead>
            <tr>
              <Th className="w-[260px]">Supplier</Th>
              <Th align="right">FOB per piece</Th>
              <Th>vs target</Th>
              <Th>MOQ</Th>
              <Th align="right">Lead time</Th>
              <Th>Valid until</Th>
              <Th>
                <span className="sr-only">Action</span>
              </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) =>
              !isQuoted(q) ? (
                <Tr key={q.supplier}>
                  <Td className="font-medium text-ink">{q.supplier}</Td>
                  <Td colSpan={5} className="text-ink-3">
                    No reply yet · RFQ sent {q.sentOn}
                  </Td>
                  <Td align="right">{q.action}</Td>
                </Tr>
              ) : (
                <Tr key={q.supplier}>
                  <Td className="font-medium text-ink">{q.supplier}</Td>
                  <Td align="right" className="font-semibold text-ink">
                    {usd(q.price)}
                  </Td>
                  <Td>{vsTarget(q.price, target)}</Td>
                  <Td>
                    {moqWarning(q.moq, quantity) ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-caution">
                        <Warning size={14} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
                        {moqWarning(q.moq, quantity)}
                      </span>
                    ) : (
                      `${q.moq.toLocaleString("en-GB")} pieces`
                    )}
                  </Td>
                  <Td align="right">{q.leadDays} days</Td>
                  <Td>{q.validUntil}</Td>
                  <Td align="right">{q.action}</Td>
                </Tr>
              ),
            )}
          </tbody>
        </Table>
      </TableFrame>

      <div className="flex flex-col gap-3 sm:hidden">
        {sample ? <SampleLabel /> : null}
        {rows.map((q) => (
          <article key={q.supplier} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4">
            <h4 className="text-md font-medium text-ink">{q.supplier}</h4>
            {!isQuoted(q) ? (
              <>
                <p className="text-sm text-ink-3">No reply yet · RFQ sent {q.sentOn}</p>
                {q.action}
              </>
            ) : (
              <>
                <p className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold tracking-tight text-ink">{usd(q.price)}</span>
                  <span className="text-sm text-ink-2">per piece · {vsTarget(q.price, target).replace(/^On target$/, "on target").replace(/ (under|over)$/, " $1 target")}</span>
                </p>
                {moqWarning(q.moq, quantity) ? (
                  <p className="flex items-center gap-1.5 text-sm font-medium text-caution">
                    <Warning size={14} weight="fill" className="shrink-0 text-caution-icon" aria-hidden />
                    MOQ {q.moq.toLocaleString("en-GB")} pieces, above your {quantity.toLocaleString("en-GB")}
                  </p>
                ) : (
                  <p className="text-sm text-ink-2">
                    MOQ {q.moq.toLocaleString("en-GB")} pieces · {q.leadDays} days · valid until {q.validUntil}
                  </p>
                )}
                {q.action}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

/** What the confirm sheet repeats before Accept: price, quantity, total, lead time. */
export function AcceptSummary({ price, quantity, leadDays, sample }: { price: number; quantity: number; leadDays: number; sample?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-subtle p-3 text-md">
      <p className="text-ink">
        {usd(price)} per piece · {quantity.toLocaleString("en-GB")} pieces
      </p>
      <p className="text-ink">{usd(Math.round(price * quantity * 100) / 100)} in total</p>
      <p className="text-ink-2">
        {leadDays} days lead time{sample ? " · sample figures" : ""}
      </p>
    </div>
  );
}
