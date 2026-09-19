// ResultsTable (REZ-A, artifact ResultsTable README): 36px `row-dense` rows in
// 13px `table` text, header on `surface-sunken` in `eyebrow` mono. A long name
// wraps and grows its row rather than truncating. Sanctioned: the 4px inset
// and a `sanction-ink` line under the name, Send RFQ disabled. Selected: the
// filled checkbox and a 3px brand inset — no tinted row.

import { certTableLabel, formatCount } from "@/lib/dashboard/facts";
import type { TableRowModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { Chip, Chips } from "./chips";
import { Button, Checkbox } from "./controls";
import { Icon } from "./icons";
import { LogoTile, SourceMarks } from "./marks";
import { PhotoThumbs } from "./photo-tiles";

const COLS = [44, 310, 128, 215, 135, 88, 74] as const;

export function Th({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-line-subtle bg-surface-sunken px-2.5 py-2 text-left font-mono text-eyebrow font-medium uppercase text-ink-subtle first:pl-5 last:pr-5",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <td className={cn("h-row-dense border-b border-line-subtle px-2.5 py-1 align-middle first:pl-5 last:pr-5", className)}>{children}</td>;
}

export function ResultsTable({ rows }: { rows: readonly TableRowModel[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup>
        {COLS.map((w, i) => (
          <col key={i} style={{ width: w }} />
        ))}
        <col />
      </colgroup>
      <thead>
        <tr>
          <Th />
          <Th>Supplier</Th>
          <Th>Sources</Th>
          <Th>Certificates</Th>
          <Th>Export lines</Th>
          <Th>Type</Th>
          <Th className="text-right">Workers</Th>
          <Th />
        </tr>
      </thead>
      <tbody className="[&>tr:last-child>td]:border-b-0">
        {rows.map((r) => (
          <tr key={r.slug} aria-label={r.name} data-sanctioned={r.sanctioned ? "true" : undefined}>
            <Td
              className={cn(
                r.selected && "shadow-[inset_3px_0_0_rgb(var(--ds-brand))]",
                r.sanctioned && "shadow-[inset_4px_0_0_rgb(var(--ds-sanction))]",
              )}
            >
              <Checkbox on={r.selected} label={`Select ${r.name}`} />
            </Td>
            <Td>
              <div className="flex items-center gap-2.5">
                <LogoTile initials={r.initials} tier={r.topTier} size="sm" />
                <div className="min-w-0">
                  <div className="font-medium text-ink-strong [overflow-wrap:anywhere]">
                    {r.name}
                    {r.place ? (
                      <span className="font-normal text-ink-muted before:mx-1.5 before:text-ink-subtle before:content-['·']">{r.place}</span>
                    ) : null}
                  </div>
                  {r.sanctioned ? (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-sanction-ink">
                      <Icon name="warn" small /> Sanctioned{r.sanctionSample ? " · sample" : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            </Td>
            <Td>
              <span className="inline-flex items-center gap-2">
                <span className="min-w-4 text-right font-mono text-sm font-medium text-ink-strong">{r.sourceCount}</span>
                <SourceMarks marks={r.marks.slice(0, 4)} caption="none" sm className="flex-nowrap gap-0.5" />
                {r.marks.length > 4 ? <span className="text-xs text-ink-subtle">+{r.marks.length - 4}</span> : null}
              </span>
            </Td>
            <Td>
              {r.certs.length > 0 ? (
                <Chips nowrap more={Math.max(0, r.certs.length - 2)}>
                  {r.certs.slice(0, 2).map((c) => (
                    <Chip key={`${c.kind}-${c.number ?? ""}`} compact tone={c.state === "valid" ? "positive" : c.state === "no-expiry" ? "neutral" : "caution"}>
                      {certTableLabel(c)}
                    </Chip>
                  ))}
                </Chips>
              ) : (
                <span className="text-quiet-ink">— {r.certsEmptyReason ?? "none on file"}</span>
              )}
            </Td>
            <Td>
              {r.photos.length > 0 ? (
                <PhotoThumbs tiles={r.photos} totalLines={r.totalLines} />
              ) : (
                <span className="text-quiet-ink">— {r.linesEmptyReason ?? "not on EPB list"}</span>
              )}
            </Td>
            <Td className="whitespace-nowrap">{r.type}</Td>
            <Td className="text-right tabular-nums">{r.workers === null ? <span className="text-quiet-ink">—</span> : formatCount(r.workers)}</Td>
            <Td>
              <span className="flex w-full justify-end gap-1.5">
                <Button icon aria-label="Save" className="h-7 w-7">
                  <Icon name="bookmark" />
                </Button>
                <Button variant="primary" disabled={r.sanctioned} className="h-7 px-2.5 text-xs">
                  <Icon name="send" /> Send RFQ
                </Button>
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
