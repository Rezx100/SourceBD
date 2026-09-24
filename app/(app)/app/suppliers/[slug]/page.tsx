// REZ-C (handoff §3.3) — the buyer's company profile, rebuilt on the
// dashboard kit. One component, `SupplierSheet`, serves both this full page
// (deep link, refresh, share) and the overlay over the results
// (`/app/discover?record=<slug>`); `closeHref` is the only thing that differs.
//
// This replaces the FE-PROTO profile page. The public anonymous route
// `(public)/suppliers/[slug]` is a separate surface and is untouched.
//
// Contact PII hard contract (agent-brief, code-standards): the sheet receives
// COUNTS from `supplier_contact_counts` (0105) and no value. There is nothing
// in the payload to un-blur, and `components/dashboard/render.test.ts` asserts
// that none of `email_primary` / `phones` / `contact_name` / `contact_role`
// reaches the HTML.
//
// SBI hard contract (ai-workflow-rules): `buyer_supplier_profile` does not
// join `sbi_scores` and nothing here renders a score.
//
// Dropped from the page this replaces: the admin-only contact unlock (I-004),
// which selected the contact columns directly for `role === "admin"`. The
// approved record card is counts-only, and an admin-only reveal inside the one
// page whose boundary test is "no contact value in the HTML" makes that guard
// conditional. It belongs on `/admin/suppliers/[id]`, which does not have it
// today — see the PR description.

import { notFound, permanentRedirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { SaveRecordButton } from "@/components/dashboard/save-record-button";
import { SheetFrame } from "@/components/dashboard/sheet";
import { SupplierSheet } from "@/components/dashboard/supplier-sheet";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { loadRecordSheet } from "@/lib/dashboard/load-record";
import {
  fetchFacilityParentSlug,
  resolveUnpublishedProfileMiss,
} from "@/lib/facility-parent-redirect";
import { urlOnSite } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupplierRecordPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const [shell, model] = await Promise.all([
    loadBuyerShell(supabase, `/app/suppliers/${slug}`),
    loadRecordSheet(supabase, slug, new Date()),
  ]);

  if (!model) {
    // A building's slug is not a record of its own: it redirects to the mother
    // it belongs to, exactly as the page this replaces did.
    const parentSlug = await fetchFacilityParentSlug(supabase, slug).catch(() => null);
    const miss = resolveUnpublishedProfileMiss({ profileFound: false, parentSlug, routeGroup: "app" });
    if (miss.action === "redirect") permanentRedirect(urlOnSite(miss.path).toString());
    notFound();
  }

  return (
    <AppShell sidebar={shell.sidebar} topbar={shell.topbar} mainId="main-content" screenLabel="Supplier record">
      <SheetFrame overlay={false}>
        <SupplierSheet
          model={model}
          dialog={false}
          save={model.supplierId ? <SaveRecordButton supplierId={model.supplierId} saved={model.saved} /> : undefined}
        />
      </SheetFrame>
    </AppShell>
  );
}
