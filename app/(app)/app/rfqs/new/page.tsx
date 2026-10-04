// /app/rfqs/new — the RFQ composer as a page, for a deep link. Inside the
// shell the composer opens in the pane beside the results or the record
// (`/app/discover?rfq=…`); this route draws the same composer filling the
// content region, so a link from an email or a product still lands somewhere
// that works. Takes `?supplier=<uuid>[,<uuid>…]` (none opens an empty composer); `&hs=NNNN` prefills the
// line a buyer came from; `&product=<uuid>` one of their own products;
// `?draft=<uuid>` reopens a saved draft with its suppliers, fields, message
// and questions (read through `rfq_draft_get`, which answers only the owner).
//
// Product truth: an unpublished supplier is not drawn at all. A sanctioned one
// is drawn under the sanction banner with Send disabled, so the buyer sees why;
// the server refuses it either way (`rfq_create`).

import { notFound } from "next/navigation";

import type { ComposerPrefill } from "@/components/dashboard/rfq-composer";
import { RfqComposer } from "@/components/rfqs/composer";
import { TARGET_COLUMNS, targetFromRow, workspaceFrom, type SupplierRow } from "@/lib/dashboard/composer-target";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** One of the buyer's own products, when the composer starts from it. Read through its RPC; absent until the product base ships. */
async function productPrefill(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, id: string): Promise<ComposerPrefill> {
  const { data, error } = await supabase.rpc("buyer_product_get", { p_id: id });
  if (error || !data || typeof data !== "object") return {};
  const p = data as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : null);
  return {
    productId: id,
    title: str(p.name),
    description: str(p.description),
    quantity: num(p.moq),
    targetPrice: num(p.price_usd),
    currency: "USD",
  };
}

/** A saved draft, when it is the caller's: its targets and the composer's fields. Null when the read fails or the draft is not theirs. */
async function draftPrefill(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  id: string,
): Promise<{ targets: string[]; prefill: ComposerPrefill } | null> {
  const { data, error } = await supabase.rpc("rfq_draft_get", { p_id: id });
  if (error || !data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const p = (d.payload && typeof d.payload === "object" ? d.payload : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? String(v) : str(v));
  const targets = Array.isArray(d.target_supplier_ids) ? d.target_supplier_ids.filter((x): x is string => typeof x === "string") : [];
  return {
    targets,
    prefill: {
      title: str(p.product_title),
      description: str(p.product_description),
      quantity: num(p.quantity),
      unit: str(p.quantity_unit),
      targetPrice: num(p.target_unit_price),
      currency: str(p.currency),
      shipTo: str(p.ship_to_country),
      shipBy: str(p.ship_by),
      productId: str(p.product_id),
      message: str(p.message),
      questions: Array.isArray(p.questions) ? p.questions.filter((q): q is string => typeof q === "string") : null,
    },
  };
}

export default async function NewRfqPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; hs?: string; product?: string; draft?: string }>;
}) {
  const sp = await searchParams;
  const draftId = typeof sp.draft === "string" && UUID_RE.test(sp.draft) ? sp.draft : null;
  const supabase = await createSupabaseServerClient();
  const draft = draftId ? await draftPrefill(supabase, draftId) : null;
  const ids = [
    ...new Set([...(sp.supplier ?? "").split(","), ...(draft?.targets ?? [])].map((x) => x.trim()).filter((x) => UUID_RE.test(x))),
  ].slice(0, 50);
  const hs = typeof sp.hs === "string" && /^\d{4}$/.test(sp.hs) ? sp.hs : null;
  const productId = typeof sp.product === "string" && UUID_RE.test(sp.product) ? sp.product : null;
  // No supplier is not a bad link: the composer opens empty and says how to add some ("New RFQ"
  // on the RFQ list lands here). Only suppliers that are all unlisted are a bad link, below.
  const [{ data, error }, settings, product] = await Promise.all([
    ids.length > 0
      ? supabase
          .from("suppliers")
          .select(TARGET_COLUMNS)
          .in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    (async () => {
      try {
        return (await supabase.rpc("settings_get")).data as unknown;
      } catch {
        return null;
      }
    })(),
    productId ? productPrefill(supabase, productId) : Promise.resolve<ComposerPrefill>({}),
  ]);
  const rows = ((Array.isArray(data) ? data : []) as SupplierRow[]).filter((r) => r.is_published);
  // A link to suppliers none of whom is listed is a bad link. A saved draft
  // whose suppliers have since left is still the buyer's draft: it opens with
  // no targets, and they add new ones.
  if (error || (!draft && ids.length > 0 && rows.length === 0)) {
    notFound();
  }
  const targets = ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is SupplierRow => Boolean(r)).map(targetFromRow);
  const prefill: ComposerPrefill = draft ? draft.prefill : hs ? { hs, title: `HS ${hs} · ${hsBuyerLabel(hs, null)}` } : product;
  // One supplier: Close returns to its record. Several, or a product: the RFQ list.
  const closeHref = targets.length === 1 ? `/app/suppliers/${targets[0]!.slug}` : "/app/rfqs";
  return (
    <RfqComposer
      targets={targets}
      prefill={prefill}
      workspace={workspaceFrom(settings)}
      closeHref={draft ? "/app/rfqs" : closeHref}
      backLabel={!draft && targets.length === 1 ? `Back to ${targets[0]!.name}` : "Back to RFQs"}
      mode="page"
      draftId={draft ? draftId : null}
    />
  );
}
