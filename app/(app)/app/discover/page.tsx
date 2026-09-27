// Spec REZ-B — buyer Discover. Replaces the card grid with the dashboard kit
// (ResultsList / ResultsTable). URL is the state. /app/match redirects here
// with ?ask=1.
//
// REZ-C (§3.3): `?record=<slug>` opens that company's record as a sheet over
// these results, without losing the search. Two things make that true, and
// both are load-bearing:
//
//  * the whole search state stays in the URL, and `record` is not part of
//    `DiscoverState`, so `closeHref` is the same search the buyer was on; and
//  * every open and close is a `next/link` client navigation with
//    `scroll={false}` (§3.3's `{ scroll: false }`). Plain anchors made each one
//    a full document load, which re-ran the search and — because
//    `SelectionProvider` holds the bulk selection in React state keyed on the
//    search, which `record` does not change — silently emptied a selection the
//    buyer had built up.
//
// The sheet is the same `SupplierSheet` the full page at
// `/app/suppliers/[slug]` renders, so a deep link and an overlay never show
// two different records.
//
// The spec's parenthetical names a parallel/intercepting route
// (`@sheet/(.)suppliers/[slug]`). That is a mechanism for a PATH push; it
// cannot carry `?record=`, because Next matches parallel slots on the path and
// a query parameter never changes which slot matches. The mechanism the same
// sentence spells out — the results page reads `record` — is what is built
// here, with the client navigation that made the spec's version worth having.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, PanelFooter, PanelHeader } from "@/components/dashboard/results-panel";
import { ResultsTable } from "@/components/dashboard/results-table";
import { SearchComposer } from "@/components/dashboard/search-composer";
import { SelectionBar } from "@/components/dashboard/selection-bar";
import { SelectionProvider } from "@/components/dashboard/selection";
import { SaveRecordButton } from "@/components/dashboard/save-record-button";
import { RecordPane, SheetNotice } from "@/components/dashboard/sheet";
import { SupplierResultCard } from "@/components/dashboard/supplier-result-card";
import { SupplierSheet } from "@/components/dashboard/supplier-sheet";
import { Caption, Title } from "@/components/dashboard/type";
import { RecordRecentSearch } from "@/components/dashboard/record-recent-search";
import { ProfileReadTimeout, loadRecordLine, loadRecordSheet } from "@/lib/dashboard/load-record";
import { fetchFacilityParentSlug } from "@/lib/facility-parent-redirect";
import { ProductSheet } from "@/components/dashboard/product-sheet";
import { buildDiscoverCard, buildDiscoverTableRow } from "@/lib/dashboard/build-discover-row";
import {
  fetchDiscoverExplain,
  discoverFailureCopy,
  fetchDiscoverV32,
  fetchHsBatch,
} from "@/lib/discover-v32-rpc";
import {
  COMPOSER_HIDDEN_OMIT,
  DISCOVER_PATH,
  FILTER_HIDDEN_OMIT,
  PER_PAGE,
  SORTS,
  discoverChips,
  discoverHiddenParams,
  discoverHref,
  filterCount,
  filterFamilyLabel,
  parseDiscoverState,
  queryTitle,
  serializeDiscoverState,
  sortLabel,
  withoutFilterFamily,
  type DiscoverState,
} from "@/lib/discover-v32-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

