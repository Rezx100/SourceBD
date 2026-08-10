// Spec FE-PROTO â€” buyer Factory profile (authenticated, /app/suppliers/[slug]).
//
// Strict port of prototypes/profile-naafco-group.html anatomy: header dossier
// (R1 verified-sources glyph + breadcrumb + name + parentline + chips + 5-col
// meta dl + side panel with completeness chip + 3-btn row), optional products
// strip, six tabs (Overview / Compliance default / Capacity / Brands /
// Contact / Provenance), and the affiliation disclaimer footer.
//
// Distinct from the public anonymous `(public)/suppliers/[slug]` route
// (F3 exit gate). This route is gated behind `(app)/app/*` middleware, calls
// `public.buyer_supplier_profile` (migration 0024). No RPC changes.
//
// SBI hard contract (ai-workflow-rules.md):
//   * RPC does NOT join `sbi_scores`. Nothing here selects/renders any SBI value.
//   * R1 glyph payload = `t13_source_count`, never the SBI numeric.
//
// Contact PII hard contract (code-standards.md):
//   * Contact fields excluded from RPC RETURNS. Contact tab renders a gated
//     CTA; no payload to un-blur in the browser.

import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { SaveButton } from "@/components/save-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyProfileHeader } from "@/components/supplier/company-profile-header";
import { resolveProfileWorkers } from "@/lib/build-profile-workers";
import {
  formatWorkersHeadline,
  isGroupWorkers,
  workersCaption,
  workersDisplayValue,
} from "@/lib/profile-metrics";
import { ProfileOverviewTab } from "@/components/supplier/profile-overview-tab";
import {
  sanitizeFacilityPanel,
  type FacilityPanel,
} from "@/components/supplier/profile-facilities-section";
import {
  ProfileCapacityTab,
  hasCapacityData,
} from "@/components/supplier/profile-capacity-tab";
import {
  ProfileContactTab,
  ProfileContactTabAppBuyer,
} from "@/components/supplier/profile-contact-tab";
import { ProfileProvenanceTab } from "@/components/supplier/profile-provenance-tab";
import { ProfileComplianceTab, asRscSites } from "@/components/supplier/profile-compliance-tab";
import {
  fetchFacilityParentSlug,
  resolveUnpublishedProfileMiss,
} from "@/lib/facility-parent-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerRole } from "@/lib/auth";
import { profileTabClass, profileTabCountClass, profileHeaderContactClass } from "@/lib/profile-tab-styles";

export const dynamic = "force-dynamic";

// ---------- payload shape (mirrors RPC RETURNS jsonb document) -------------

type Supplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: "factory" | "buying_house" | "unknown";
  city: string | null;
  district: string | null;
  country: string | null;
  address_raw: string | null;
  completeness_pct: number;
  is_sanctioned: boolean;
  parent_group_name: string | null;
  established_date: string | null;
  bepza_zone: string | null;
  factory_types: string[];
  principal_products: string[];
  employees_total: number | null;
  employees_male: number | null;
  employees_female: number | null;
  machines_sewing: number | null;
  production_capacity_pcs_day: number | null;
  production_capacity_dozen_yearly: number | null;
  source_tags: string[];
};

type Pill = {
  source_code: string;
  label: string;
  value: string | null;
  verified: boolean | null;
  source_url: string | null;
  inherited_from: string | null;
  inherited_from_name: string | null;
  /** REZ-110: facility company_name when inherited; display-only. */
  building_name?: string | null;
};

type Cert = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
  /** REZ-93: facility company_name when inherited; display-only. */
  building_name?: string | null;
};

type RscRemediation = {
  progress_pct: number | null;
  workers_count: number | null;
  remediation_status: string | null;
  training_status: string | null;
  parent_group_name: string | null;
  parent_group_factory_count: number | null;
  fire_inspection_url: string | null;
  structural_inspection_url: string | null;
  electrical_inspection_url: string | null;
  boiler_inspection_url: string | null;
  cap_url: string | null;
  /** REZ-110: facility company_name when this site is a building. */
  building_name?: string | null;
};

type BrandAttribution = {
  source_code: string;
  display_name: string;
  source_url: string | null;
  last_seen_at: string;
  building_name?: string | null;
};

type SanctionsHit = {
  list: string;
  matched_name: string;
  list_entry_ref: string | null;
  screened_at: string;
  source_url: string | null;
  listed_date: string | null;
};

type Provenance = {
  source_code: string;
  display_name: string;
  tier: string;
  source_ref: string | null;
  source_url: string | null;
  last_seen_at: string;
};

type AddressRow = {
  kind: string;
  address: string;
  phone: string | null;
  email: string | null;
  source_code: string;
  fetched_at: string;
};

type ComplianceDocument = {
  doc_type: "fire" | "structural" | "electrical" | "boiler" | "cap";
  mirror_url: string | null;
  original_url: string;
  fetched_at: string;
  file_size: number | null;
  /** REZ-93: facility company_name when inherited; omitted for own docs. */
  building_name?: string | null;
};

