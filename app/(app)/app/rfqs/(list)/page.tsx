// /app/rfqs — the buyer's RFQ list (Spec B7, handoff §3.7), a workbench.
//
// Server component. Calls `public.rfq_list()` under the caller's session once,
// unfiltered, so the status tabs can count every row; `?status=` picks the
// tab (or the drafts). `?open=<id>` draws that RFQ beside the list in a pane,
// read with the same `rfq_get` the full page uses; the table narrows beside
// it, and below `lg` the pane takes the region. An id that cannot be read is
// a notice in the pane, never a 404 on the list.
//
// In the `(list)` group so its loading state does not wrap `rfqs/[id]`.

import { RecordPane, ResultsColumn, SheetNotice, Workbench } from "@/components/dashboard/sheet";
import { RfqDetailBody, RfqListBody, parseRfqTab, rfqsHref, type RfqDoc, type RfqDraft, type RfqRow } from "@/components/dashboard/rfq-pages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RfqsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; open?: string | string[] }>;
}) {
  const sp = await searchParams;
  const tab = parseRfqTab(one(sp.status));
  const openId = one(sp.open)?.trim() || null;
  const supabase = await createSupabaseServerClient();
  const [list, drafts, opened] = await Promise.all([
    supabase.rpc("rfq_list", { p_status: null }),
    // Soft: `rfq_draft_list` is new, and until it exists (or when it fails)
    // the list simply shows no drafts rather than failing.
    Promise.resolve(supabase.rpc("rfq_draft_list")).then(
      (r) => (!r.error && Array.isArray(r.data) ? (r.data as RfqDraft[]) : []),
      () => [] as RfqDraft[],
    ),
    openId ? supabase.rpc("rfq_get", { p_id: openId }) : Promise.resolve(null),
  ]);
  const rows: RfqRow[] | null = list.error ? null : ((list.data as RfqRow[] | null) ?? []);
  const rfq = opened && !opened.error && opened.data != null ? (opened.data as RfqDoc) : null;
  const closeHref = rfqsHref(tab);

  return (
    // The workbench: the list scrolls in its own column, and an open RFQ
    // sits beside it from `lg`; below that it takes the region and Close
    // brings the list back.
    <Workbench>
      <ResultsColumn besideRecord={openId !== null}>
        <RfqListBody rows={rows} drafts={drafts} tab={tab} today={new Date()} openId={openId} />
      </ResultsColumn>
      {openId !== null ? (
        <RecordPane closeHref={closeHref} openKey={`${rfq ? "rfq" : "notice"}:${openId}`}>
          {rfq ? (
            <RfqDetailBody rfq={rfq} list={[]} mode="pane" closeHref={closeHref} />
          ) : (
            <SheetNotice
              label="RFQ"
              title="This RFQ could not be opened"
              body="It may not be one of yours, the link may be wrong, or it could not be read just now. Your RFQs are still here behind this."
              closeHref={closeHref}
            />
          )}
        </RecordPane>
      ) : null}
    </Workbench>
  );
}
