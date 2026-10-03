// The parts of the results that are not the table: the narrow list beside a pane (576), the
// phone's list, the footer with its page-size menu, and the three states a search can end in
// (nothing matches, it could not load, the page is past the end). Server component; the
// words are Paper's (`10 · Results, empty`, `Errors`, `11 · Results`).

import { CaretDown, Check } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { CertProblem, SupplierRow } from "@/components/patterns";
import { ErrorPanel, Menu, MenuItem, Pagination, Skeleton, buttonClass } from "@/components/kit";
import { PER_PAGE, discoverChips, discoverHref, filterCount, withoutFilterFamily, type DiscoverState } from "@/lib/discover-v32-state";
import { formatCount } from "@/lib/dashboard/facts";
import { cn } from "@/lib/utils";
import type { ResultRow } from "./model";
import { SlowHead } from "./slow";

function Problem({ r, small }: { r: ResultRow; small?: boolean }) {
  return r.cert ? (
    <CertProblem state={r.cert.state} more={r.cert.more} small={small}>
      {r.cert.text}
    </CertProblem>
  ) : (
    <span className={cn("text-ink-3", small ? "text-xs" : "text-sm")}>No certificates found</span>
  );
}

/** Beside a pane: name, type and place, the first certificate problem, the source count. A long name wraps. */
export function PaneRows({ rows, currentSlug }: { rows: readonly ResultRow[]; currentSlug?: string | null }) {
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.slug}>
          <SupplierRow layout="pane" href={r.paneHref} name={r.name} type={r.type} place={r.place} sources={r.sources} problem={<Problem r={r} small />} selected={r.slug === currentSlug} />
        </li>
      ))}
    </ul>
  );
}

/** On a phone a row opens the record as a page, with the way back to this search. */
export function PhoneRows({ rows }: { rows: readonly ResultRow[] }) {
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.slug}>
          <SupplierRow layout="phone" href={r.pageHref} name={r.name} type={r.type} place={r.place} sources={r.sources} problem={<Problem r={r} />} />
        </li>
      ))}
    </ul>
  );
}

/** "Show 25 more suppliers" on a phone; the same link is "Next" on a desktop footer. */
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

/** "25 per page" with the page sizes the search takes. */
export function PerPageMenu({ state }: { state: DiscoverState }) {
  return (
    <Menu
      align="end"
      trigger={
        <button type="button" className={buttonClass({ kind: "secondary", className: "gap-1 pl-3 pr-2" })}>
          {state.per} per page
          <CaretDown size={16} className="shrink-0 text-ink-2" aria-hidden />
        </button>
      }
    >
      {PER_PAGE.map((n) => (
        <MenuItem key={n} href={discoverHref(state, { per: n, page: 1 })}>
          <span className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center">{n === state.per ? <Check size={16} className="text-brand" aria-label="Page size" /> : null}</span>
            {n} per page
          </span>
        </MenuItem>
      ))}
    </Menu>
  );
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
        perPage={<PerPageMenu state={state} />}
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
              <Link href={discoverHref(o.without)} className="rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2">
                Remove {o.words} · {formatCount(o.e.remaining)} {o.e.remaining === 1 ? "supplier" : "suppliers"}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {n > 0 ? (
        <p className="pt-2 text-sm text-ink-3">
          Or{" "}
          <Link href={saveHref} className="rounded-sm font-medium text-brand underline decoration-1 [text-underline-position:from-font] hover:decoration-2">
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
        {failure === "busy" ? "Search is under heavy load. Try again in a moment." : "The search service did not answer."} Your filters are kept.
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
    <div role="status" aria-busy="true" aria-label="Loading suppliers" className="flex flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6">
        <SlowHead>{title ?? ""}</SlowHead>
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="mx-6 flex h-row-head items-center border-b border-line bg-subtle px-3 text-xs font-medium text-ink-3">
        <span className="w-[360px] pl-10">Supplier</span>
        <span className="w-[120px]">Type</span>
        <span className="w-[140px]">Location</span>
        <span className="w-[110px] text-right">Workers</span>
        <span className="w-[90px] text-right">Sources</span>
        <span className="flex-1 pl-6">Certificates</span>
      </div>
      <div className="mx-6" aria-hidden>
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
