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

import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { AppShell } from "@/components/dashboard/app-shell";
import { SaveRecordButton } from "@/components/dashboard/save-record-button";
import { SheetFrame } from "@/components/dashboard/sheet";
import { SupplierSheet } from "@/components/dashboard/supplier-sheet";
import { Caption, Title } from "@/components/dashboard/type";
import { loadBuyerShell } from "@/lib/dashboard/load-buyer-shell";
import { ProfileReadTimeout, loadRecordSheet } from "@/lib/dashboard/load-record";
import {
  fetchFacilityParentSlug,
  resolveUnpublishedProfileMiss,
} from "@/lib/facility-parent-redirect";
import { urlOnSite } from "@/lib/site-origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupplierRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  // `?lines=all` expands the six-tile grid to every heading the record exports
  // — the destination of "All N lines ›", which used to link to the section it
  // already sat in while six of Aboni's twelve headings had no route at all.
  const linesRaw = sp.lines;
  const allLines = (Array.isArray(linesRaw) ? linesRaw[0] : linesRaw) === "all";
  const supabase = await createSupabaseServerClient();
  let shell: Awaited<ReturnType<typeof loadBuyerShell>>;
  let model: Awaited<ReturnType<typeof loadRecordSheet>>;
  try {
    [shell, model] = await Promise.all([
      loadBuyerShell(supabase, `/app/suppliers/${slug}`),
      loadRecordSheet(supabase, slug, new Date(), { allLines }),
    ]);
  } catch (err) {
    // A slow read is not a missing record. The page this replaced said so and
    // offered a retry; falling through to `notFound()` would answer 404 for a
    // published company because the database was busy.
    if (err instanceof ProfileReadTimeout) return <RecordTooSlow slug={slug} />;
    throw err;
  }

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

/**
 * The statement-timeout state, carried over from the page this replaced. It
 * says what happened and offers the one action that helps, rather than a 404
 * that says the company is not on SourceBD.
 */
function RecordTooSlow({ slug }: { slug: string }) {
  return (
    <div className="mx-auto flex max-w-prose flex-col gap-3 px-4 py-12">
      <Title as="h1">This record could not be read in time</Title>
      <Caption>
        The database is under load. The company is still on SourceBD — this read simply took too long.
      </Caption>
      <p className="text-sm">
        <Link href={`/app/suppliers/${slug}`} className="text-brand-ink underline">
          Try again
        </Link>
      </p>
    </div>
  );
}
