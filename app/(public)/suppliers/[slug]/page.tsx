// Spec FE-SITEWIDE Phase A — public Factory profile (anon, /suppliers/[slug]).
//
// Mirrors the prototype anatomy shipped by FE-PROTO on the authenticated
// `/app/suppliers/[slug]` route, with three public-mode adaptations:
//
//   1. No SaveButton, no ClaimCtaButton. Side-panel CTAs convert anon
//      visitors via /signup?next=… and /login?next=… instead.
//   2. Contact tab is always the gated card; its CTA links to
//      /signup?next=/suppliers/<slug> (not /pricing — anon users have no
//      plan yet; the conversion event is sign-up).
//   3. Address rows are stripped of `phone` and `email` at render time
//      (Spec M5 JC #12 (a) — registry-published PII is not exposed to
//      anonymous traffic). Inline mapper, not promoted to lib/.
//
// Hard contracts preserved:
//   - RPC `public.buyer_supplier_profile` is unchanged (no DB migration).
//   - R1 glyph payload = `t13_source_count`. No SBI / pillar / grade.
//   - Sanctions banner overrides chrome when an active hit exists; the
//     Contact CTA is disabled in that branch.
//   - Tier hierarchy is law: Provenance tab footer reiterates it.
//   - M4 JSON-LD Organization / LocalBusiness preserved.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Bell, ChatCircleDots, Prohibit } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyProfileHeader } from "@/components/supplier/company-profile-header";
import { ProfileOverviewTab } from "@/components/supplier/profile-overview-tab";
import type { FacilityPanel } from "@/components/supplier/profile-facilities-section";
import {
  ProfileCapacityTab,
  hasCapacityData,
} from "@/components/supplier/profile-capacity-tab";
import { ProfileContactTabMarketing } from "@/components/supplier/profile-contact-tab";
import { ProfileProvenanceTab } from "@/components/supplier/profile-provenance-tab";
import { ProfileComplianceTab } from "@/components/supplier/profile-compliance-tab";
import {
  fetchFacilityParentSlug,
  resolveUnpublishedProfileMiss,
} from "@/lib/facility-parent-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileTabClass, profileTabCountClass, profileHeaderContactClass, profileHeaderFollowClass } from "@/lib/profile-tab-styles";

export const revalidate = 300;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sourcebd.net";

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
};

type BrandAttribution = {
  source_code: string;
  display_name: string;
  source_url: string | null;
  last_seen_at: string;
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

type AddressRowRaw = {
  kind: string;
  address: string;
  phone: string | null;
  email: string | null;
  source_code: string;
  fetched_at: string;
};

type PublicAddress = {
  kind: string;
  address: string;
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
  rsc_remediation: RscRemediation | null;
  brand_attributions: BrandAttribution[];
  sanctions: SanctionsHit[];
  provenance: Provenance[];
  addresses: AddressRowRaw[];
  documents: ComplianceDocument[];
};

function publicAddresses(rows: AddressRowRaw[]): PublicAddress[] {
  return rows.map((r) => ({
    kind: r.kind,
    address: r.address,
    source_code: r.source_code,
    fetched_at: r.fetched_at,
  }));
}
// ---------- metadata ------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.rpc("buyer_supplier_profile", {
      p_slug: slug,
    });
    if (!data) return { title: "Supplier — SourceBD" };
    const payload = data as ProfilePayload;
    const s = payload.supplier;
    const loc = [s.city, s.district, s.country].filter(Boolean).join(", ");
    const title = `${s.company_name} — Bangladesh RMG supplier on SourceBD`;
    const description = loc
      ? `${s.company_name}, ${loc}. Verified registers, certifications, and source evidence on SourceBD.`
      : `${s.company_name}. Verified registers, certifications, and source evidence on SourceBD.`;
    return {
      title,
      description,
      robots: { index: true, follow: true },
      alternates: { canonical: `${SITE_URL}/suppliers/${slug}` },
      openGraph: {
        title,
        description,
        url: `${SITE_URL}/suppliers/${slug}`,
        type: "profile",
      },
    };
  } catch {
    return { title: "Supplier — SourceBD" };
  }
}

// ---------- entry --------------------------------------------------------

