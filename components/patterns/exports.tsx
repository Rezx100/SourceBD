// Exports (`03 Patterns · 14`, v2, a sample state): what a factory shipped, from Bangladesh
// customs export records. Totals first, each saying how many rows it comes from; then the rows:
// date, product in plain words with its HS code in mono, pieces, FOB per piece and value, buyer
// as filed, destination, sea or air. Row detail is the customs house and the weights. Never a
// notify party, a shipper address, a guessed brand or a score. Real rows live only in Paper
// (private); none go in this repo. Server-safe.

import { Table, TableFrame, TableScroll, Td, Th, Tr } from "@/components/kit";
import { cn } from "@/lib/utils";
import { usd } from "./words";

export type ExportStat = { label: string; value: string; note: string };

/** The five totals. Pass them in the order drawn: pieces, FOB range, destinations, buyers, latest. */
export function ExportsSummary({ stats, className }: { stats: ExportStat[]; className?: string }) {
  return (
    <dl className={cn("flex flex-col rounded-lg border border-line sm:flex-row", className)}>
      {stats.map((s) => (
        <div key={s.label} className="flex flex-1 flex-col gap-1 border-b border-line p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
          <dt className="text-xs font-medium text-ink-3">{s.label}</dt>
          <dd className="text-lg font-semibold text-ink">{s.value}</dd>
          <dd className="text-xs text-ink-3">{s.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The freshness line every view carries. */
export function ExportsFreshness({ latest }: { latest: string }) {
  return <p className="text-sm text-ink-2">Bangladesh customs export records, via Volza · latest {latest}</p>;
}

export type ExportRow = {
  date: string;
  product: string;
  hs: string;
  pieces: number;
  fobPerPiece: number;
  fobValue: number;
  buyer: string;
  destination: string;
  mode: "Sea" | "Air";
  /** "Left from Chittagong customs house", "Net weight 6,625.27 kg" */
  detail?: string[];
};

export function ExportsTable({ rows, className }: { rows: ExportRow[]; className?: string }) {
  return (
    <TableFrame className={className}>
      <TableScroll>
        <Table>
          <thead>
            <tr>
              <Th className="w-[100px]">Date</Th>
              <Th>Product · HS code</Th>
              <Th align="right">Pieces</Th>
              <Th align="right">FOB per piece</Th>
              <Th align="right">FOB value</Th>
              <Th>Buyer</Th>
              <Th>Destination</Th>
              <Th>Mode</Th>
            </tr>
          </thead>
          <tbody>
            {rows.flatMap((r, i) => [
              <Tr key={`${r.date}-${i}`}>
                <Td className="whitespace-nowrap text-ink">{r.date}</Td>
                <Td>
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-ink">{r.product}</span>
                    <span className="font-mono text-sm text-ink-2">{r.hs}</span>
                  </span>
                </Td>
                <Td align="right" className="text-ink">
                  {r.pieces.toLocaleString("en-GB")}
                </Td>
                <Td align="right" className="text-ink">
                  {usd(r.fobPerPiece)}
                </Td>
                <Td align="right" className="text-ink">
                  {usd(r.fobValue)}
                </Td>
                <Td className="text-ink">{r.buyer}</Td>
                <Td className="text-ink">{r.destination}</Td>
                <Td className="text-ink">{r.mode}</Td>
              </Tr>,
              ...(r.detail?.length
                ? [
                    <tr key={`${r.date}-${i}-detail`} className="bg-brand-wash">
                      <td colSpan={8} className="border-b border-line px-3 pb-3 pl-[132px] text-sm text-ink-2">
                        <span className="flex flex-wrap gap-x-8">{r.detail.map((d) => <span key={d}>{d}</span>)}</span>
                      </td>
                    </tr>,
                  ]
                : []),
            ])}
          </tbody>
        </Table>
      </TableScroll>
    </TableFrame>
  );
}
