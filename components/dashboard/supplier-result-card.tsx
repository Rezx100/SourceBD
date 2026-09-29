// SupplierResultCard (REZ-A, artifact ResultsList README), band for band:
// identity (initials tile on the top source's rank, name that wraps at any
// length, the source-mark row, the meta line with a mark per fact, actions),
// highlight chips in status hues, four hairline tiles + the HS photo strip,
// and the V2 why-matched line. Selected: filled checkbox + 3px brand inset
// rule. Sanctioned: 4px sanction bar, a notice under the meta, the badge first
// in the chip row, Send RFQ disabled — nothing in the layout can hide it.
//
// Client (REZ-B): the checkbox reads and writes the shared selection context
// (`./selection`), which only exists inside a `SelectionProvider`. Outside
// one — the `/dev/ds` gallery — it falls back to the static `card.selected`
// prop and the checkbox stays inert, exactly as REZ-A shipped it.

"use client";

import { splitQualifier } from "@/lib/dashboard/facts";
import type { SupplierCardModel, FactWithMark, TileModel } from "@/lib/dashboard/models";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Chip, Chips } from "./chips";
import { Button, Checkbox, V2Tag } from "./controls";
import { Icon } from "./icons";
import { LogoTile, SourceMark, SourceMarks } from "./marks";
import { PhotoStrip } from "./photo-tiles";
import { SbIcon } from "./sb-icons";
import { SaveRecordButton } from "./save-record-button";
import { useSelection } from "./selection";
import { Code, Title } from "./type";

/**
 * `.meta`: facts separated by middle dots, each followed by its 16px mark.
 * `inRow` names the sources a row of marks beside the line already draws:
 * their marks are left off the facts, so the record's head says each source
 * once ("RSC, then RSC again", founder's video, 29 Sep 2026). A fact whose
 * source is not in that row (a worker figure read from a building's RSC
 * inspection) keeps its mark, or nothing in the head would say where it came
 * from.
 */
export function MetaLine({ facts, inRow, className }: { facts: readonly FactWithMark[]; inRow?: ReadonlySet<string>; className?: string }) {
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
          {/* The fact's icon, slate, the way a place card or a company header
              shows it (founder, 29 Sep 2026). */}
          {f.icon ? <SbIcon name={f.icon} className="text-accent" /> : null}
          {f.code ? <Code>{f.text}</Code> : f.text}
          {f.mark && !inRow?.has(f.mark.code) ? <SourceMark mark={f.mark} sm /> : null}
        </span>
      ))}
    </div>
  );
}

function Tile({ tile }: { tile: TileModel }) {
  return (
    <div className="flex min-h-[82px] min-w-0 flex-col gap-px rounded-sm bg-canvas px-3 py-2.5">
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
            // A link into this record's sheet tabs (§3.1). In the results it
            // carries the search, so it must be a client navigation like every
            // other record link, or the sub-line loses what the card kept. It
            // keeps Next's default scroll: the href ends in #section, and
            // `scroll={false}` also switches off the jump to that section, so
            // "12 lines ›" opened the sheet at Overview.
            <Link prefetch={false} href={tile.href} className="inline-flex min-w-0 items-start gap-0.5 text-brand-ink">
              <span className="[overflow-wrap:anywhere]">{tile.sub}</span> <Icon name="chev-r" small className="mt-0.5 shrink-0" />
            </Link>
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
            <Link prefetch={false} scroll={false} href={href} className="text-sanction-ink underline">
              Open the record
            </Link>
          </>
        ) : null}
      </span>
    </div>
  );
}

