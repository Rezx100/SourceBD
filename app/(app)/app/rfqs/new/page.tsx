// /app/rfqs/new — RFQ compose form (Spec B7).
//
// Requires `?supplier=<uuid>`. The form is single-target; multi-supplier
// RFQs go through the API directly (the form only supports one supplier
// today). Resolves the supplier name server-side from `public.suppliers`
// so the form header shows the company.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RfqCreateForm } from "@/components/rfq-create-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function NewRfqPage({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string }>;
}) {
  const sp = await searchParams;
  const supplierId = sp.supplier;
  if (!supplierId || !UUID_RE.test(supplierId)) {
    redirect("/app/discover");
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, company_name, slug, is_published, is_sanctioned")
    .eq("id", supplierId)
    .maybeSingle();
  if (error || !data || !data.is_published || data.is_sanctioned) {
    notFound();
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-ink-tertiary">
            Buyer
          </p>
          <h1 className="font-display text-3xl font-light tracking-tight text-ink-primary">
            Compose RFQ
          </h1>
        </div>
        <Link href={`/app/suppliers/${data.slug}`} className="btn-proto">
          ← Back to profile
        </Link>
      </div>
      <RfqCreateForm
        supplierId={data.id as string}
        supplierName={data.company_name as string}
      />
    </div>
  );
}
