// The RFQ composer in a list's pane (the search, Saved): for one supplier or the ticked selection,
// published targets only, in the order they were ticked, and the workspace's template. Read inside
// the page's own Suspense boundary so the pane's silhouette paints with the list. Every door to the
// composer opens it here, beside the list (critique of 8 Oct 2026, item 2); `/app/rfqs/new` stays
// for deep links and drafts.

import { RfqComposer } from "@/components/rfqs/composer";
import type { ComposerTarget, ComposerWorkspace } from "@/components/rfqs/composer-model";
import { PaneFrame } from "@/components/search/pane";
import { TARGET_COLUMNS, targetFromRow, workspaceFrom, type SupplierRow } from "@/lib/dashboard/composer-target";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `?rfq=<id,id,...>` as a list page reads it: ids only, each once, at most 50. */
export function parseRfqIds(raw: string | string[] | undefined): string[] {
  const v = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return [...new Set(v.split(",").map((x) => x.trim()).filter((x) => UUID_RE.test(x)))].slice(0, 50);
}

export async function ComposerPane({
  supabase,
  rfqIds,
  prefillHs = null,
  closeHref,
  backHref = null,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the Supabase server client.
  supabase: any;
  rfqIds: string[];
  prefillHs?: string | null;
  closeHref: string;
  backHref?: string | null;
}) {
  const [targets, workspace] = await Promise.all([
    (async (): Promise<ComposerTarget[]> => {
      const r = await supabase.from("suppliers").select(TARGET_COLUMNS).in("id", rfqIds);
      const rows = (Array.isArray(r.data) ? r.data : []) as SupplierRow[];
      // An unpublished id is dropped rather than drawn as a target the server would refuse.
      return rfqIds.map((id) => rows.find((x) => x.id === id)).filter((x): x is SupplierRow => Boolean(x && x.is_published)).map(targetFromRow);
    })(),
    (async (): Promise<ComposerWorkspace | null> => {
      try {
        const r = await supabase.rpc("settings_get");
        return workspaceFrom(r.data);
      } catch {
        return null;
      }
    })(),
  ]);
  return (
    <PaneFrame openKey={`rfq:${rfqIds.join(",")}`}>
      <RfqComposer
        targets={targets}
        workspace={workspace}
        prefill={prefillHs ? { hs: prefillHs, title: `HS ${prefillHs} · ${hsBuyerLabel(prefillHs, null)}` } : {}}
        closeHref={closeHref}
        backHref={backHref}
      />
    </PaneFrame>
  );
}
