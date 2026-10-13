// The supplier record: one view for the pane beside a list and the full page.
//
// From 640 it is Paper page 37 (the desktop redesign of 12 Oct 2026). Full page: a head with the name,
// what it is, where, the three checks in short and Share / Save / Send RFQ; once that head has scrolled
// away, a 56px bar with the same name, checks and actions; a main column of nine sections and a rail
// that is only the "On this page" nav. Pane: head, tabs that stick, the same sections, and Save and
// Send RFQ in a bar at the foot. A sanctioned record adds a solid band above everything and replaces
// Send RFQ with the refusal in words; nothing here is scored. Contact is how many are on file, locked,
// unless the database returned the details themselves (0145: an admin, or a Growth or Enterprise
// buyer), which are then drawn.
//
// Under 640 none of that is drawn: a phone gets `PhoneRecord` (Paper page 35) and a 64-tall action bar
// fixed to the foot of the screen. `Summary` is the public page's strip (`public-record.tsx`).

import { ArrowsOutSimple, CaretLeft, Clock, Factory, MapPin, Storefront, XCircle, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Define, buttonClass, ring } from "@/components/kit";
import { REFUSAL, SanctionBanner } from "@/components/patterns";
import type { SupplierSheetModel } from "@/lib/dashboard/models";
import { cn } from "@/lib/utils";
import { CertificatesSection, ChecksSection, ContactSection, ExportsSection, OverviewSection, ProductsSection, SafetySection, SitesSection, SourcesSection, StatusStrip } from "./desktop";
import { SECTIONS, headFacts, headStatuses, sectionCount } from "./desktop-words";
import { SourceCheckListener } from "@/components/onboarding/source-check";
import { PhoneRecord } from "./phone-record";
import { RecordSave } from "./save-button";
import { SectionTabs } from "./section-tabs";
import { ShareButton } from "./share-button";
import { recordSubline, type SummaryCell, type TabId } from "./words";

export type RecordViewProps = {
  model: SupplierSheetModel;
  /** `pane` beside the results, `page` at /app/suppliers/[slug]. */
  mode: "pane" | "page";
  tab: TabId;
  /** Where a tab goes: the same record, on the same search, with that tab. */
  tabHref: (tab: TabId) => string;
  today: Date;
  /** The list with this record open beside it: Back to results on the page, and what Open full page carries on the pane. */
  backHref?: string | null;
  /** `?site=` as the page read it: the site selected on the Sites tab on first paint. */
  site?: number | null;
};

const TABULAR = "[font-variant-numeric:tabular-nums]";

function Cell({ c }: { c: SummaryCell }) {
  const Glyph = c.tone === "caution" ? (c.lapsed ? XCircle : Clock) : null;
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-t border-line py-3 first:border-t-0 sm:flex-auto sm:flex-col sm:justify-start sm:gap-0.5 sm:border-r sm:border-t-0 sm:py-3 sm:pl-3 sm:pr-2 sm:last:border-r-0",
        c.tone === "sanction" && "sm:bg-sanction-tint",
      )}
    >
      <dt className="text-md text-ink sm:text-xs sm:text-ink-3">
        <Define term={c.label} focusable={false} describedId={stripTermId(c.key)} />
      </dt>
      <dd className="flex flex-col items-end gap-0.5 text-right sm:items-start sm:text-left">
        <span
          className={cn(
            "flex items-center gap-1.5 text-md font-semibold",
            c.tone !== "sanction" && "sm:whitespace-nowrap",
            c.tone === "caution" ? "text-caution" : c.tone === "sanction" ? "text-sanction" : "text-ink",
          )}
        >
          {Glyph ? <Glyph size={16} weight="fill" className={cn("shrink-0", c.tone === "caution" && "text-caution-icon")} aria-hidden /> : null}
          {c.valueWords ? (
            <>
              <span aria-hidden="true" className="text-ink-3" title={c.valueWords}>
                {c.value}
              </span>
              <span className="sr-only">{c.valueWords}</span>
            </>
          ) : c.href ? (
            <Link href={c.href} prefetch={false} scroll={false} className={cn("rounded-sm underline decoration-1 [text-underline-position:from-font] hover:decoration-2", ring)}>
              {c.value}
            </Link>
          ) : (
            c.value
          )}
        </span>
        {c.sub ? <span className="text-xs text-ink-3 max-sm:text-sm">{c.subTerm ? <Define term={c.subTerm} focusable={false}>{c.sub}</Define> : c.sub}</span> : null}
      </dd>
    </div>
  );
}

