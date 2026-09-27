// /app/rfqs/new — RFQ compose form (Spec B7).
//
// Requires `?supplier=<uuid>`. The form is single-target; multi-supplier
// RFQs go through the API directly (the form only supports one supplier
// today). Resolves the supplier name server-side from `public.suppliers`
// so the rail beside the form shows the company.

import { notFound, redirect } from "next/navigation";

import { RfqCreateForm } from "@/components/rfq-create-form";
import { Button } from "@/components/dashboard/controls";
import { Icon } from "@/components/dashboard/icons";
import { PageHeader, PageSection, Page } from "@/components/dashboard/page";
import { Caption } from "@/components/dashboard/type";
import { hsBuyerLabel } from "@/lib/epb-hscode-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function NewRfqPageBody({
  searchParams,
}: {
  searchParams: Promise<{ supplier?: string; hs?: string }>;
}) {
  const sp = await searchParams;
  const supplierId = sp.supplier;
  // `&hs=` comes from the product line's "Send RFQ for this line" (§3.4). It
  // was emitted and silently dropped here, so the composer opened empty while
  // the model's own comment said the line was prefilled.
  const hs = typeof sp.hs === "string" && /^\d{4}$/.test(sp.hs) ? sp.hs : null;
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        title="New RFQ"
        caption="Quotes come back to this RFQ, where you can compare and accept them."
        actions={
          <Button href={`/app/suppliers/${data.slug}`} clientNav variant="ghost">
            <Icon name="chev-l" /> Back to profile
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        <PageSection title="Supplier" caption="1" className="lg:sticky lg:top-4">
          <div className="flex items-start gap-3 px-4 py-3">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-sm bg-surface-sunken text-ink-muted">
              <Icon name="building" />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium text-ink-strong [overflow-wrap:anywhere]">{data.company_name as string}</span>
              <Caption>This RFQ goes to this supplier only.</Caption>
            </span>
          </div>
        </PageSection>
        <RfqCreateForm
          supplierId={data.id as string}
          supplierName={data.company_name as string}
          initialTitle={hs ? `HS ${hs} · ${hsBuyerLabel(hs, null)}` : undefined}
        />
      </div>
    </div>
  );
}

export default async function NewRfqPage(props: Parameters<typeof NewRfqPageBody>[0]) {
  return <Page>{await NewRfqPageBody(props)}</Page>;
}
