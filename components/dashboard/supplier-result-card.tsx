// SupplierResultCard: one search result as a card, rebuilt after the founder's
// review of 29 Sep 2026 on five lines, each fact said once (name; facts;
// sources; status; products). See the component's own comment.
//
// Client (REZ-B): the checkbox reads and writes the shared selection context
// (`./selection`), which only exists inside a `SelectionProvider`. Outside
// one — the `/dev/ds` gallery — it falls back to the static `card.selected`
// prop and the checkbox stays inert, exactly as REZ-A shipped it.

"use client";

import { splitQualifier } from "@/lib/dashboard/facts";
import type { FactWithMark, HighlightChip, SupplierCardModel } from "@/lib/dashboard/models";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { Chip, Chips } from "./chips";
import { Button, Checkbox, V2Tag } from "./controls";
import { Icon } from "./icons";
import { LogoTile, SourceMark, SourceMarks } from "./marks";
import { CardThumbs } from "./photo-tiles";
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
          {/* The fact's icon, in the line's ink-muted, the way a place card or a company header
              shows it (founder, 29 Sep 2026). */}
          {f.icon ? <SbIcon name={f.icon} /> : null}
          {f.code ? <Code>{f.text}</Code> : f.text}
          {f.mark && !inRow?.has(f.mark.code) ? <SourceMark mark={f.mark} sm /> : null}
        </span>
      ))}
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

/** The card draws this many status chips, then "+N" naming the rest; a phone two. */
const CHIPS_SHOWN = 4;
const CHIPS_SHOWN_PHONE = 2;
/** The marks a phone's one line holds before "+N". */
const MARKS_SHOWN_PHONE = 7;

/**
 * The card's facts on one line, icon and value (PR B's style), cut at the end
 * with the whole line in its title. A short figure ("1,300 workers") carries
 * its full words in its title and for a screen reader; a second figure sits in
 * brackets after the first.
 */