/** The id of a strip label's definition, so the strip itself can name all five. */
export const stripTermId = (key: string) => `record-strip-term-${key}`;

/**
 * The five cells: a bordered strip from 640, five rows with their words on the right on a phone.
 * One tab stop for the five labels (critique of 8 Oct 2026, round 3, item 6: six Tabs before the
 * tabs): the strip is focusable and described by the five definitions; a label is reached by hover
 * and through the strip, never a stop of its own.
 */
export function Summary({ cells }: { cells: SummaryCell[] }) {
  return (
    <dl
      aria-label="Summary"
      tabIndex={0}
      aria-describedby={cells.map((c) => stripTermId(c.key)).join(" ")}
      className={cn("flex flex-col rounded-sm sm:flex-row sm:rounded-lg sm:border sm:border-line", ring, TABULAR)}
    >
      {cells.map((c) => (
        <Cell key={c.key} c={c} />
      ))}
    </dl>
  );
}

const sendClass = buttonClass({ kind: "primary" });

export function RecordView({ model, mode, tab, tabHref, today, backHref = null, site = null }: RecordViewProps) {
  const page = mode === "page";
  // The list's own title is the page's h1 beside a pane; the sections head one level under the name.
  const Title = page ? "h1" : "h2";
  const level = page ? "h2" : "h3";
  const list = model.sanctions[0] ?? null;
  const listName = list?.list ?? "sanctions list";
  const expandHref = backHref ? `${model.fullHref}${model.fullHref.includes("?") ? "&" : "?"}back=${encodeURIComponent(backHref)}` : model.fullHref;
  // A section of this record: the tab its address carries, then its anchor (Checks and Contact have no tab of their own).
  const hrefOf = (id: string) => `${tabHref(SECTIONS.find((x) => x.id === id)?.tab ?? "overview")}#record-${id}`;
  const statuses = headStatuses(model, today);
  const head = headFacts(model);
  const TypeGlyph = head.buyingHouse ? Storefront : Factory;
  const sections = SECTIONS.map((x) => ({ id: x.id, label: x.label, href: hrefOf(x.id), count: sectionCount(model, x.id) ?? undefined }));

  const actions = (
    <>
      {model.supplierId ? <RecordSave supplierId={model.supplierId} saved={model.saved} /> : null}
      {model.sanctioned ? (
        <span className="flex items-center gap-2 pl-1 text-base font-medium text-sanction">{REFUSAL}</span>
      ) : model.rfqHref ? (
        <Link href={model.rfqHref} prefetch={false} className={sendClass}>
          Send RFQ
        </Link>
      ) : null}
    </>
  );

  return (
    <section
      aria-label="Supplier record"
      data-record={mode}
      data-detail={page ? "" : undefined}
      // A phone's page: room at the foot for the fixed action bar, so nothing ends under it.
      // Never wider than its scroller: a long unbroken value wraps, and anything still too wide is clipped
      // rather than letting a phone pan the record sideways (`clip` keeps the sticky bars sticking, `hidden` would not).
      className={cn("group/record flex min-w-0 flex-1 flex-col overflow-x-clip bg-surface [overflow-wrap:break-word]", page && "max-sm:pb-[calc(theme(spacing.action-bar)_+_env(safe-area-inset-bottom))]")}
    >
      <SourceCheckListener />
      {model.sanctioned ? (
        <SanctionBanner
          title={`On the ${listName}${list?.listedOn ? ` since ${list.listedOn}` : ""}.`}
          detail={`${REFUSAL} From the ${listName}${list?.screenedOn ? ` · checked ${list.screenedOn}` : ""}.`}
        />
      ) : null}

      {page ? (
        <>
          {/* The stuck bar. Before the head and with no height of its own, so it sits at the top of the scroll from
              the start, under the head: the head sliding away uncovers it, with nothing to appear or jump
              (founder, 13 Oct 2026: it showed below the last of the head, the statuses twice, then jumped up).
              `data-stuck` (the nav's script) only takes it out of reach while the head still covers it. */}
          <div data-record-stuck="" className="sticky top-0 z-raised h-0 max-sm:hidden">
            <div className="invisible absolute inset-x-0 top-0 flex h-14 items-center gap-3.5 border-b border-line bg-surface px-6 group-data-[stuck]/record:visible lg:px-8">
              {backHref ? (
                <Link href={backHref} aria-label="Back to results" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 hover:bg-line", ring)}>
                  <CaretLeft size={16} weight="thin" aria-hidden />
                </Link>
              ) : null}
              <p className="min-w-0 shrink text-[18px]/[26px] font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{model.name}</p>
              <StatusStrip statuses={statuses} href={hrefOf("checks")} className="h-[30px] max-lg:hidden" />
              <span className="min-w-0 flex-1" />
              <div className="flex shrink-0 items-center gap-2">
                <ShareButton href={model.fullHref} className="size-8" />
                {actions}
              </div>
            </div>
          </div>
          {/* The page's head scrolls away with the page and uncovers the bar waiting under it: on the bar's own
              layer and after it, so it is drawn over the bar for as long as any of it is in the way. */}
          <header data-record-head="" className="relative z-raised flex flex-col gap-2 border-b border-line bg-surface px-6 pb-4 pt-3 max-sm:hidden lg:px-8">
            {backHref ? (
              <Link href={backHref} className={cn("flex min-h-6 w-fit items-center gap-1 rounded-sm text-sm font-medium text-brand-ink underline decoration-1 underline-offset-[3px] hover:decoration-2", ring)}>
                <CaretLeft size={14} weight="thin" className="shrink-0" aria-hidden />
                Back to results
              </Link>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
                <Title className="text-[28px]/[36px] font-medium tracking-tighter text-ink [overflow-wrap:anywhere]">{model.name}</Title>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                  {head.type ? (
                    <p className="flex items-center gap-2 text-base text-ink-2">
                      <TypeGlyph size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                      {head.type}
                    </p>
                  ) : null}
                  {head.place ? (
                    <p className="flex items-center gap-2 text-base text-ink-2">
                      <MapPin size={18} weight="thin" className="shrink-0 text-ink-3" aria-hidden />
                      {head.place}
                    </p>
                  ) : null}
                  <StatusStrip statuses={statuses} href={hrefOf("checks")} />
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <ShareButton href={model.fullHref} />
                {actions}
              </div>
            </div>
          </header>
        </>
      ) : (
        // 14px over the name in the pane: its baseline then meets the list bar's title beside it (56 tall, centred).
        <header className="flex items-start justify-between gap-4 bg-surface px-6 pb-2.5 pt-3.5 max-sm:hidden sm:sticky sm:top-0 sm:z-raised">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Title className="text-lg font-semibold tracking-tight text-ink [overflow-wrap:anywhere]">{model.name}</Title>
            <p className="text-sm text-ink-2">{recordSubline(model)}</p>
            <StatusStrip statuses={statuses} href={hrefOf("checks")} className="mt-1.5" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={expandHref} className={cn("flex h-8 items-center gap-1.5 whitespace-nowrap rounded-md bg-sunken pl-2.5 pr-3 text-sm font-medium text-ink hover:bg-line", ring)}>
              <ArrowsOutSimple size={16} weight="thin" className="shrink-0" aria-hidden />
              Open full page
            </Link>
            {model.closeHref ? (
              // Under 1280 the pane is the kit's drawer, which draws its own close.
              <Link href={model.closeHref} scroll={false} aria-label="Close" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2 hover:bg-line max-xl:hidden", ring)}>
                <X size={16} weight="thin" aria-hidden />
              </Link>
            ) : null}
          </div>
        </header>
      )}

      {/* The pane's tabs; on the page they stand in for the rail where there is no room for it (under 1280).
          Keyed by record: a pane that opens another supplier starts again at its tab. */}
      <div className={cn("contents max-sm:hidden", page && "xl:hidden")}>
        <SectionTabs key={model.fullHref} variant={page ? "page-tabs" : "tabs"} initial={tab} tabs={sections} />
      </div>

      <div className={cn("flex items-start gap-8 max-sm:hidden", page ? "px-3 pb-[72px] pt-6 lg:pl-5 lg:pr-8" : "px-3 pb-8 pt-5")}>
        {/* The column the sections measure themselves by: their tables gain columns from 760px of it. */}
        <div className={cn("flex min-w-0 flex-1 flex-col [container-type:inline-size]", page ? "gap-9" : "gap-8")}>
          <OverviewSection model={model} today={today} level={level} exportsHref={hrefOf("exports")} market={model.market ?? null} rank={model.exportRank ?? null} />
          <ExportsSection model={model} today={today} level={level} />
          <ProductsSection model={model} today={today} level={level} fold={!page} />
          <CertificatesSection model={model} today={today} level={level} />
          <ChecksSection model={model} today={today} level={level} hrefOf={hrefOf} />
          <SafetySection model={model} today={today} level={level} />
          <SitesSection model={model} level={level} tabHref={tabHref} site={site} />
          <SourcesSection model={model} today={today} level={level} />
          <ContactSection model={model} level={level} />
          <div data-record-end="" aria-hidden />
        </div>

        {page ? (
          // The rail is only the page's own nav; it sticks under the stuck bar while the sections scroll past.
          <div data-record-rail="" className="hidden w-[280px] shrink-0 xl:sticky xl:top-[calc(var(--record-offset,0px)+24px)] xl:block xl:self-start">
            <SectionTabs key={model.fullHref} variant="rail" initial={tab} tabs={sections} />
          </div>
        ) : null}
      </div>

      {/* The pane's two actions, at its foot whatever is scrolled: Save and Send RFQ, or the refusal in its place. */}
      {page ? null : (
        <div className={cn("sticky bottom-0 z-raised mt-auto flex h-16 shrink-0 items-center gap-2 px-6 max-sm:hidden", model.sanctioned ? "justify-start border-t-2 border-sanction bg-sanction-tint" : "justify-end border-t border-line bg-surface")}>{actions}</div>
      )}

      {/* A phone's record (Paper page 35): its own bar, statuses, tabs and one tab's view at a time. After the
          desktop's in the page, so an anchor (`#record-certificates`) still lands on the desktop's section. */}
      <PhoneRecord model={model} page={page} tab={tab} tabHref={tabHref} today={today} backHref={backHref} site={site} />

      {/* A phone's one action: Save beside the primary, or the refusal in its place. On the page it is
          fixed to the foot of the screen, as the app's own tab bar is (founder, 6 Oct 2026: stuck inside
          the scrolling record it "shakes or stutters" on a fast scroll, "not fixed there"); the 64 sit
          above the phone's safe area, and the record keeps that much room at its foot. In the drawer a
          narrow window gets, it sticks to the drawer's own scroll. Both phone bars sit on their own layer
          (translateZ), so the phone moves them with the page instead of repainting them a beat late
          (founder, 10 Oct 2026: still shaking); Save's note then places itself against this bar, the same spot. */}
      <div data-record-actions="" className={cn("bottom-0 sm:hidden", page ? "fixed inset-x-0 z-sticky [transform:translateZ(0)]" : "sticky")}>
        {model.sanctioned ? (
          <div role="status" className="flex min-h-action-bar items-center gap-3 border-t-2 border-sanction bg-sanction-tint px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {model.supplierId ? <RecordSave supplierId={model.supplierId} saved={model.saved} appearance="icon" /> : null}
            <p className="text-base font-medium text-sanction">{REFUSAL}</p>
          </div>
        ) : (
          <div className="box-content flex h-[calc(theme(spacing.action-bar)_-_1px)] items-center gap-2 border-t border-line bg-surface px-4 pb-[env(safe-area-inset-bottom)]">
            {model.supplierId ? <RecordSave supplierId={model.supplierId} saved={model.saved} appearance="icon" /> : null}
            {model.rfqHref ? (
              <div className="min-w-0 flex-1">
                <Link href={model.rfqHref} prefetch={false} className={buttonClass({ kind: "primary", size: "touch", full: true })}>
                  Send RFQ
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