type ProfilePayload = {
  supplier: Supplier;
  t13_source_count: number;
  pills: Pill[];
  certifications: Cert[];
  /** REZ-110: jsonb array of sites; legacy single object still accepted. */
  rsc_remediation: RscRemediation | RscRemediation[] | null;
  brand_attributions: BrandAttribution[];
  sanctions: SanctionsHit[];
  provenance: Provenance[];
  addresses: AddressRow[];
  documents: ComplianceDocument[];
};

type UnlockedContact = {
  email: string | null;
  phone: string | null;
  phones: string[];
  name: string | null;
  role: string | null;
  website: string | null;
};

// ---------- entry --------------------------------------------------------

export default async function FactoryProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data, error }, { data: facilityRaw }] = await Promise.all([
    supabase.rpc("buyer_supplier_profile", { p_slug: slug }),
    supabase.rpc("buyer_supplier_facility_panel", { p_slug: slug }),
  ]);
  if (error || data == null) {
    // Distinguish "row missing" (correct 404) from "DB timeout" (transient).
    // statement_timeout / canceling statement → 57014. Render a service-slow
    // card instead of a misleading "Not found".
    const code = (error as { code?: string } | null)?.code ?? null;
    const msg = error?.message ?? "";
    const isTimeout =
      code === "57014" ||
      /statement timeout|canceling statement|timed out/i.test(msg);
    if (isTimeout) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
            <h1 className="text-lg font-semibold text-amber-900">
              Service temporarily slow
            </h1>
            <p className="mt-2 text-sm text-amber-800">
              The factory profile for{" "}
              <span className="font-mono">{slug}</span> couldn&apos;t load
              within the time limit. Our database is under heavy load. Please
              refresh in a few seconds.
            </p>
            <Link
              href={`/app/suppliers/${slug}`}
              className="mt-4 inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              Retry
            </Link>
          </div>
        </div>
      );
    }
    // REZ-72: unpublished facility slug → permanent redirect to mother.
    const parentSlug = await fetchFacilityParentSlug(supabase, slug);
    const miss = resolveUnpublishedProfileMiss({
      profileFound: false,
      parentSlug,
      routeGroup: "app",
    });
    if (miss.action === "redirect") {
      permanentRedirect(miss.path);
    }
    notFound();
  }

  const payload = data as ProfilePayload;
  const s = payload.supplier;
  const facilitiesPanel =
    facilityRaw &&
    typeof facilityRaw === "object" &&
    Array.isArray((facilityRaw as FacilityPanel).facilities) &&
    (facilityRaw as FacilityPanel).facilities.length > 0 &&
    (facilityRaw as FacilityPanel).group
      ? sanitizeFacilityPanel(facilityRaw as FacilityPanel)
      : null;

  const rscSites = asRscSites(payload.rsc_remediation);
  const workersResolved = resolveProfileWorkers({
    companyName: s.company_name,
    employeesTotal: s.employees_total,
    rscSites,
    panel: facilitiesPanel,
  });
  const workersHeadline = {
    value: workersDisplayValue(workersResolved),
    caption: workersCaption(workersResolved),
    source: workersResolved.source,
  };
  const workersGroupLabel = isGroupWorkers(workersResolved)
    ? formatWorkersHeadline(workersResolved)
    : undefined;

  const { data: savedRow } = await supabase
    .from("saved_suppliers")
    .select("id")
    .eq("supplier_id", s.id)
    .maybeSingle();
  const isSaved = Boolean(savedRow);


  // Admin contact unlock (I-004). Admins bypass paywall universally; the
  // SELECT is server-only and the result never reaches the browser unless
  // role==="admin" at render time. Paid-plan unlock for buyers is a
  // follow-up that needs an RPC + column-level RLS.
  const viewerRole = await getServerRole();
  const isAdminViewer = viewerRole === "admin";
  let unlockedContact: UnlockedContact | null = null;
  if (isAdminViewer) {
    const { data: contactRow } = await supabase
      .from("suppliers")
      .select("email_primary, phones, contact_name, contact_role, website")
      .eq("id", s.id)
      .maybeSingle();
    if (contactRow) {
      unlockedContact = {
        email: contactRow.email_primary ?? null,
        phone: Array.isArray(contactRow.phones) && contactRow.phones.length > 0
          ? contactRow.phones[0] ?? null
          : null,
        phones: Array.isArray(contactRow.phones) ? contactRow.phones : [],
        name: contactRow.contact_name ?? null,
        role: contactRow.contact_role ?? null,
        website: contactRow.website ?? null,
      };
    }
  }

  return (
    <div className="r7-profile-shell mx-auto flex max-w-[1280px] flex-col gap-4 overflow-x-clip px-0 pb-5 sm:px-4 sm:pb-6 md:px-6">
      {s.is_sanctioned ? <SanctionsBanner /> : null}
      <BlurFade delay={0.07}>
        <CompanyProfileHeader
          supplier={s}
          workers={workersHeadline}
          t13SourceCount={payload.t13_source_count}
          pills={payload.pills}
          provenance={payload.provenance}
          addresses={payload.addresses}
          discoverHref="/app/discover"
          followSlot={
            <SaveButton
              supplierId={s.id}
              initialSaved={isSaved}
              shape="profile"
            />
          }
          contactSlot={
            <Button
              asChild
              size="lg"
              variant="primary"
              className={profileHeaderContactClass}
              title="Send a Request for Quote to this supplier"
              aria-label="Contact supplier (Request for Quote)"
            >
              <Link href={`/app/rfqs/new?supplier=${s.id}`}>
                <ChatCircleDots size={15} weight="regular" aria-hidden className="sm:hidden" />
                <ChatCircleDots size={18} weight="regular" aria-hidden className="hidden sm:block" />
                {/* Sub-360px phones get the short label so the CTA never
                    truncates inside its half of the action grid. */}
                <span className="xs:hidden">Contact</span>
                <span className="hidden xs:inline">Contact supplier</span>
              </Link>
            </Button>
          }
        />
      </BlurFade>
      <Tabs defaultValue="overview" className="profile-tabs-shell flex flex-col gap-0">
        <TabsList
          aria-label="Profile sections"
          className="flex-nowrap gap-1 overflow-x-auto rounded-[14px] border border-neutral-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(15,15,20,0.03)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsTrigger value="overview" id="tab-trigger-overview" className={profileTabClass}>
            Overview
          </TabsTrigger>
          <TabsTrigger value="compliance" id="tab-trigger-compliance" className={profileTabClass}>
            Compliance
          </TabsTrigger>
          {hasCapacityData(s, workersHeadline) ? (
            <TabsTrigger value="capacity" className={profileTabClass}>
              Capacity
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="contact" className={profileTabClass}>
            Contact
          </TabsTrigger>
          <TabsTrigger value="provenance" className={`${profileTabClass} group`}>
            Provenance
            <span
              className={profileTabCountClass}
              title="Active source records on this profile"
            >
              {payload.provenance.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ProfileOverviewTab
            supplier={s}
            t13SourceCount={payload.t13_source_count}
            provenanceCount={payload.provenance.length}
            addresses={payload.addresses}
            discoverHref="/app/discover"
            slug={slug}
            facilitiesPanel={facilitiesPanel}
            workers={workersHeadline}
            workersGroupLabel={workersGroupLabel}
          />
        </TabsContent>
        <TabsContent value="compliance" id="compliance">
          <ProfileComplianceTab
            data={{
              pills: payload.pills,
              certifications: payload.certifications,
              rsc_remediation: asRscSites(payload.rsc_remediation),
              brand_attributions: payload.brand_attributions,
              sanctions: payload.sanctions,
              documents: payload.documents,
            }}
          />
        </TabsContent>
        {hasCapacityData(s, workersHeadline) ? (
          <TabsContent value="capacity">
            <ProfileCapacityTab supplier={s} workers={workersHeadline} />
          </TabsContent>
        ) : null}
        <TabsContent value="contact">
          {unlockedContact ? (
            <ProfileContactTab
              meta="Unlocked · admin view"
              unlocked={unlockedContact}
            />
          ) : (
            <ProfileContactTabAppBuyer slug={s.slug} />
          )}
        </TabsContent>
        <TabsContent value="provenance" id="provenance">
          <ProfileProvenanceTab
            provenance={payload.provenance}
            t13SourceCount={payload.t13_source_count}
          />
        </TabsContent>
      </Tabs>

      <p className="mx-auto mt-6 max-w-[640px] px-3 text-center text-[13px] leading-5 text-neutral-500 sm:px-0">
        Authority logos identify the data sources we aggregate from. SourceBD
        is not affiliated with or endorsed by BGMEA, BKMEA, BTMA, EPB,
        OEKO-TEX, WRAP, GOTS, RSC, or any of the brands named on this page.
        Every datum traces to the issuing authority shown on the Provenance
        tab.
      </p>
    </div>
  );
}
function SanctionsBanner() {
  return (
    <div role="alert" className="sanctions-banner">
      <svg
        viewBox="0 0 24 24"
        width={28}
        height={28}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--sem-red)" }}
        aria-hidden
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4M12 17h.01" />
      </svg>
      <div>
        <p className="sanctions-banner-title">Sanctions / forced-labour flag</p>
        <p className="sanctions-banner-body">
          This supplier matches an active watchlist entry. See the Compliance
          tab for the matched record and source link.
        </p>
      </div>
      <a href="#compliance" className="btn-proto">
        View matches
      </a>
    </div>
  );
}