function CardFacts({ qualifier, facts, className }: { qualifier: string | null; facts: readonly FactWithMark[]; className?: string }) {
  const whole = [qualifier, ...facts.map((f) => (f.aside ? `(${f.title ?? f.text})` : (f.title ?? f.text)))]
    .filter(Boolean)
    .join(" · ")
    .replace(/ · \(/g, " (");
  return (
    // On a phone (D5) two lines at most, the dots gone and each fact kept
    // whole with 12px between them; from sm one line, cut.
    <p data-line="" title={whole} className={cn("m-0 text-sm text-ink max-sm:line-clamp-2 sm:truncate", className)}>
      {qualifier ? <span className="text-ink-muted max-sm:mr-3">{qualifier}</span> : null}
      {facts.map((f, i) => (
        <Fragment key={`${f.text}-${i}`}>
          {f.aside ? " " : i > 0 || qualifier ? <span aria-hidden className="mx-1.5 text-ink-subtle max-sm:hidden">·</span> : null}
          <span className={cn("max-sm:mr-3 max-sm:inline-block", f.aside && "max-sm:-ml-2")}>
          {f.icon && !f.aside ? <SbIcon name={f.icon} size={14} className="mr-1 inline-block align-[-2px] text-ink-muted" /> : null}
          <span className={f.quiet ? "text-quiet-ink" : f.aside ? "text-ink-muted" : undefined}>
            {f.title ? (
              <>
                <span aria-hidden>{f.aside ? `(${f.text})` : f.text}</span>
                <span className="sr-only">{f.title}</span>
              </>
            ) : f.aside ? (
              `(${f.text})`
            ) : (
              f.text
            )}
          </span>
          </span>
        </Fragment>
      ))}
    </p>
  );
}

/**
 * A result as a card (founder's review, 29 Sep 2026: "really text heavy with
 * no visual hierarchy"; each fact was said two or three times). Name first,
 * facts second, status third, each fact once:
 *
 *   [box] [tile] Base name (one line)                 [save] [Open] [Send RFQ]
 *                qualifier · Factory · Dhaka · Est. 2009 · 1,300 workers (…)
 *                [marks]  8 registers & certifiers · 3 brand lists
 *                [GOTS …] [SA8000 …] [RSC] [EPB · 13 lines] +N
 *                [48px thumbs, the HS code under each]  +7 lines  illustration
 *
 * The four tiles went: what they said is on the lines above (their links on
 * the matching chips, their negatives in the sources caption's title).
 * Selected: filled checkbox and the 3px near-black rule. Sanctioned: the 4px bar,
 * the notice under the facts, the badge first among the chips, Send RFQ
 * withheld. Beside an open pane the search draws the compact table instead
 * (`resultsView`), so a card is never squeezed.
 */
export function SupplierResultCard({ card }: { card: SupplierCardModel }) {
  // Discover passes the search's own URL with `?record=`, so the record
  // opens beside the results and Close returns to them. Anywhere else, the
  // record's full page.
  const recordHref = card.recordHref ?? `/app/suppliers/${card.slug}`;
  const sel = useSelection();
  const selectable = sel.interactive && Boolean(card.supplierId);
  const selected = selectable ? sel.isSelected(card.supplierId!) : Boolean(card.selected);
  const name = splitQualifier(card.name);
  const chips: HighlightChip[] = card.sanctioned
    ? [{ tone: "sanction", icon: "warn", label: `Sanctioned${card.sanctionSample ? " · sample" : ""}` }, ...card.chips]
    : card.chips;
  const shown = chips.slice(0, CHIPS_SHOWN);
  const hidden = chips.slice(CHIPS_SHOWN).map((c) => c.label);
  return (
    <article
      aria-label={card.name}
      data-sanctioned={card.sanctioned ? "true" : undefined}
      className={cn(
        "relative flex gap-3 border-b border-line-subtle px-5 py-4 last-of-type:border-b-0",
        // On a phone (the phone hand-off's D5; Glassdoor, Booking.com, LinkedIn)
        // one column: the box, the 40px tile and the name with the facts under
        // it on top, then everything else the card's full width, the actions
        // last. CSS only: the wrappers below dissolve into this grid.
        "max-sm:grid max-sm:grid-cols-[auto_auto_minmax(0,1fr)] max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-2 max-sm:px-4",
        selected && "shadow-[inset_3px_0_0_rgb(var(--ds-accent))]",
        card.sanctioned && "before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:bg-sanction before:content-['']",
      )}
    >
      <Checkbox on={selected} label={`Select ${card.name}`} onToggle={selectable ? () => sel.toggle(card.supplierId!) : undefined} className="hit mt-4 max-sm:row-span-2 max-sm:mt-0" />
      {/* The tile opens the record too; the name is the link a keyboard and a screen reader use. */}
      <Link prefetch={false} scroll={false} href={recordHref} tabIndex={-1} aria-hidden className="shrink-0 max-sm:row-span-2">
        <LogoTile initials={card.initials} tier={card.topTier} className="max-sm:size-10 max-sm:text-sm" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2 max-sm:contents">
        {/* Line 1: the base name, one line, and the actions at the row's end. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 max-sm:contents">
          <Title as="h2" className="min-w-[min(12rem,100%)] flex-1 basis-0 max-sm:col-start-3 max-sm:row-start-1 max-sm:min-w-0 max-sm:self-end">
            <Link
              prefetch={false}
              scroll={false}
              href={recordHref}
              title={card.name}
              aria-label={name.qualifier ? card.name : undefined}
              data-name=""
              className="block truncate text-ink-strong hover:underline"
            >
              {name.base}
            </Link>
          </Title>
          {/* On a phone the actions' own row, last: Save and Send RFQ (the card opens the record). */}
          <div className="flex shrink-0 items-center gap-1 max-sm:order-last max-sm:col-span-full max-sm:justify-end max-sm:gap-2">
            {card.supplierId ? (
              <SaveRecordButton supplierId={card.supplierId} saved={Boolean(card.saved)} icon size="sm" variant="ghost" />
            ) : (
              <Button variant="ghost" size="sm" icon aria-label="Save" title="Save">
                <Icon name="bookmark" />
              </Button>
            )}
            <Button variant="ghost" size="sm" href={recordHref} clientNav scroll={false} aria-label={`Open ${card.name} beside the results`} className="max-sm:hidden">
              <SbIcon name="open-beside" /> Open
            </Button>
            <Button size="sm" href={card.sanctioned ? undefined : (card.rfqHref ?? undefined)} clientNav scroll={false} disabled={card.sanctioned || !card.rfqHref} className="max-sm:h-target max-sm:px-4 max-sm:text-base">
              <Icon name="send" /> Send RFQ
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 max-sm:contents min-[1440px]:flex-row min-[1440px]:items-start min-[1440px]:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-2 max-sm:contents">
            {/* Line 2: the facts, once. */}
            <CardFacts qualifier={name.qualifier} facts={card.meta} className="max-sm:col-start-3 max-sm:row-start-2 max-sm:self-start" />
            {card.sanctioned ? <SanctionLine sample={card.sanctionSample} href={recordHref} className="max-sm:col-span-full" /> : null}
            {/* Line 3: the sources, once: the marks and one caption that keeps
                registers and certifiers apart from brand lists. */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 max-sm:col-span-full">
              {/* On a phone the marks at 20px on one line, then "+N". */}
              <SourceMarks
                marks={card.marks}
                caption="none"
                // n+8: the eighth mark on (`MARKS_SHOWN_PHONE`), spelt out for Tailwind.
                className="max-sm:flex-nowrap max-sm:gap-1.5 max-sm:[&>*]:size-5 max-sm:[&>*:nth-child(n+8)]:hidden"
              />
              {card.marks.length > MARKS_SHOWN_PHONE ? (
                <span className="text-sm text-ink-subtle sm:hidden">+{card.marks.length - MARKS_SHOWN_PHONE}</span>
              ) : null}
              <span className="text-sm text-ink-subtle" title={card.sourcesNote ?? undefined}>
                {card.sourcesCaption}
                {card.sourcesNote ? <span className="sr-only"> · {card.sourcesNote}</span> : null}
              </span>
            </div>
            {/* Line 4: status, the one place the card spends a status colour. */}
            {shown.length > 0 ? (
              // On a phone two chips, then "+N" for the rest.
              <Chips className="max-sm:col-span-full max-sm:[&>*:nth-child(n+3):not([data-more])]:hidden">
                {shown.map((c) =>
                  c.href ? (
                    // Next's own scroll, not `scroll={false}`: the href ends in
                    // #certificates or #products, and `scroll={false}` also drops
                    // the jump to that section.
                    <Link key={c.label} prefetch={false} href={c.href} className="rounded-sm transition-opacity duration-fast hover:opacity-80">
                      <Chip tone={c.tone} icon={c.icon} compact>
                        {c.label}
                      </Chip>
                    </Link>
                  ) : (
                    <Chip key={c.label} tone={c.tone} icon={c.icon} compact>
                      {c.label}
                    </Chip>
                  ),
                )}
                {hidden.length > 0 ? (
                  <span className="text-sm text-ink-subtle max-sm:hidden" title={hidden.join(" · ")}>
                    +{hidden.length}
                    <span className="sr-only">: {hidden.join(", ")}</span>
                  </span>
                ) : null}
                {chips.length > CHIPS_SHOWN_PHONE ? (
                  <span data-more="" className="text-sm text-ink-subtle sm:hidden">
                    +{chips.length - CHIPS_SHOWN_PHONE}
                    <span className="sr-only">: {chips.slice(CHIPS_SHOWN_PHONE).map((c) => c.label).join(", ")}</span>
                  </span>
                ) : null}
              </Chips>
            ) : null}
          </div>
          {/* Line 5 (beside lines 2–4 from 1440): the products. */}
          <CardThumbs tiles={card.photos} totalLines={card.totalLines} className="max-sm:col-span-full" />
        </div>
        {card.why && card.why.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-smart max-sm:col-span-full">
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
