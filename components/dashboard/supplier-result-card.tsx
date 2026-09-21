// SupplierResultCard (REZ-A, artifact ResultsList README), band for band:
// identity (initials tile on the top source's rank, name that wraps at any
// length, the source-mark row, the meta line with a mark per fact, actions),
// highlight chips in status hues, four hairline tiles + the HS photo strip,
// and the V2 why-matched line. Selected: filled checkbox + 3px brand inset
// rule. Sanctioned: 4px sanction bar, a notice under the meta, the badge first
// in the chip row, Send RFQ disabled — nothing in the layout can hide it.

import type { SupplierCardModel, FactWithMark, TileModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { Chip, Chips } from "./chips";
import { Button, Checkbox, V2Tag } from "./controls";
import { Icon } from "./icons";
import { LogoTile, SourceMark, SourceMarks } from "./marks";
import { PhotoStrip } from "./photo-tiles";
import { SaveRecordButton } from "./save-record-button";
import { Code, Title } from "./type";

/** `.meta`: facts separated by middle dots, each followed by its 16px mark. */
export function MetaLine({ facts, className }: { facts: readonly FactWithMark[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-y-1 text-base text-ink-muted", className)}>
      {facts.map((f, i) => (
        <span
          key={`${f.text}-${i}`}
          className={cn(
            "inline-flex items-center gap-1.5",
            i > 0 && "before:mx-2.5 before:text-ink-subtle before:content-['·']",
            f.quiet && "text-quiet-ink",
          )}
        >
          {f.code ? <Code>{f.text}</Code> : f.text}
          {f.mark ? <SourceMark mark={f.mark} sm /> : null}
        </span>
      ))}
    </div>
  );
}

function Tile({ tile }: { tile: TileModel }) {
  return (
    <div className="flex min-h-[82px] min-w-0 flex-col gap-px rounded-sm border border-line-subtle px-3 py-2.5">
      <span className="whitespace-nowrap text-sm font-medium text-ink-muted">{tile.label}</span>
      <span className={cn("whitespace-nowrap text-title font-medium text-ink-strong", tile.value === null && "font-normal text-quiet-ink")}>
        {/* An em dash, never 0: the sub-line below often says the read failed
            or that no register holds one, and "Export lines 0" over "EPB could
            not be read" states a fact the read does not support. */}
        {tile.value ?? "—"}
      </span>
      {tile.sub ? (
        // The sub-line wraps rather than ellipsising: it carries facts — which
        // certificates need a look, which registers were checked — and a fact
        // cut off mid-word is a fact the buyer does not have. The tile grows;
        // the grid row equalises.
        <span className="flex min-w-0 items-start gap-1 text-sm text-ink-subtle">
          {tile.href ? (
            <a href={tile.href} className="inline-flex min-w-0 items-start gap-0.5 text-brand-ink">
              <span className="[overflow-wrap:anywhere]">{tile.sub}</span> <Icon name="chev-r" small className="mt-0.5 shrink-0" />
            </a>
          ) : (
            <span className="[overflow-wrap:anywhere]">{tile.sub}</span>
          )}
        </span>
      ) : null}
    </div>
  );
}

export function SanctionLine({ sample, href, className }: { sample?: boolean; href?: string; className?: string }) {
  return (
    <div data-sanction-visible="true" className={cn("flex items-center gap-2 text-sm text-sanction-ink", className)}>
      <Icon name="warn" />
      <span>
        Sanctioned{sample ? " · sample record" : ""}. Matched on a sanctions screen; RFQs cannot be sent.
        {href ? (
          <>
            {" "}
            <a href={href} className="text-sanction-ink underline">
              Open the record
            </a>
          </>
        ) : null}
      </span>
    </div>
  );
}

export function SupplierResultCard({ card }: { card: SupplierCardModel }) {
  const recordHref = `/app/suppliers/${card.slug}`;
  return (
    <article
      aria-label={card.name}
      data-sanctioned={card.sanctioned ? "true" : undefined}
      className={cn(
        "relative flex gap-3 border-b border-line-subtle p-5 last-of-type:border-b-0",
        card.selected && "shadow-[inset_3px_0_0_rgb(var(--ds-brand))]",
        card.sanctioned && "before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-sanction before:content-['']",
      )}
    >
      <Checkbox on={card.selected} label={`Select ${card.name}`} className="mt-4" />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-start gap-3">
          <LogoTile initials={card.initials} tier={card.topTier} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Title>{card.name}</Title>
              <SourceMarks marks={card.marks} />
            </div>
            <MetaLine facts={card.meta} />
            {card.sanctioned ? <SanctionLine sample={card.sanctionSample} href={recordHref} /> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-2">
            {card.supplierId ? (
              <SaveRecordButton supplierId={card.supplierId} saved={Boolean(card.saved)} />
            ) : (
              <Button>
                <Icon name="bookmark" /> Save
              </Button>
            )}
            <Button href={`/app/suppliers/${card.slug}`}>Open record</Button>
            <Button variant="primary" href={card.sanctioned ? undefined : (card.rfqHref ?? undefined)} disabled={card.sanctioned}>
              <Icon name="send" /> Send RFQ
            </Button>
          </div>
        </div>
        <Chips more={card.moreChips}>
          {card.sanctioned ? (
            <Chip tone="sanction" icon="warn">
              Sanctioned{card.sanctionSample ? " · sample" : ""}
            </Chip>
          ) : null}
          {card.chips.map((c) => (
            <Chip key={c.label} tone={c.tone} icon={c.icon}>
              {c.label}
            </Chip>
          ))}
        </Chips>
        <div className="flex items-start gap-4">
          <div className="grid w-[352px] shrink-0 grid-cols-2 gap-2">
            {card.tiles.map((t) => (
              <Tile key={t.label} tile={t} />
            ))}
          </div>
          <PhotoStrip tiles={card.photos} totalLines={card.totalLines} registerChecked="EPB" readDate={card.epbReadDate} unknown={card.linesUnknown} />
        </div>
        {card.why && card.why.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-smart">
            <V2Tag />
            <span className="font-medium">Why matched</span>
            {card.why.map((w, i) => (
              <span key={w} className={cn("inline-flex items-center gap-1", i > 0 && "before:mr-1 before:opacity-60 before:content-['·']")}>
                <Icon name="check" small /> {w}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
