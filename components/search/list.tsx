// The parts of the results that are not the table: the narrow list beside a pane (576), the
// phone's list, the footer with its page-size menu, and the three states a search can end in
// (nothing matches, it could not load, the page is past the end). Server component; the
// words are Paper's (`10 · Results, empty`, `Errors`, `11 · Results`).

import { Hourglass, Info, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { LinkPending } from "@/components/patterns/link-pending";
import { RecordSave } from "@/components/record/save-button";
import { ErrorPanel, Pagination, Skeleton, Unpublished, buttonClass } from "@/components/kit";
import { ABSENT } from "@/components/patterns";
import { PER_PAGE, discoverChips, discoverHref, filterCount, withoutFilterFamily, type DiscoverState } from "@/lib/discover-v32-state";
import { formatCount, nameSecondLine, splitQualifier } from "@/lib/dashboard/facts";
import { discoverFailureCopy } from "@/lib/discover-v32-rpc";
import { cn } from "@/lib/utils";
import type { ResultRow } from "./model";
import { PerPageMenu } from "./per-page";
import { SlowHead } from "./slow";

export { PaneRows } from "./pane-rows";

/**
 * The certificates of a phone's row in one line of words (Paper page 36, `search-results`): the worst
 * one with its glyph, amber when it has lapsed or is about to, then how many more there are. The
 * bodies' marks are the table's and the record's; a phone's row says it (founder, 12 Oct 2026).
 */
function CertWords({ r }: { r: ResultRow }) {
  const c = r.certCell;
  if (!c) return <Unpublished>{ABSENT.certificates}</Unpublished>;
  const problem = c.state === "expired" || c.state === "expiring";
  // "No expiry on file" has no date to count down to: the scheme is listed, and that is all the line says.
  const dated = /\d/.test(c.short);
  const G = problem ? Hourglass : dated ? ShieldCheck : Info;
  return (
    <span className="flex items-start gap-1.5 text-sm text-ink-3">
      <G size={16} weight="thin" className={cn("mt-0.5 shrink-0", problem && "text-caution-icon")} aria-hidden />
      <span>
        <span className={problem ? "font-medium text-caution" : undefined}>
          {c.first.scheme} {c.short.charAt(0).toLowerCase() + c.short.slice(1)}
        </span>
        {c.total > 1 ? ` · ${c.total - 1} more` : null}
      </span>
    </span>
  );
}

/**
 * On a phone (Paper page 36, `search-results`) a row is the name large, where it is and its sources,
 * the customs figures for a reader who may see them, the certificates in a line of words, and a
 * bookmark. The link covers the row and opens the record as a page with the way back to this search;
 * the bookmark saves, above the link.
 */
export function PhoneRows({ rows }: { rows: readonly ResultRow[] }) {
  return (
    <ul className="px-5 pt-1">
      {rows.map((r) => {
        const { base, qualifier } = splitQualifier(r.name);
        return (
          <li key={r.slug} className="relative flex gap-3 border-b border-line py-4 has-[>div>a:active]:bg-sunken has-[>div>a:focus-visible]:outline has-[>div>a:focus-visible]:outline-2 has-[>div>a:focus-visible]:outline-offset-[-2px] has-[>div>a:focus-visible]:outline-focus">
            <div className="flex min-w-0 flex-1 flex-col">
              <Link href={r.pageHref} className="flex flex-col gap-0.5 outline-none after:absolute after:inset-0 after:content-['']">
                <span data-name="" title={r.name} className="text-[19px]/[26px] font-semibold tracking-[-0.015em] text-ink [overflow-wrap:anywhere]">
                  {qualifier ? (
                    <>
                      <span aria-hidden="true">{base}</span>
                      <span className="sr-only">{r.name}</span>
                    </>
                  ) : (
                    base
                  )}
                  <LinkPending className="ml-1.5 inline-block align-[-2px]" />
                </span>
                <span data-name="" className="text-sm text-ink-3">
                  {[nameSecondLine(r.name, r.place ?? r.type), `${r.sources} ${r.sources === 1 ? "source" : "sources"}`].join(" · ")}
                </span>
                {r.exports ? (
                  <span className="text-base text-ink-3">
                    <span className="font-medium tabular-nums text-ink-2">{r.exports.key}</span> · {r.exports.detail}
                  </span>
                ) : null}
                <span className="pt-1">
                  <CertWords r={r} />
                </span>
              </Link>
            </div>
            {r.supplierId && !r.sanctioned ? (
              <RecordSave supplierId={r.supplierId} saved={r.saved} appearance="icon" className="relative z-raised -my-2 -mr-2 size-11 self-start border-transparent bg-transparent text-ink-2 hover:bg-sunken active:bg-sunken" />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** "Show 25 more suppliers" on a phone (the next page); `shown` counts every supplier up to and including this page. */
export function PhoneMore({ shown, total, nextHref, per }: { shown: number; total: number; nextHref: string | null; per: number }) {
  return (
    <div className="flex flex-col gap-2 p-4 md:hidden">
      {nextHref ? (
        <Link href={nextHref} scroll className={buttonClass({ kind: "secondary", size: "touch", full: true })}>
          Show {Math.min(per, total - shown)} more suppliers
        </Link>
      ) : null}
      <p className="text-center text-sm text-ink-3">
        Showing {formatCount(shown)} of {formatCount(total)}
      </p>
    </div>
  );
}

/** The page sizes the search takes, each with its link through `hrefFor` (which keeps the open record). */
export function perPageHrefs(state: DiscoverState, hrefFor: (s: DiscoverState) => string): [number, string][] {
  return PER_PAGE.map((n) => [n, hrefFor({ ...state, per: n, page: 1 })]);
}

export function ResultsFooter({ state, shown, total, hrefFor }: { state: DiscoverState; shown: number; total: number; hrefFor: (s: DiscoverState) => string }) {
  const pages = Math.max(1, Math.ceil(total / state.per));
  const from = (state.page - 1) * state.per + 1;
  return (
    <div className="max-md:hidden">
      <Pagination
        noun="suppliers"
        from={from}
        to={from + shown - 1}
        total={total}
        page={state.page}
        pages={pages}
        prevHref={state.page > 1 ? hrefFor({ ...state, page: state.page - 1 }) : undefined}
        nextHref={state.page < pages ? hrefFor({ ...state, page: state.page + 1 }) : undefined}
        perPage={<PerPageMenu per={state.per} sizes={perPageHrefs(state, hrefFor)} />}
      />
    </div>
  );
}

/** The words for a filter family the search could drop: the chips that belong to it. */
const FAMILY_CHIP: Record<string, RegExp> = {
  q: /^q$/,
  hs: /^hs-/,
  cert: /^cert-/,
  registry: /^reg-/,
  brand: /^brand-/,
  district: /^district-/,
  city: /^city-/,
  type: /^type-/,
  rsc: /^rsc$/,
  est: /^est$/,
  workers: /^workers$/,
  min_sources: /^min_sources$/,
  sanction: /^sanctioned$/,
};

export function familyWords(state: DiscoverState, family: string): string | null {
  const test = FAMILY_CHIP[family];
  if (!test) return null;
  const labels = discoverChips(state).filter((c) => test.test(c.key)).map((c) => c.label);
  return labels.length ? labels.join(" and ") : null;
}

/** Nothing matches: say which filter to drop and how many suppliers that finds, and offer to clear. */
export function ResultsEmpty({
  state,
  explain,
  clearHref,
  saveHref,
}: {
  state: DiscoverState;
  explain: { dropped: string; remaining: number }[];
  clearHref: string;
  saveHref: string;
}) {
  const options = explain
    .filter((e) => e.remaining > 0)
    .map((e) => ({ e, without: withoutFilterFamily(state, e.dropped), words: familyWords(state, e.dropped) }))
    .filter((o): o is { e: { dropped: string; remaining: number }; without: DiscoverState; words: string } => o.without !== null && o.words !== null)
    .sort((a, b) => b.e.remaining - a.e.remaining);
  const best = options[0];
  const n = filterCount(state);
  return (
    <div className="flex max-w-pane flex-col gap-3 px-6 py-12">
      <h2 className="text-lg font-semibold text-ink">No suppliers match these filters.</h2>
      <p className="text-md text-ink-2">
        {n === 0 ? "No published suppliers to show." : `No supplier matches all ${n} ${n === 1 ? "filter" : "filters"}.`}
        {best ? ` Without ${best.words}, ${formatCount(best.e.remaining)} ${best.e.remaining === 1 ? "supplier matches" : "suppliers match"}.` : ""}
      </p>
      {best || n > 0 ? (
        <div className="flex flex-wrap gap-2 pt-2">
          {best ? (
            <Link href={discoverHref(best.without)} className={buttonClass({ kind: "primary", size: "lg" })}>
              Remove {best.words} · show {formatCount(best.e.remaining)} {best.e.remaining === 1 ? "supplier" : "suppliers"}
            </Link>
          ) : null}
          {n > 0 ? (
            <Link href={clearHref} className={buttonClass({ kind: "secondary", size: "lg" })}>
              Clear all filters
            </Link>
          ) : null}
        </div>
      ) : null}
      {options.length > 1 ? (
        <ul className="flex flex-col gap-1 text-base">
          {options.slice(1).map((o) => (
            <li key={o.e.dropped}>
              <Link href={discoverHref(o.without)} className="rounded-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2">
                Remove {o.words} · {formatCount(o.e.remaining)} {o.e.remaining === 1 ? "supplier" : "suppliers"}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {n > 0 ? (
        <p className="pt-2 text-sm text-ink-3">
          Or{" "}
          <Link href={saveHref} className="rounded-sm font-medium text-brand-ink underline decoration-1 [text-underline-position:from-font] hover:decoration-2">
            save this search
          </Link>{" "}
          to hear when a supplier starts to match it.
        </p>
      ) : null}
    </div>
  );
}

/** The search could not run. Filters are kept in the address; Try again is the same address. */
export function ResultsError({ failure, retryHref }: { failure: "busy" | "unavailable"; retryHref: string }) {
  return (
    <div className="p-6">
      <ErrorPanel
        title="We couldn't load suppliers."
        retry={
          <Link href={retryHref} className={buttonClass({ kind: "primary" })}>
            Try again
          </Link>
        }
      >
        {discoverFailureCopy(failure)} Your filters are kept.
      </ErrorPanel>
    </div>
  );
}

export function PastEnd({ page, firstHref }: { page: number; firstHref: string }) {
  return (
    <div className="flex max-w-pane flex-col gap-3 px-6 py-12">
      <h2 className="text-lg font-semibold text-ink">That page is past the end of these results.</h2>
      <p className="text-md text-ink-2">Page {page} has no suppliers.</p>
      <div className="pt-2">
        <Link href={firstHref} className={buttonClass({ kind: "secondary", size: "lg" })}>
          Back to the first page
        </Link>
      </div>
    </div>
  );
}

/** Skeleton rows that match the table that loads (Paper `Results, loading`); words after two seconds belong to the head. */
export function ResultsSkeleton({ title }: { title?: string }) {
  const widths = [220, 180, 240, 200, 160, 230, 190, 210];
  return (
    // `data-own-top`: a phone's results start at the field, so the frame's title bar is hidden while they load too
    // (it would be drawn over the skeleton and then vanish under the results, a 56px jump on every search).
    <div role="status" aria-busy="true" aria-label="Loading suppliers" data-own-top="" className="flex flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6 max-md:hidden">
        <SlowHead>{title ?? ""}</SlowHead>
        <Skeleton className="h-3 w-24" />
      </div>
      {/* A phone waits on the shape of its own bar: the field, the pills, the count. */}
      <div className="flex flex-col gap-4 px-5 pt-3 md:hidden" aria-hidden>
        <Skeleton className="h-[52px] rounded-[12px]" />
        <div className="flex gap-2 py-1">
          <Skeleton className="h-9 w-11 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
        </div>
        <Skeleton className="h-5 w-32" />
      </div>
      {/* The table's head and its rows are the desktop's; a phone waits on the shape of its own list. */}
      <div className="mx-6 flex h-row-head items-center border-b border-line bg-subtle px-3 text-xs font-medium text-ink-3 max-md:hidden">
        <span className="w-[360px] pl-10">Supplier</span>
        <span className="w-[120px]">Type</span>
        <span className="w-[140px]">Location</span>
        <span className="w-[110px] text-right">Workers</span>
        <span className="w-[90px] text-right">Sources</span>
        <span className="flex-1 pl-6">Certificates</span>
      </div>
      <div className="md:hidden" aria-hidden>
        {widths.map((w, i) => (
          <div key={i} className="mx-5 flex flex-col gap-2.5 border-b border-line py-4">
            <Skeleton className="h-4" style={{ width: w }} />
            <Skeleton className="h-3" style={{ width: 150 + (i % 3) * 20 }} />
            <Skeleton className="h-3 w-[190px]" />
          </div>
        ))}
      </div>
      <div className="mx-6 max-md:hidden" aria-hidden>
        {widths.map((w, i) => (
          <div key={i} className="flex h-row items-center gap-6 border-b border-line pl-[52px] pr-3">
            <Skeleton className="h-3 shrink-0" style={{ width: w }} />
            <Skeleton className="h-3 w-[70px] shrink-0" />
            <Skeleton className="h-3 shrink-0" style={{ width: 80 + (i % 3) * 15 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
