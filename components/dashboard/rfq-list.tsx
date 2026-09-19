// RFQList (REZ-A, handoff §3.7): the page heading with live counts, search,
// Fields, Sort, + New RFQ; status chips with counts; a 36px-row table — RFQ
// name with the HS code in `code`, supplier with its tier tile, quantity
// tabular and right-aligned, status badge, sent and ship-by dates, action —
// and the toast. Almost every buyer sees the empty state at launch: it sells
// the feature, it does not apologise.

import type { RfqListModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { Badge, Chip } from "./chips";
import { Button, Checkbox } from "./controls";
import { Icon } from "./icons";
import { LogoTile } from "./marks";
import { Panel } from "./results-panel";
import { Td, Th } from "./results-table";
import { Caption, Code, Heading } from "./type";

export const RFQ_EMPTY_COPY = "Your first RFQ lands here. Suppliers answer inside the platform, with the record attached.";
/**
 * `rfq_list` failed. "You have no RFQs yet" is a fact about the account, and a
 * failed read does not establish it — the empty state that sells the feature
 * must never stand in for an unread list.
 */
export const RFQ_ERROR_COPY = "Your RFQs could not be read just now. Nothing has been lost — try again in a moment.";

const COLS = [44, 300, 220, 110, 180, 110, 110] as const;

export function RfqList({ model }: { model: RfqListModel }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <Heading level="h" as="h1" className="flex-1">
          RFQs{" "}
          {/* A failed read has no counts. "0 sent · 0 quotes" is a fact about
              the account that an unread list does not establish — the same
              defect the empty state carried, one line higher up the page. */}
          {model.sent !== null && model.quotes !== null ? (
            <span className="ml-1.5 font-mono text-sm font-normal text-ink-subtle">
              {model.sent} sent · {model.quotes} {model.quotes === 1 ? "quote" : "quotes"}
            </span>
          ) : (
            <span className="ml-1.5 text-sm font-normal text-ink-subtle">count not read</span>
          )}
        </Heading>
        <div
          role="search"
          className="flex h-control w-[280px] items-center gap-2 rounded-sm border border-line-strong bg-surface px-2.5 text-sm text-ink-subtle"
        >
          <Icon name="search" /> Search RFQs
        </div>
        <Button>
          <Icon name="funnel" /> Fields
        </Button>
        <Button>
          <Icon name="sort" /> Newest <Icon name="caret" small />
        </Button>
        <Button variant="primary">
          <Icon name="plus" /> New RFQ
        </Button>
      </div>
      <div className="flex gap-2">
        {model.chips.map((c) => (
          <Chip key={c.label} tone={c.on ? "on" : "neutral"}>
            {c.label}
            {c.count !== null ? <Code className="text-xs">{c.count}</Code> : null}
          </Chip>
        ))}
      </div>
      <Panel>
        {model.error ? (
          <div role="status" className="flex flex-col items-start gap-3 px-6 py-10">
            <p className="m-0 max-w-prose text-lg text-ink">{RFQ_ERROR_COPY}</p>
          </div>
        ) : model.rows.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-6 py-10">
            <p className="m-0 max-w-prose text-lg text-ink">{RFQ_EMPTY_COPY}</p>
            <Button variant="primary">
              <Icon name="search" /> Find suppliers
            </Button>
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              {COLS.map((w, i) => (
                <col key={i} style={{ width: w }} />
              ))}
              <col />
            </colgroup>
            <thead>
              <tr>
                <Th srLabel="Select" />
                <Th>RFQ</Th>
                <Th>Supplier</Th>
                <Th className="text-right">Quantity</Th>
                <Th>Status</Th>
                <Th>Sent</Th>
                <Th>Ship by</Th>
                <Th srLabel="Actions" />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {model.rows.map((r) => (
                <tr key={r.id} aria-label={r.name} data-sanctioned={r.sanctioned ? "true" : undefined}>
                  <Td>
                    <Checkbox label={`Select ${r.name}`} />
                  </Td>
                  <Td className={cn(r.sanctioned && "shadow-[inset_4px_0_0_rgb(var(--ds-sanction))]")}>
                    <div className="font-medium text-ink-strong [overflow-wrap:anywhere]">
                      {r.name}
                      {r.hs ? (
                        <span className="font-normal text-ink-muted before:mx-1.5 before:text-ink-subtle before:content-['·']">
                          <Code>{r.hs}</Code>
                        </span>
                      ) : null}
                    </div>
                    {/* A sanction may not be hidden by layout, on any surface (spec §2). */}
                    {r.sanctioned ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-sanction-ink">
                        <Icon name="warn" small /> Sanctioned{r.sanctionSample ? " · sample" : ""} — RFQs cannot be sent
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2.5">
                      {r.supplierName && r.supplierInitials && r.supplierTier ? (
                        <>
                          <LogoTile initials={r.supplierInitials} tier={r.supplierTier} size="sm" />
                          <span className="[overflow-wrap:anywhere]">{r.supplierName}</span>
                        </>
                      ) : (
                        <span className="text-ink-muted">
                          {r.supplierCount} {r.supplierCount === 1 ? "supplier" : "suppliers"}
                        </span>
                      )}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{r.quantity}</Td>
                  <Td>
                    <Badge tone={r.status.tone} icon={r.status.icon}>
                      {r.status.label}
                    </Badge>
                  </Td>
                  <Td>{r.sent ?? <span className="text-quiet-ink">—</span>}</Td>
                  <Td>{r.shipBy ?? <span className="text-quiet-ink">—</span>}</Td>
                  <Td>
                    <span className="flex w-full justify-end">
                      <Button className="h-7 px-2.5 text-xs">{r.action}</Button>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex items-center gap-3 border-t border-line-subtle px-5 py-3">
          <Caption>{model.footer}</Caption>
        </div>
      </Panel>
      {model.toast ? <Toast text={model.toast.text} href={model.toast.href} /> : null}
    </>
  );
}

/** `.toast`: `surface-inverse` with the signal dot. */
export function Toast({ text, href, className }: { text: string; href: string | null; className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "absolute bottom-6 left-1/2 inline-flex -translate-x-1/2 items-center gap-2.5 whitespace-nowrap rounded-md bg-surface-inverse px-3.5 py-2.5 text-sm font-medium text-ink-inverse shadow-lg",
        className,
      )}
    >
      <i aria-hidden className="inline-block size-2 rounded-full bg-signal shadow-bloom" />
      {text}
      {href ? (
        <a href={href} className="text-brand-ink-inverse">
          Open
        </a>
      ) : null}
    </div>
  );
}
