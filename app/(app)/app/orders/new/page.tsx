// /app/orders/new — Order compose form (Spec B8).
//
// Two entry modes:
//   * `?from_quote=<uuid>` — resolve the accepted RFQ quote server-side
//     and pre-bind supplier + product + price.
//   * `?supplier=<uuid>`    — manual entry against a chosen supplier.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { OrderCreateForm, type OrderSeed } from "@/components/order-create-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ from_quote?: string; supplier?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createSupabaseServerClient();

  if (sp.from_quote) {
    if (!UUID_RE.test(sp.from_quote)) {
      redirect("/app/orders");
    }
    // The RFQ document the buyer can already fetch via `rfq_get` contains
    // every field we need (supplier metadata + quote + RFQ spec). Resolve
    // the parent RFQ id from the quote, then call `rfq_get` for the rest.
    const { data: quoteRow, error: qErr } = await supabase
      .from("rfq_quotes")
      .select("id, rfq_id, supplier_id, unit_price, currency, status")
      .eq("id", sp.from_quote)
      .maybeSingle();
    if (qErr || !quoteRow || quoteRow.status !== "accepted") {
      notFound();
    }
    const { data: rfqDoc, error: rErr } = await supabase.rpc("rfq_get", {
      p_id: quoteRow.rfq_id,
    });
    if (rErr || rfqDoc == null) {
      notFound();
    }
    const rfq = rfqDoc as {
      product_title: string;
      quantity: number;
      quantity_unit: string;
      ship_to_country: string | null;
      ship_by: string | null;
      targets: { id: string; slug: string; company_name: string }[];
    };
    const supplier = rfq.targets.find((t) => t.id === quoteRow.supplier_id);
    if (!supplier) {
      notFound();
    }
    const seed: OrderSeed = {
      mode: "from_quote",
      accepted_quote_id: quoteRow.id as string,
      supplier_id: supplier.id,
      supplier_name: supplier.company_name,
      product_title: rfq.product_title,
      quantity: rfq.quantity,
      quantity_unit: rfq.quantity_unit,
      unit_price: quoteRow.unit_price as number,
      currency: (quoteRow.currency as string) ?? "USD",
      ship_to_country: rfq.ship_to_country,
      target_ship_date: rfq.ship_by,
    };
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader
          kicker="Buyer"
          title="New order"
          actions={
            <Link href={`/app/rfqs/${quoteRow.rfq_id}`} className="btn-proto">
              ← Back to RFQ
            </Link>
          }
        />
        <OrderCreateForm seed={seed} />
      </div>
    );
  }

  if (sp.supplier) {
    if (!UUID_RE.test(sp.supplier)) {
      redirect("/app/orders");
    }
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, company_name, slug, is_published, is_sanctioned")
      .eq("id", sp.supplier)
      .maybeSingle();
    if (error || !data || !data.is_published || data.is_sanctioned) {
      notFound();
    }
    const seed: OrderSeed = {
      mode: "manual",
      supplier_id: data.id as string,
      supplier_name: data.company_name as string,
    };
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader
          kicker="Buyer"
          title="New order"
          actions={
            <Link href={`/app/suppliers/${data.slug}`} className="btn-proto">
              ← Back to profile
            </Link>
          }
        />
        <OrderCreateForm seed={seed} />
      </div>
    );
  }

  // No seed — point the buyer to Discover. Manual creation requires a
  // supplier id, which the buyer picks from a supplier profile or by
  // accepting an RFQ quote.
  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="proto-card space-y-3 text-center">
        <h1 className="font-display text-2xl font-light tracking-tight text-ink-primary">
          Pick a supplier first
        </h1>
        <p className="affiliation-disclaimer">
          Open a supplier profile from Discover and use &quot;Create
          order&quot; — or accept an RFQ quote to seed an order automatically.
        </p>
        <div className="flex justify-center gap-2">
          <Link href="/app/discover" className="btn-proto">
            Browse Discover
          </Link>
          <Link href="/app/rfqs" className="btn-proto">
            View RFQs
          </Link>
        </div>
      </div>
    </div>
  );
}
