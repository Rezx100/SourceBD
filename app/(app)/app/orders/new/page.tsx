// /app/orders/new: New order on the v4 frame (B5c, Paper `10 · New order`).
//
// Three entries:
//   * `?from_quote=<uuid>`: resolve the accepted RFQ quote server-side and pre-bind the supplier,
//     product, quantity and price (the form says where it came from and has no Change).
//   * `?supplier=<uuid>`: an order placed outside SourceBD, against a chosen supplier.
//   * neither: choose the supplier, inline: the ones the buyer asked for a price first, then their
//     saved ones, then a search. Only a published supplier that is not sanctioned reaches the form.

import { notFound, redirect } from "next/navigation";
import { ChooserPage } from "@/components/orders/chooser-page";
import { acceptHint, chooserRows } from "@/components/orders/new-model";
import { OrderForm, type OrderSeed } from "@/components/orders/new-order";
import { placeLine, type RfqDoc } from "@/components/rfqs/doc";
import { normaliseRow } from "@/components/rfqs/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECENT_RFQS = 5;

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ from_quote?: string; supplier?: string }> }) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (sp.from_quote) {
    if (!UUID_RE.test(sp.from_quote)) redirect("/app/orders");
    const { data: quote, error } = await supabase.from("rfq_quotes").select("id, rfq_id, supplier_id, unit_price, currency, status").eq("id", sp.from_quote).maybeSingle();
    if (error || !quote || quote.status !== "accepted") notFound();
    const { data: doc, error: rErr } = await supabase.rpc("rfq_get", { p_id: quote.rfq_id });
    if (rErr || doc == null) notFound();
    const rfq = doc as RfqDoc;
    const supplier = rfq.targets.find((t) => t.id === quote.supplier_id);
    if (!supplier) notFound();
    // An accepted quote starts one order. A second visit (Back, a saved link) opens that order instead of making a twin.
    // Unreadable orders change nothing here: the form still opens, as before.
    try {
      const made = await supabase.rpc("order_list", { p_status: null });
      const existing = !made.error && Array.isArray(made.data) ? (made.data as { id: string; rfq_id: string | null; supplier_id: string; status: string }[]).find((o) => o.rfq_id === quote.rfq_id && o.supplier_id === quote.supplier_id && o.status !== "cancelled") : undefined;
      if (existing) redirect(`/app/orders/${existing.id}`);
    } catch (err) {
      if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    }
    const seed: OrderSeed = { supplierName: supplier.company_name, supplierLine: placeLine(supplier.entity_type, supplier.city, supplier.district), how: { quoteId: quote.id as string } };
    return (
      <OrderForm
        seed={seed}
        prefill={{ title: rfq.product_title, quantity: String(rfq.quantity), unit: rfq.quantity_unit, price: String(quote.unit_price), currency: (quote.currency as string) ?? "USD", shipTo: rfq.ship_to_country ?? "", shipBy: rfq.ship_by ?? "" }}
        cancelHref={`/app/rfqs/${quote.rfq_id}`}
        backLabel="Back to the RFQ"
        changeHref={null}
      />
    );
  }

  if (sp.supplier) {
    if (!UUID_RE.test(sp.supplier)) redirect("/app/orders");
    const { data, error } = await supabase.from("suppliers").select("id, company_name, slug, entity_type, city, district, is_published, is_sanctioned").eq("id", sp.supplier).maybeSingle();
    if (error || !data || !data.is_published || data.is_sanctioned) notFound();
    const seed: OrderSeed = { supplierName: data.company_name as string, supplierLine: placeLine((data.entity_type as string) ?? "", (data.city as string | null) ?? null, (data.district as string | null) ?? null), how: { supplierId: data.id as string } };
    return <OrderForm seed={seed} prefill={{}} cancelHref="/app/orders" backLabel="Back to orders" changeHref="/app/orders/new" />;
  }

  // Step one. The RFQs are soft: with none read, the chooser still has saved suppliers and a search.
  let docs: RfqDoc[] = [];
  try {
    const list = await supabase.rpc("rfq_list", { p_status: null });
    const rows = !list.error && Array.isArray(list.data) ? (list.data as Record<string, unknown>[]).map(normaliseRow).filter((r) => r.viewer_role !== "supplier" && r.status !== "cancelled").slice(0, RECENT_RFQS) : [];
    const got = await Promise.all(rows.map((r) => Promise.resolve(supabase.rpc("rfq_get", { p_id: r.id })).then((x) => (!x.error && x.data ? (x.data as RfqDoc) : null), () => null)));
    docs = got.filter((d): d is RfqDoc => d !== null);
  } catch {
    docs = [];
  }
  return <ChooserPage fromRfqs={chooserRows(docs)} hint={acceptHint(docs)} total={null} />;
}