function HiddenState({ state, omit }: { state: DiscoverState; omit: readonly string[] }) {
  return (
    <>
      {discoverHiddenParams(state, omit).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Search suppliers · SourceBD",
};

function askEnabled(): boolean {
  return process.env.AI_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY);
}

function DiscoverFilters({ state }: { state: DiscoverState }) {
  return (
    <details id="filters" className="rounded-md border border-line bg-surface px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink-strong">Add filter</summary>
      <form action={DISCOVER_PATH} method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <HiddenState state={state} omit={FILTER_HIDDEN_OMIT} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">HS heading</span>
          <input
            name="hs"
            defaultValue={state.hs.join(",")}
            placeholder="6105,6110"
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Certificate</span>
          <input
            name="cert"
            defaultValue={state.cert.map((c) => (c.state === "any" ? c.kind : `${c.kind}:${c.state}`)).join(",")}
            placeholder="gots:valid"
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Registry</span>
          <input
            name="reg"
            defaultValue={state.reg.join(",")}
            placeholder="BGMEA"
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Brand list</span>
          <input
            name="brand"
            defaultValue={state.brand.map((b) => b.replace(/^BRAND_/i, "").toLowerCase()).join(",")}
            placeholder="hm,asos"
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">District</span>
          <input
            name="district"
            defaultValue={state.district.join(",")}
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">City</span>
          <input
            name="city"
            defaultValue={state.city.join(",")}
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Type</span>
          <input
            name="type"
            defaultValue={state.type.join(",")}
            placeholder="factory"
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">Min sources</span>
          <input
            name="min_sources"
            defaultValue={state.minSources ?? ""}
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-muted">RSC</span>
          <input
            name="rsc"
            defaultValue={state.rsc ?? ""}
            placeholder="active"
            className="h-control rounded-sm border border-line-strong bg-surface px-2"
          />
        </label>
        {/* A <label> labels only its FIRST labelable descendant, so wrapping
            two inputs left the second one — the maximum, and the "to" year —
            with no accessible name at all, and gave the first a name naming
            both. Each input gets its own label. */}
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="text-ink-muted">Workers</legend>
          <span className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Workers, minimum</span>
              <input
                name="workers_min"
                inputMode="numeric"
                placeholder="min"
                defaultValue={state.workersMin ?? ""}
                className="h-control w-full rounded-sm border border-line-strong bg-surface px-2"
              />
            </label>
            <label className="flex-1">
              <span className="sr-only">Workers, maximum</span>
              <input
                name="workers_max"
                inputMode="numeric"
                placeholder="max"
                defaultValue={state.workersMax ?? ""}
                className="h-control w-full rounded-sm border border-line-strong bg-surface px-2"
              />
            </label>
          </span>
        </fieldset>
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend className="text-ink-muted">Established</legend>
          <span className="flex gap-2">
            <label className="flex-1">
              <span className="sr-only">Established, from year</span>
              <input
                name="est_from"
                inputMode="numeric"
                placeholder="from"
                defaultValue={state.estFrom ?? ""}
                className="h-control w-full rounded-sm border border-line-strong bg-surface px-2"
              />
            </label>
            <label className="flex-1">
              <span className="sr-only">Established, to year</span>
              <input
                name="est_to"
                inputMode="numeric"
                placeholder="to"
                defaultValue={state.estTo ?? ""}
                className="h-control w-full rounded-sm border border-line-strong bg-surface px-2"
              />
            </label>
          </span>
        </fieldset>
        <div className="flex items-end">
          <button type="submit" className="h-control rounded-sm border border-brand bg-brand px-3 text-sm font-medium text-brand-on">
            Apply filters
          </button>
        </div>
      </form>
    </details>
  );
}

export default async function BuyerDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const state = parseDiscoverState(sp);
  const one = (v: string | string[] | undefined): string | null =>
    (Array.isArray(v) ? v[0] : v)?.trim() || null;
  const recordSlug = one(sp.record);
  // A line drilled into from the overlay stays on this URL, so Back returns to
  // the record and Close still returns to the search. Without it, opening a
  // product line from a record opened over the results threw the search away —
  // the exact loss §3.3 exists to prevent, one level down.
  const lineCode = /^\d{4}$/.test(one(sp.line) ?? "") ? one(sp.line)! : null;
  const allLines = one(sp.lines) === "all";
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const askOn = askEnabled();
  // Closing the record is a link back to this same search, with `record`
  // dropped: `discoverHref` serializes the state and `record` is not part of
  // it, so the search survives opening and closing a record untouched.
  const closeHref = discoverHref(state);
  const withParams = (extra: string) => `${closeHref}${closeHref.includes("?") ? "&" : "?"}${extra}`;
  const recordHref = (slug: string) => withParams(`record=${encodeURIComponent(slug)}`);
  // The open record's own params. `lines=all` rides along into a line and back
  // out of it, or Back from line 9 returned to a six-tile grid without line 9.
  const recordParams = recordSlug ? `record=${encodeURIComponent(recordSlug)}${allLines ? "&lines=all" : ""}` : "";
  // Started here, awaited below: the record and the results are independent
  // reads, and awaiting this one first would have made opening a record cost
  // the search's latency plus the record's rather than the larger of the two.
  // An unknown slug renders no sheet rather than a not-found page — the search
  // behind it is still a valid answer to what the buyer asked.
  // A timed-out record read must not take the results down with it: the search
  // is still a valid answer. But it must not be silent either — the full page
  // says "could not be read in time" and offers a retry, and the overlay used
  // to leave `?record=` in the URL with nothing on screen. The reason comes
  // back so the frame can say it.
  const overlaySafe = async <T,>(p: Promise<T | null>): Promise<{ value: T | null; slow: boolean }> => {
    try {
      return { value: await p, slow: false };
    } catch (err) {
      return { value: null, slow: err instanceof ProfileReadTimeout };
    }
  };
  const recordPromise = recordSlug
    ? overlaySafe(loadRecordSheet(supabase, recordSlug, today, {
        closeHref,
        fullHref: `/app/suppliers/${recordSlug}`,
        allLines,
        allLinesHref: allLines ? null : withParams(`record=${encodeURIComponent(recordSlug)}&lines=all`),
        lineHref: (hs) => withParams(`${recordParams}&line=${hs}`),
      }))
    : Promise.resolve({ value: null, slow: false });
  const linePromise =
    recordSlug && lineCode
      ? overlaySafe(
          loadRecordLine(supabase, recordSlug, lineCode, today, {
            backHref: withParams(recordParams),
            closeHref,
          }),
        )
      : Promise.resolve({ value: null, slow: false });

  // The search and the record are independent reads and go out in one wave.
  const [{ rows, total, error, failure }, recordRead, lineRead] = await Promise.all([
    fetchDiscoverV32(supabase, state),
    recordPromise,
    linePromise,
  ]);
  const record = recordRead.value;
  const line = lineRead.value;
  // A line that is not one (unknown heading), could not be checked (EPB
  // unread) or timed out: back to the record on this search, rather than the
  // record with a dead `line=` left in the URL. (The full line page has no
  // record under it to fall back to: an unknown heading 404s there.)
  if (record && lineCode && !line) redirect(withParams(recordParams));
  // A slug that is a BUILDING of another record is not a missing record: the
  // full page 308s to the mother (601 such slugs in production). The overlay
  // rendered nothing at all, so the same input gave two different answers
  // depending on how the buyer arrived. It now offers the mother.
  const motherSlug =
    recordSlug && !record && !recordRead.slow
      ? await fetchFacilityParentSlug(supabase, recordSlug).catch(() => null)
      : null;
  const slugs = rows.map((r) => r.slug);
  // The photo strips and the saved flags both key off the rows and not off
  // each other: one wave, not two.
  const [hs, savedRows] = await Promise.all([
    fetchHsBatch(supabase, slugs),
    rows.length > 0
      ? supabase
          .from("saved_suppliers")
          .select("supplier_id")
          .in(
            "supplier_id",
            rows.map((r) => r.id),
          )
          .then((r) => r.data ?? [])
      : Promise.resolve([] as unknown[]),
  ]);
  const savedSet = new Set<string>();
  for (const r of savedRows) {
    if (r && typeof r === "object" && typeof (r as { supplier_id?: unknown }).supplier_id === "string") {
      savedSet.add((r as { supplier_id: string }).supplier_id);
    }
  }

  let explain: { dropped: string; remaining: number }[] = [];
  // Not on a past-the-end page: `total` reads 0 there for want of rows to
  // carry the count, and spending nine more RPC round-trips explaining a
  // result set that is not actually empty is wasted work on a wrong premise.
  if (!error && total === 0 && state.page === 1 && filterCount(state) > 0) {
    explain = await fetchDiscoverExplain(supabase, state);
  }

  const chips = discoverChips(state);
  const title = queryTitle(state);
  const href = discoverHref(state);
  const pages = total !== null ? Math.max(1, Math.ceil(total / state.per)) : null;

  const cards = rows.map((row) =>
    buildDiscoverCard(row, {
      today,
      hsLines: hs.lines,
      hsError: hs.error,
      saved: savedSet.has(row.id),
      recordHref,
    }),
  );
  const tableRows = rows.map((row) =>
    buildDiscoverTableRow(row, {
      today,
      hsLines: hs.lines,
      hsError: hs.error,
      saved: savedSet.has(row.id),
      recordHref,
    }),
  );

  const recordOpen = recordSlug !== null;
  return (
    // The workbench: the results column scrolls on its own, and an open record
    // is a pane beside it from `lg` — both live, nothing modal, the search
    // never lost. Below `lg` the record takes the content region and the
    // results wait in the URL; Close brings them back.
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6", recordOpen && "hidden lg:flex")}>
        <RecordRecentSearch label={title} href={href} count={total} />
        {/* The filter bar: the active filters as chips, Add filter, the go
            disc. The text lives in the topbar field, the one search box, and
            rides along here as a hidden field so the bar keeps it. */}
        <form action={DISCOVER_PATH} method="get">
          <HiddenState state={state} omit={COMPOSER_HIDDEN_OMIT} />
          {state.q ? <input type="hidden" name="q" value={state.q} /> : null}
          <SearchComposer
            // `key` and not `label`: Dhaka, Gazipur, Narayanganj and Chittagong
            // are each both a city and a district, so ?city=Dhaka&district=Dhaka
            // produced two chips with identical text — and the composer keyed on
            // the label, which is a duplicate React key and a remove link that
            // can end up attached to the wrong chip after a navigation.
            chips={chips.map((c) => ({
              key: c.key,
              label: c.label,
              code: c.code,
              removeHref: discoverHref(c.without),
            }))}
            mode={state.ask && askOn ? "ask" : "filters"}
            askEnabled={askOn}
            submits
            askHref={askOn ? discoverHref(state, { ask: true, page: 1 }) : undefined}
            filtersHref={askOn ? discoverHref(state, { ask: false, page: 1 }) : undefined}
          />
        </form>
        <DiscoverFilters state={state} />
        {/* One provider around every outcome, keyed on the search: opening or
            closing a record re-runs the search (`?record=` is a search param),
            and a re-run that FAILS used to swap the results for the error panel
            and unmount the provider, losing the selection. It now stays
            mounted, and an unread page (null) prunes nothing (cycle 11). */}
        <SelectionProvider key={serializeDiscoverState(state).toString()} pageIds={error ? null : rows.map((r) => r.id)}>
        {error ? (
          <Panel>
            <div className="px-5 py-10">
              <Title as="h1">{title}</Title>
              <Caption className="mt-2">{discoverFailureCopy(failure ?? "unavailable")}</Caption>
            </div>
          </Panel>
        ) : rows.length === 0 && state.page > 1 ? (
          // The RPC carries total_count on each row, so a page past the end
          // returns no rows and therefore no count — indistinguishable from a
          // genuinely empty result. Saying "no supplier matches" here is a lie
          // about the search; the search is fine, the page number is not.
          <Panel>
            <div className="px-5 py-10">
              <Title as="h1">{title}</Title>
              <Caption className="mt-2">
                Page {state.page} is past the end of this result set.
              </Caption>
              <p className="mt-4 text-sm">
                <Link className="underline" href={discoverHref(state, { page: 1 })}>
                  Back to the first page
                </Link>
              </p>
            </div>
          </Panel>
        ) : total === 0 ? (
          <Panel>
            <div className="px-5 py-10">
              <Title as="h1">{title}</Title>
              <Caption className="mt-2">
                {filterCount(state) === 0
                  ? "No published suppliers to show."
                  : `No supplier matches all ${filterCount(state)} filters.`}
              </Caption>
              {explain.length > 0 ? (
                <ul className="mt-4 flex flex-col gap-1 text-sm">
                  {explain
                    .slice()
                    .sort((a, b) => a.remaining - b.remaining)
                    .map((e) => {
                      // The whole family, exactly as the RPC dropped it to
                      // arrive at `remaining` — otherwise the link promises a
                      // count it does not deliver, or goes nowhere at all.
                      const without = withoutFilterFamily(state, e.dropped);
                      if (!without) return null;
                      return (
                        <li key={e.dropped}>
                          <Link href={discoverHref(without)} className="text-brand-ink">
                            Drop {filterFamilyLabel(e.dropped)} · {e.remaining} remain
                          </Link>
                        </li>
                      );
                    })}
                </ul>
              ) : null}
            </div>
          </Panel>
        ) : (
          // The provider above is keyed on the whole URL state: a new filter,
          // sort, page or view is a new page of results, and its selection
          // starts empty (selection.tsx).
          <Panel>
            <PanelHeader
              model={{
                title,
                total,
                shown: rows.length,
                firstRow: (state.page - 1) * state.per + 1,
                sortLabel: sortLabel(state.sort),
                view: state.view,
                exportHref: `/api/v1/discover/export?${serializeDiscoverState(state).toString()}`,
                saveHref: `/app/searches/new?${serializeDiscoverState({ ...state, page: 1 }).toString()}`,
                viewHref: (view) => discoverHref(state, { view, page: 1 }),
                sortOptions: SORTS.map((s) => ({
                  value: s.value,
                  label: s.label,
                  href: discoverHref(state, { sort: s.value, page: 1 }),
                })),
              }}
            />
            {state.view === "table" ? (
              <ResultsTable rows={tableRows} />
            ) : (
              <div>
                {cards.map((card) => (
                  <SupplierResultCard key={card.slug} card={card} />
                ))}
              </div>
            )}
            <PanelFooter
              shown={rows.length}
              total={total}
              perPage={state.per}
              page={state.page}
              prevHref={state.page > 1 ? discoverHref(state, { page: state.page - 1 }) : null}
              nextHref={pages && state.page < pages ? discoverHref(state, { page: state.page + 1 }) : null}
              perHrefs={PER_PAGE.map((n) => ({ n, href: discoverHref(state, { per: n, page: 1 }) }))}
            />
            <SelectionBar exportHref={`/api/v1/discover/export?${serializeDiscoverState(state).toString()}`} />
          </Panel>
        )}
        </SelectionProvider>
      </div>
      {recordOpen ? (
        recordSlug && !record ? (
          // The slug resolved to nothing. Say which nothing it was.
          <RecordPane closeHref={closeHref} openKey={`notice:${recordSlug}`}>
            {recordRead.slow ? (
              <SheetNotice
                title="This record could not be read in time"
                body="The database is under load. The company is still on SourceBD — this read simply took too long."
                // The same view again: the expanded grid and the open line with it.
                action={{ label: "Try again", href: withParams(`${recordParams}${lineCode ? `&line=${lineCode}` : ""}`) }}
                closeHref={closeHref}
              />
            ) : motherSlug ? (
              <SheetNotice
                title="That is a building, not a company record"
                body="SourceBD files this address under the company that operates it. Its record has the certificates, the registers and the export lines."
                action={{ label: "Open the company record", href: recordHref(motherSlug) }}
                closeHref={closeHref}
              />
            ) : (
              <SheetNotice
                title="No record for that link"
                body="It may have been unpublished, the link may be wrong, or it could not be read just now. Your search is still here behind this."
                closeHref={closeHref}
              />
            )}
          </RecordPane>
        ) : record ? (
          <RecordPane closeHref={closeHref} openKey={`${recordSlug}:${line ? lineCode : allLines ? "all" : ""}`}>
            {/* The line sits where the record would: one pane at a time, with
                Back to the record and Close to the search. */}
            {line ? (
              <ProductSheet model={line} />
            ) : (
              <SupplierSheet
                model={record}
                save={record.supplierId ? <SaveRecordButton supplierId={record.supplierId} saved={record.saved} /> : undefined}
              />
            )}
          </RecordPane>
        ) : null
      ) : null}
    </div>
  );
}
