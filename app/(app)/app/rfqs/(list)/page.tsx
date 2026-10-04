// /app/rfqs: the buyer's RFQs on the v4 frame (B5a, Paper `10 · RFQs list`, `· RFQ detail in
// the pane`, `11 · Quotes tab`). A table of every RFQ and draft with the best quote against the
// target; `?open=<id>` draws that RFQ in the pane beside a narrow list (a drawer under 1280),
// read with the same `rfq_get` the full page uses. An id that cannot be read is a notice in the
// pane, never a 404 on the list. `?status=` picks the tab, `?sort=ship_by` the one sort.
//
// A failed `rfq_list` is an error where the list was: "No RFQs yet" is a claim about the
// account that a failed read cannot make. In the `(list)` group so its loading state does not
// wrap `rfqs/[id]`, which answers 404 for an RFQ the caller cannot read.

import Link from "next/link";
import { ListPane } from "@/components/frame";
import { ButtonLink } from "@/components/kit";
import { PaneFrame } from "@/components/search/pane";
import { RfqDetail, RfqDetailError } from "@/components/rfqs/detail";
import type { RfqDoc } from "@/components/rfqs/doc";
import { ListHeader, PaneListHead, QuotesSwitch, RfqEmpty, RfqListError, RfqPaneRows, RfqPhoneRows, TabEmpty } from "@/components/rfqs/list";
import { loadRfqList } from "@/components/rfqs/load";
import { RfqTable } from "@/components/rfqs/table";
import { buildListItems, countOf, itemsFor, listCaption, parseRfqSort, parseRfqTab, rfqsHref, RFQ_TABS } from "@/components/rfqs/words";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "RFQs · SourceBD" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function RfqsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = parseRfqTab(one(sp.status));
  const sort = parseRfqSort(one(sp.sort));
  const openRaw = one(sp.open);
  const openId = openRaw && UUID_RE.test(openRaw) ? openRaw : openRaw ? "invalid" : null;
  const supabase = await createSupabaseServerClient();
  const today = new Date();
  const [data, opened] = await Promise.all([loadRfqList(supabase), openId && openId !== "invalid" ? supabase.rpc("rfq_get", { p_id: openId }) : Promise.resolve(null)]);
  const { rows, drafts, quotes, names, orders } = data;

  const items = rows ? buildListItems({ rows, drafts, quotes, names, orders: orders ?? [], today }) : [];
  const shown = itemsFor(items, tab, sort);
  const closeHref = rfqsHref(tab, null, sort);
  const paneOpen = openId !== null;
  const caption = rows ? listCaption(rows, drafts) : "Counts could not be read";
  const listLabel = tab === "all" ? "RFQs" : (RFQ_TABS.find((t) => t.key === tab)?.label ?? "RFQs");

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <QuotesSwitch current="rfqs" rfqs={rows ? items.length : null} orders={data.ordersTotal} />
      {rows === null ? (
        <>
          <ListHeader caption={caption} items={[]} tab={tab} sort={sort} />
          <RfqListError retryHref={closeHref} />
        </>
      ) : items.length === 0 ? (
        <RfqEmpty />
      ) : paneOpen ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col max-md:hidden">
            <PaneListHead title={listLabel} count={shown.length} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {shown.length === 0 ? <TabEmpty tab={tab === "all" ? "waiting" : tab} /> : <RfqPaneRows items={shown} tab={tab} sort={sort} currentId={openId === "invalid" ? null : openId} />}
            </div>
          </div>
          <div className="md:hidden">
            <RfqPhoneRows items={shown} />
          </div>
        </>
      ) : (
        <>
          <ListHeader caption={caption} items={items} tab={tab} sort={sort} />
          {shown.length === 0 ? (
            <TabEmpty tab={tab === "all" ? "waiting" : tab} />
          ) : (
            <>
              <div className="px-6 max-md:hidden">
                <RfqTable items={shown} tab={tab} sort={sort} />
              </div>
              <div className="md:hidden">
                <RfqPhoneRows items={shown} />
              </div>
              <p className="flex h-10 shrink-0 items-center px-6 text-sm text-ink-3 max-md:px-4">
                {shown.length} {shown.length === 1 ? "RFQ" : "RFQs"}
                {tab !== "all" ? ` · ${countOf(items, "all")} in all` : ""}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );

  const opened_ = opened as { data: unknown; error: unknown } | null;
  const rfq = opened_ && !opened_.error && opened_.data != null ? (opened_.data as RfqDoc) : null;
  const known = rows?.find((r) => r.id === openId) ?? null;
  const orderOfOpen = rfq && orders ? (orders.find((o) => o.rfq_id === rfq.id) ?? null) : null;
  const pane = !paneOpen ? null : rfq ? (
    <PaneFrame openKey={`rfq:${rfq.id}`}>
      <RfqDetail rfq={rfq} mode="pane" today={today} closeHref={closeHref} order={orderOfOpen ? { id: orderOfOpen.id } : null} />
    </PaneFrame>
  ) : opened_?.error && known ? (
    <PaneFrame openKey={`rfq-error:${known.id}`}>
      <RfqDetailError rfq={{ id: known.id, product_title: known.product_title }} mode="pane" closeHref={closeHref} retryHref={rfqsHref(tab, known.id, sort)} />
    </PaneFrame>
  ) : (
    <PaneFrame openKey={`rfq-notice:${openId}`}>
      <div data-record-pane="" tabIndex={-1} aria-label="RFQ" role="region" className="flex flex-col gap-3 p-6 outline-none">
        <h2 className="text-lg font-semibold text-ink">This RFQ could not be opened</h2>
        <p className="text-base text-ink-2">It may not be one of yours, the link may be wrong, or it could not be read just now. Your RFQs are still here behind this.</p>
        <div className="flex gap-2 pt-1">
          {opened_?.error && openId && openId !== "invalid" ? (
            <ButtonLink href={rfqsHref(tab, openId, sort)} kind="primary" prefetch={false}>
              Try again
            </ButtonLink>
          ) : null}
          <Link href={closeHref} scroll={false} prefetch={false} className="inline-flex h-control items-center rounded-sm px-3 text-base font-medium text-ink-2 hover:bg-sunken hover:text-ink">
            Close
          </Link>
        </div>
      </div>
    </PaneFrame>
  );

  return <ListPane list={list} listLabel="RFQs" pane={pane} paneTitle={rfq?.product_title ?? "RFQ"} closeHref={closeHref} />;
}
