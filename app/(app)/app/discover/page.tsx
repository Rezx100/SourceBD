// Spec REZ-B — buyer Discover, rebuilt as the workbench of the one-viewport
// shell (enterprise pass, 27 Sep 2026). URL is the state; the results column
// scrolls on its own; everything secondary opens in the pane beside it and
// closes back to the same search:
//
//   ?record=<slug>            the record (REZ-C §3.3), and `&line=NNNN` one of its lines
//   ?rfq=<id,id,…>            the RFQ composer, for one supplier or the ticked selection
//   ?filters=1                the filter pane
//   ?save=1                   the save-search pane
//   ?sent=<rfq id>            the toast after a send, on the search the buyer was on
//   ?d=compact|comfortable    the row density of the ledger grid
//
// Two things make "never lose the search" true, and both are load-bearing:
// the whole search state stays in the URL and none of the pane parameters is
// part of `DiscoverState`, so a pane's Close is the same search; and every
// open and close is a `next/link` client navigation with `scroll={false}`,
// so the bulk selection (React state keyed on the search) survives.

import Link from "next/link";
import { redirect } from "next/navigation";
import { DiscoverFilters } from "@/components/dashboard/discover-filters";
import { Panel, PanelFooter, PanelHeader } from "@/components/dashboard/results-panel";
import { ResultsTable, type ResultsDensity, type ResultsSortKey } from "@/components/dashboard/results-table";
import { RfqComposer, type ComposerTarget, type ComposerWorkspace } from "@/components/dashboard/rfq-composer";
import { TARGET_COLUMNS, targetFromRow, workspaceFrom, type SupplierRow } from "@/lib/dashboard/composer-target";
import { SaveSearchForm } from "@/components/dashboard/save-search-form";
import { SearchComposer } from "@/components/dashboard/search-composer";
import { SelectionBar } from "@/components/dashboard/selection-bar";
import { SelectionProvider } from "@/components/dashboard/selection";
import { SaveRecordButton } from "@/components/dashboard/save-record-button";
import { RecordPane, ResultsColumn, Sheet, SheetBar, SheetNotice, SheetScroll } from "@/components/dashboard/sheet";
import { SupplierResultCard } from "@/components/dashboard/supplier-result-card";
import { SupplierSheet } from "@/components/dashboard/supplier-sheet";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { Toast } from "@/components/dashboard/toast";
import { Caption, Label, Title } from "@/components/dashboard/type";
import { RecordRecentSearch } from "@/components/dashboard/record-recent-search";
import { ProfileReadTimeout, loadRecordLine, loadRecordSheet } from "@/lib/dashboard/load-record";
import { fetchFacilityParentSlug } from "@/lib/facility-parent-redirect";
import { ProductSheet } from "@/components/dashboard/product-sheet";
import { buildDiscoverCard, buildDiscoverTableRow } from "@/lib/dashboard/build-discover-row";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import { fetchDiscoverExplain, discoverFailureCopy, fetchDiscoverV32, fetchHsBatch } from "@/lib/discover-v32-rpc";
import {
  COMPOSER_HIDDEN_OMIT,
  DISCOVER_PATH,
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The sort key a ledger column orders by, and which way the arrow points. */
const COLUMN_SORT: Record<ResultsSortKey, string> = { name: "name", sources: "sources", cert_expiry: "cert_expiry", hs_lines: "hs_lines", workers: "workers" };
const SORT_DIR: Record<string, "asc" | "desc"> = { name: "asc", cert_expiry: "asc", established: "asc" };

export default async function BuyerDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const state = parseDiscoverState(sp);
  const one = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? v[0] : v)?.trim() || null;
  const recordSlug = one(sp.record);
  const lineCode = /^\d{4}$/.test(one(sp.line) ?? "") ? one(sp.line)! : null;
  const allLines = one(sp.lines) === "all";
  const densityRaw = one(sp.d);
  const density: ResultsDensity = densityRaw === "compact" || densityRaw === "comfortable" ? densityRaw : "default";
  const rfqIds = [...new Set((one(sp.rfq) ?? "").split(",").map((x) => x.trim()).filter((x) => UUID_RE.test(x)))].slice(0, 50);
  const composerOpen = rfqIds.length > 0;
  const prefillHs = /^\d{4}$/.test(one(sp.hs_line) ?? "") ? one(sp.hs_line)! : null;
  const filtersOpen = !composerOpen && one(sp.filters) === "1";
  const saveOpen = !composerOpen && !filtersOpen && one(sp.save) === "1";
  const sentId = UUID_RE.test(one(sp.sent) ?? "") ? one(sp.sent)! : null;
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const askOn = askEnabled();

  // Every pane's Close is this same search: `discoverHref` serializes the
  // state and none of the pane parameters is part of it. The row density is
  // the buyer's view, not the search, so it rides on every pane link and Close
  // rather than resetting when a record opens.
  const searchHref = discoverHref(state);
  const withDensity = (d: ResultsDensity) => (d === "default" ? searchHref : `${searchHref}${searchHref.includes("?") ? "&" : "?"}d=${d}`);
  const closeHref = withDensity(density);
  const withParams = (extra: string) => (extra ? `${closeHref}${closeHref.includes("?") ? "&" : "?"}${extra}` : closeHref);
  const recordHref = (slug: string) => withParams(`record=${encodeURIComponent(slug)}`);
  const recordParams = recordSlug ? `record=${encodeURIComponent(recordSlug)}${allLines ? "&lines=all" : ""}` : "";
  // The composer opens on the search, keeping the record it came from behind
  // it so Close returns to the record and not only to the search.
  const rfqHref = (id: string) => withParams(`${recordParams ? `${recordParams}&` : ""}rfq=${encodeURIComponent(id)}`);
  const lineRfqHref = (id: string, hs: string) => withParams(`${recordParams ? `${recordParams}&` : ""}rfq=${encodeURIComponent(id)}&hs_line=${hs}`);

  const overlaySafe = async <T,>(p: Promise<T | null>): Promise<{ value: T | null; slow: boolean }> => {
    try {
      return { value: await p, slow: false };
    } catch (err) {
      return { value: null, slow: err instanceof ProfileReadTimeout };
    }
  };
  const recordPromise =
    recordSlug && !composerOpen
      ? overlaySafe(
          loadRecordSheet(supabase, recordSlug, today, {
            closeHref,
            fullHref: `/app/suppliers/${recordSlug}`,
            allLines,
            allLinesHref: allLines ? null : withParams(`record=${encodeURIComponent(recordSlug)}&lines=all`),
            lineHref: (hs) => withParams(`${recordParams}&line=${hs}`),
            rfqHref,
          }),
        )
      : Promise.resolve({ value: null, slow: false });
  const linePromise =
    recordSlug && lineCode && !composerOpen
      ? overlaySafe(
          loadRecordLine(supabase, recordSlug, lineCode, today, {
            backHref: withParams(recordParams),
            closeHref,
            rfqHref: lineRfqHref,
          }),
        )
      : Promise.resolve({ value: null, slow: false });
  // The composer's targets and the buyer's workspace, only when it is open.
  const targetsPromise: Promise<ComposerTarget[]> = composerOpen
    ? (async () => {
        const r = await supabase
          .from("suppliers")
          .select(TARGET_COLUMNS)
          .in("id", rfqIds);
        const rows = (Array.isArray(r.data) ? r.data : []) as SupplierRow[];
        // In the order they were ticked, published only: an unpublished id is
        // dropped rather than drawn as a target the server would refuse.
        return rfqIds.map((id) => rows.find((x) => x.id === id)).filter((x): x is SupplierRow => Boolean(x && x.is_published)).map(targetFromRow);
      })()
    : Promise.resolve([]);
  const workspacePromise: Promise<ComposerWorkspace | null> = composerOpen
    ? (async () => {
        try {
          const r = await supabase.rpc("settings_get");
          return workspaceFrom(r.data);
        } catch {
          return null;
        }
      })()
    : Promise.resolve(null);

  const [{ rows, total, error, failure }, recordRead, lineRead, targets, workspace] = await Promise.all([
    fetchDiscoverV32(supabase, state),
    recordPromise,
    linePromise,
    targetsPromise,
    workspacePromise,
  ]);
  const record = recordRead.value;
  const line = lineRead.value;
  if (record && lineCode && !line) redirect(withParams(recordParams));
  const motherSlug =
    recordSlug && !composerOpen && !record && !recordRead.slow ? await fetchFacilityParentSlug(supabase, recordSlug).catch(() => null) : null;
  const slugs = rows.map((r) => r.slug);
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
  if (!error && total === 0 && state.page === 1 && filterCount(state) > 0) {
    explain = await fetchDiscoverExplain(supabase, state);
  }

  const chips = discoverChips(state);
  const title = queryTitle(state);
  const href = discoverHref(state);
  const pages = total !== null ? Math.max(1, Math.ceil(total / state.per)) : null;
  const rowOpts = { today, hsLines: hs.lines, hsError: hs.error, recordHref, rfqHref };
  const cards = rows.map((row) => buildDiscoverCard(row, { ...rowOpts, saved: savedSet.has(row.id) }));
  const tableRows = rows.map((row) => buildDiscoverTableRow(row, { ...rowOpts, saved: savedSet.has(row.id) }));

  const paneOpen = composerOpen || filtersOpen || saveOpen || recordSlug !== null;
  const exportHref = `/api/v1/discover/export?${serializeDiscoverState(state).toString()}`;

  return (
    // The workbench: the results column scrolls on its own, and a pane sits
    // beside it from `lg` — both live, nothing modal, the search never lost.
    // Below `lg` the pane takes the content region and the results wait in
    // the URL; Close brings them back.
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
      <ResultsColumn besideRecord={paneOpen}>
        <RecordRecentSearch label={title} href={href} count={total} />
        <form action={DISCOVER_PATH} method="get">
          <HiddenState state={state} omit={COMPOSER_HIDDEN_OMIT} />
          {state.q ? <input type="hidden" name="q" value={state.q} /> : null}
          <SearchComposer
            chips={chips.map((c) => ({ key: c.key, label: c.label, code: c.code, removeHref: discoverHref(c.without) }))}
            mode={state.ask && askOn ? "ask" : "filters"}
            askEnabled={askOn}
            submits
            filtersHref={withParams("filters=1")}
            askHref={askOn ? discoverHref(state, { ask: true, page: 1 }) : undefined}
            filtersModeHref={askOn ? discoverHref(state, { ask: false, page: 1 }) : undefined}
          />
        </form>
        <SelectionProvider key={serializeDiscoverState(state).toString()} pageIds={error ? null : rows.map((r) => r.id)}>
          {error ? (
            <Panel>
              <div className="px-5 py-10">
                <Title as="h1">{title}</Title>
                <Caption className="mt-2">{discoverFailureCopy(failure ?? "unavailable")}</Caption>
              </div>
            </Panel>
          ) : rows.length === 0 && state.page > 1 ? (
            <Panel>
              <div className="px-5 py-10">
                <Title as="h1">{title}</Title>
                <Caption className="mt-2">Page {state.page} is past the end of this result set.</Caption>
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
                  {filterCount(state) === 0 ? "No published suppliers to show." : `No supplier matches all ${filterCount(state)} filters.`}
                </Caption>
                {explain.length > 0 ? (
                  <ul className="mt-4 flex flex-col gap-1 text-sm">
                    {explain
                      .slice()
                      .sort((a, b) => a.remaining - b.remaining)
                      .map((e) => {
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
            <Panel>
              <PanelHeader
                as={!composerOpen && !filtersOpen && !saveOpen && recordSlug !== null ? "h2" : "h1"}
                model={{
                  title,
                  total,
                  shown: rows.length,
                  firstRow: (state.page - 1) * state.per + 1,
                  sortLabel: sortLabel(state.sort),
                  view: state.view,
                  exportHref,
                  saveHref: withParams("save=1"),
                  viewHref: (view) => discoverHref(state, { view, page: 1 }),
                  sortOptions: SORTS.map((s) => ({ value: s.value, label: s.label, href: discoverHref(state, { sort: s.value, page: 1 }), active: s.value === state.sort })),
                  densityOptions: (["compact", "default", "comfortable"] as const).map((d) => ({
                    value: d,
                    label: d === "default" ? "Default" : d === "compact" ? "Compact" : "Comfortable",
                    href: withDensity(d),
                    active: d === density,
                  })),
                }}
              />
              {state.view === "table" ? (
                <ResultsTable
                  rows={tableRows}
                  currentSlug={recordSlug}
                  compact={paneOpen}
                  density={density}
                  sort={{ key: state.sort, dir: SORT_DIR[state.sort] ?? "desc" }}
                  sortHrefs={Object.fromEntries(
                    (Object.keys(COLUMN_SORT) as ResultsSortKey[]).map((key) => [key, discoverHref(state, { sort: COLUMN_SORT[key] as DiscoverState["sort"], page: 1 })]),
                  ) as Record<ResultsSortKey, string>}
                />
              ) : (
                <div>
                  {cards.map((card) => (
                    <SupplierResultCard key={card.slug} card={{ ...card, selected: card.slug === recordSlug ? true : card.selected }} />
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
              <SelectionBar exportHref={exportHref} searchHref={closeHref} />
            </Panel>
          )}
        </SelectionProvider>
      </ResultsColumn>

      {composerOpen ? (
        <RecordPane closeHref={recordParams ? withParams(recordParams) : closeHref} openKey={`rfq:${rfqIds.join(",")}`} wide>
          <RfqComposer
            targets={targets}
            workspace={workspace}
            prefill={prefillHs ? { hs: prefillHs, title: `HS ${prefillHs} · ${hsBuyerLabel(prefillHs, null)}` } : {}}
            closeHref={recordParams ? withParams(recordParams) : closeHref}
            backHref={recordParams ? withParams(recordParams) : null}
            addHref={closeHref}
          />
        </RecordPane>
      ) : filtersOpen ? (
        <RecordPane closeHref={closeHref} openKey="filters">
          <DiscoverFilters state={state} closeHref={closeHref} />
        </RecordPane>
      ) : saveOpen ? (
        <RecordPane closeHref={closeHref} openKey="save">
          <Sheet label="Save this search">
            <SheetBar>
              <Button variant="ghost" icon size="sm" aria-label="Close" href={closeHref} clientNav scroll={false}>
                <Icon name="x" />
              </Button>
              <Label className="text-ink-strong">Save this search</Label>
              <Caption className="min-w-0 [overflow-wrap:anywhere]">{title}</Caption>
            </SheetBar>
            <SheetScroll>
              <div className="flex flex-col gap-4 p-6">
                <p className="m-0 max-w-prose text-sm text-ink-muted">
                  The search keeps its filters and sort, not its page. Its count refreshes when you open it from Saved searches.
                </p>
                <SaveSearchForm search={serializeDiscoverState({ ...state, page: 1 }).toString()} defaultName={title} nextHref={withParams("saved=1")} />
              </div>
            </SheetScroll>
          </Sheet>
        </RecordPane>
      ) : recordSlug ? (
        !record ? (
          <RecordPane closeHref={closeHref} openKey={`notice:${recordSlug}`}>
            {recordRead.slow ? (
              <SheetNotice
                title="This record could not be read in time"
                body="The database is under load. The company is still on SourceBD — this read simply took too long."
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
        ) : (
          <RecordPane closeHref={closeHref} openKey={`${recordSlug}:${line ? lineCode : allLines ? "all" : ""}`}>
            {line ? (
              <ProductSheet model={line} />
            ) : (
              <SupplierSheet
                model={record}
                save={record.supplierId ? <SaveRecordButton supplierId={record.supplierId} saved={record.saved} /> : undefined}
              />
            )}
          </RecordPane>
        )
      ) : null}

      {sentId ? <Toast text="RFQ sent" link={{ href: `/app/rfqs/${sentId}`, label: "Open the RFQ" }} href={null} /> : null}
      {one(sp.saved) === "1" ? <Toast text="Search saved" link={{ href: "/app/searches", label: "Saved searches" }} href={null} /> : null}
    </div>
  );
}