export default async function PublicSupplierProfilePage({
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
              within the time limit. Please refresh in a few seconds.
            </p>
            <Link
              href={`/suppliers/${slug}`}
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
      routeGroup: "public",
    });
    if (miss.action === "redirect") {
      permanentRedirect(miss.path);
    }
    notFound();
  }

  const payload = data as ProfilePayload;
  const s = payload.supplier;
  const nextPath = `/suppliers/${s.slug}`;
  const facilitiesPanel =
    facilityRaw &&
    typeof facilityRaw === "object" &&
    Array.isArray((facilityRaw as FacilityPanel).facilities) &&
    (facilityRaw as FacilityPanel).facilities.length > 0
      ? (facilityRaw as FacilityPanel)
      : null;

  const hasLocality = !!(s.city || s.district);
  const ldType = hasLocality ? "LocalBusiness" : "Organization";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": ldType,
    name: s.company_name,
    url: `${SITE_URL}/suppliers/${s.slug}`,
  };
  if (hasLocality || s.country) {
    ld.address = {
      "@type": "PostalAddress",
      ...(s.city ? { addressLocality: s.city } : {}),
      ...(s.district ? { addressRegion: s.district } : {}),
      ...(s.country ? { addressCountry: s.country } : {}),
    };
  }

  return (
    <>
      {/* Marketing layout main has no horizontal padding; app shell main uses px-4. */}
      <div className="r7-profile-shell mx-auto flex max-w-[1280px] flex-col gap-4 overflow-x-clip px-4 pb-5 sm:pb-6 md:px-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />

        {s.is_sanctioned ? <SanctionsBanner /> : null}

        <BlurFade delay={0.07}>
          <CompanyProfileHeader
            supplier={s}
            t13SourceCount={payload.t13_source_count}
            pills={payload.pills}
            provenance={payload.provenance}
            addresses={publicAddresses(payload.addresses)}
            discoverHref="/discover"
            followSlot={
              <Link
                href={`/signup?next=${encodeURIComponent(nextPath)}`}
                title="Create a free account to follow this supplier"
                aria-label="Sign up to follow this supplier"
                className={profileHeaderFollowClass}
              >
                <Bell size={15} weight="regular" aria-hidden className="sm:hidden" />
                <Bell size={17} weight="regular" aria-hidden className="hidden sm:block" />
                <span>Follow</span>
              </Link>
            }
            contactSlot={
              s.is_sanctioned ? (
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled
                  className={profileHeaderContactClass}
                  title="Contact disabled - sanctions flag active"
                  aria-label="Contact disabled (sanctions flag active)"
                >
                  <Prohibit size={15} weight="regular" aria-hidden className="sm:hidden" />
                  <Prohibit size={18} weight="regular" aria-hidden className="hidden sm:block" />
                  <span className="xs:hidden">Disabled</span>
                  <span className="hidden xs:inline">Contact disabled</span>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="primary"
                  size="lg"
                  className={profileHeaderContactClass}
                  title="Create an account to send a Request for Quote"
                  aria-label="Sign up to contact this supplier"
                >
                  <Link href={`/signup?next=${encodeURIComponent(nextPath)}`}>
                    <ChatCircleDots size={15} weight="regular" aria-hidden className="sm:hidden" />
                    <ChatCircleDots size={18} weight="regular" aria-hidden className="hidden sm:block" />
                    <span className="xs:hidden">Contact</span>
                    <span className="hidden xs:inline">Contact supplier</span>
                  </Link>
                </Button>
              )
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
            {hasCapacityData(s) ? (
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
              addresses={publicAddresses(payload.addresses)}
              discoverHref="/discover"
              slug={slug}
              facilitiesPanel={facilitiesPanel}
            />
          </TabsContent>
          <TabsContent value="compliance" id="compliance">
            <ProfileComplianceTab
              data={{
                pills: payload.pills,
                certifications: payload.certifications,
                rsc_remediation: payload.rsc_remediation,
                brand_attributions: payload.brand_attributions,
                sanctions: payload.sanctions,
                documents: payload.documents,
              }}
            />
          </TabsContent>
          {hasCapacityData(s) ? (
            <TabsContent value="capacity">
              <ProfileCapacityTab supplier={s} />
            </TabsContent>
          ) : null}
          <TabsContent value="contact">
            <ProfileContactTabMarketing
              nextPath={nextPath}
              disabled={s.is_sanctioned}
            />
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
    </>
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