export function SupplierResultCard({ card }: { card: SupplierCardModel }) {
  // Discover passes the search's own URL with `?record=`, so the record
  // opens over the results and Close returns to them. Anywhere else, the
  // record's full page.
  const recordHref = card.recordHref ?? `/app/suppliers/${card.slug}`;
  const sel = useSelection();
  const selectable = sel.interactive && Boolean(card.supplierId);
  const selected = selectable ? sel.isSelected(card.supplierId!) : Boolean(card.selected);
  const name = splitQualifier(card.name);
  return (
    <article
      aria-label={card.name}
      data-sanctioned={card.sanctioned ? "true" : undefined}
      className={cn(
        "relative flex gap-3 border-b border-line-subtle p-5 last-of-type:border-b-0",
        selected && "shadow-[inset_3px_0_0_rgb(var(--ds-accent))]",
        card.sanctioned && "before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-sanction before:content-['']",
      )}
    >
      <Checkbox
        on={selected}
        label={`Select ${card.name}`}
        onToggle={selectable ? () => sel.toggle(card.supplierId!) : undefined}
        className="mt-4"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Wraps, so the action cluster drops below the identity block rather
            than pushing the card past the viewport — and beside an open record
            (27 Sep 2026), where the results column is ~500px on a 1440
            display while the viewport says `xl`. Nothing here may key on the
            viewport: the identity block claims 18rem (or the whole line on a
            phone) before the actions may share its row, so the name and the
            marks never crush into a sliver. */}
        <div className="flex flex-wrap items-start gap-3">
          <LogoTile initials={card.initials} tier={card.topTier} />
          <div className="flex min-w-[min(18rem,100%)] flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* A heading, so heading navigation moves between results and each
                  card's Open / Send RFQ / Save sit under their supplier's name.
                  The name itself opens the record (§3.3, "from Open record /
                  the name"); the button beside it goes to the same place. */}
              <Title as="h2" className="min-w-0 max-w-full">
                {/* `next/link` and `scroll={false}`: the record opens over these
                    results without a document load or moving the page (§3.3).
                    The server does re-run the search (`record` is a search
                    param); the selection survives even a failed re-run
                    (discover/page.tsx). One line, cut at the end, the whole
                    name in its title and its accessible name (the One-Line
                    Name Rule); the qualifier is the line under it. */}
                <Link
                  prefetch={false}
                  scroll={false}
                  href={recordHref}
                  title={card.name}
                  aria-label={name.qualifier ? card.name : undefined}
                  data-name=""
                  className="block truncate text-ink-strong hover:text-brand-ink"
                >
                  {name.base}
                </Link>
              </Title>
              <SourceMarks marks={card.marks} />
            </div>
            {name.qualifier ? (
              <span data-name="" title={name.qualifier} className="block truncate text-sm text-ink-subtle">
                {name.qualifier}
              </span>
            ) : null}
            <MetaLine facts={card.meta} />
            {card.sanctioned ? <SanctionLine sample={card.sanctionSample} href={recordHref} /> : null}
          </div>
          {/* Never `shrink-0`, never `nowrap`: three nowrap buttons come to
              ~326px, and with the card's padding and logo tile that set the
              card's minimum at ~430px — so Cards, the default view, scrolled
              the page sideways on a 375px phone and at the 320px floor, and
              would again in the results column beside a record on a 1024
              display. The cluster wraps under the identity block whenever
              the row is too narrow, and wraps inside itself below ~330px. */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {card.supplierId ? (
              <SaveRecordButton supplierId={card.supplierId} saved={Boolean(card.saved)} />
            ) : (
              <Button>
                <Icon name="bookmark" /> Save
              </Button>
            )}
            <Button href={recordHref} clientNav scroll={false}>Open record</Button>
            <Button href={card.sanctioned ? undefined : (card.rfqHref ?? undefined)} clientNav scroll={false} disabled={card.sanctioned || !card.rfqHref}>
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
        {/* 352px of tiles beside the photo strip does not fit a phone, nor
            the results column beside an open record; the strip claims 26rem
            (`PhotoStrip`) and wraps under the tiles when the row cannot hold
            both. Below `lg` the tiles take the full width on their own. */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid w-full grid-cols-2 gap-2 lg:w-[352px]">
            {card.tiles.map((t) => (
              <Tile key={t.label} tile={t} />
            ))}
          </div>
          <PhotoStrip tiles={card.photos} totalLines={card.totalLines} registerChecked="EPB" readDate={card.epbReadDate} unknown={card.linesUnknown} onRegister={card.onEpbRegister} />
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
