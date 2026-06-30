// Spec FE-PROTO â€” buyer Factory profile (authenticated, /app/suppliers/[slug]).
//
// Strict port of prototypes/profile-naafco-group.html anatomy: header dossier
// (R1 verified-sources glyph + breadcrumb + name + parentline + chips + 5-col
// meta dl + side panel with completeness chip + 3-btn row), optional products
// strip, six tabs (Overview / Compliance default / Capacity / Brands /
// Contact / Provenance), and the affiliation disclaimer footer.
//
// Distinct from the public anonymous `(marketing)/suppliers/[slug]` route
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

import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatCircleDots, Factory, MapPin, Package } from "@phosphor-icons/react/dist/ssr";

import { BlurFade } from "@/components/ui/blur-fade";
import { ReceiptsRing } from "@/components/receipts-ring";
import { SaveButton } from "@/components/save-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductsStripExpandable } from "@/components/supplier/products-strip-expandable";
import { dedupProducts } from "@/lib/product-icons";
import { VerifiedByBadge } from "@/components/supplier/verified-by-badge";
import { ProfileHeaderMetaGrid, type ProfileHeaderMetaItem } from "@/components/supplier/profile-header-meta";
import {
  ProfileCapacityTab,
  hasCapacityData,
} from "@/components/supplier/profile-capacity-tab";
import { ProfileBrandsTab } from "@/components/supplier/profile-brands-tab";
import {
  ProfileContactTab,
  ProfileContactTabAppBuyer,
} from "@/components/supplier/profile-contact-tab";
import { ProfileProvenanceTab } from "@/components/supplier/profile-provenance-tab";
import { ProfileComplianceTab } from "@/components/supplier/profile-compliance-tab";
import {
  ProfileCard,
  ProfileCardHeader,
  ProfileFactGrid,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import { AddressesJumpLink } from "@/components/supplier/addresses-jump-link";
import { SourcesExplainer } from "@/components/supplier/sources-explainer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServerRole } from "@/lib/auth";
import { dedupAddresses, type DedupedAddress } from "@/lib/dedup-addresses";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatCityDistrictShort } from "@/lib/format-location";
import {
  factoryTypesForHeader,
  factoryTypesNarrative,
  formatFactoryTypesList,
  formatProfileDate,
  latestProvenanceRecord,
  yearsElapsedSince,
} from "@/lib/format-supplier-profile";

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
};

type Cert = {
  kind: string;
  certificate_no: string | null;
  issuer: string | null;
  issued_on: string | null;
  expires_on: string | null;
  scope: string | null;
  document_url: string | null;
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

  const { data, error } = await supabase.rpc("buyer_supplier_profile", {
    p_slug: slug,
  });
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
    notFound();
  }

  const payload = data as ProfilePayload;
  const s = payload.supplier;

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
    <div className="r7-profile-shell mx-auto flex max-w-[1280px] flex-col gap-4 overflow-x-clip px-4 py-5 sm:px-6 sm:py-8">
      {s.is_sanctioned ? <SanctionsBanner /> : null}
      <BlurFade delay={0.07}>
        <ProfileHeader
          payload={payload}
          isSaved={isSaved}
        />
      </BlurFade>
      {s.principal_products.length > 0 ? (
        <ProductsStripExpandable products={s.principal_products} />
      ) : null}

      <Tabs defaultValue="compliance" className="profile-tabs-shell flex flex-col gap-0">
        <TabsList
          aria-label="Profile sections"
          className="proto-tabs h-auto"
        >
          <TabsTrigger value="overview" id="tab-trigger-overview" className="proto-tab">
            Overview
          </TabsTrigger>
          <TabsTrigger value="compliance" className="proto-tab">
            Compliance
          </TabsTrigger>
          {hasCapacityData(s) ? (
            <TabsTrigger value="capacity" className="proto-tab">
              Capacity
            </TabsTrigger>
          ) : null}
          {payload.brand_attributions.length > 0 ? (
            <TabsTrigger value="brands" className="proto-tab">
              Brand attribution
              <span className="proto-tab-count">
                {payload.brand_attributions.length}
              </span>
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="contact" className="proto-tab">
            Contact
          </TabsTrigger>
          <TabsTrigger value="provenance" className="proto-tab">
            Provenance
            <span
              className="proto-tab-count"
              title="Active source records on this profile"
            >
              {payload.provenance.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab payload={payload} />
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
        {payload.brand_attributions.length > 0 ? (
          <TabsContent value="brands">
            <ProfileBrandsTab brands={payload.brand_attributions} />
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
        <TabsContent value="provenance">
          <ProfileProvenanceTab provenance={payload.provenance} />
        </TabsContent>
      </Tabs>

      <p className="affiliation-disclaimer mt-6">
        Authority logos identify the data sources we aggregate from. SourceBD
        is not affiliated with or endorsed by BGMEA, BKMEA, BTMA, EPB,
        OEKO-TEX, WRAP, GOTS, RSC, or any of the brands named on this page.
        Every datum traces to the issuing authority shown on the Provenance
        tab.
      </p>
    </div>
  );
}

// ---------- header --------------------------------------------------------

// I-023 — "Verified by" hero badge lives in `@/components/supplier/verified-by-badge`.

function ProfileHeader({
  payload,
  isSaved,
}: {
  payload: ProfilePayload;
  isSaved: boolean;
}) {
  const s = payload.supplier;
  const dedupedAddresses = dedupAddresses(payload.addresses);
  const primaryAddress =
    dedupedAddresses[0]?.address ??
    s.address_raw ??
    payload.addresses[0]?.address ??
    null;
  const cityLine = formatCityDistrictShort(s.city, s.district);
  const otherAddressCount = Math.max(0, dedupedAddresses.length - 1);
  const latestProv = latestProvenanceRecord(payload.provenance);
  const lastVerified = latestProv?.last_seen_at ?? null;
  const lastVerifiedSource = latestProv?.display_name ?? null;
  const headerFactoryTypes = factoryTypesForHeader(s.factory_types, 2);

  const entityBreadcrumb =
    s.entity_type === "buying_house"
      ? "Discover › Buying house"
      : "Discover › Garment manufacturer";

  const rjsc = pillByCode(payload.pills, "RJSC")?.value ?? null;
  const bin = pillByCode(payload.pills, "BIN")?.value ?? null;
  const epbExp = pillByCode(payload.pills, "EPB")?.value ?? null;
  const established = s.established_date;

  const metaItems: ProfileHeaderMetaItem[] = [];
  if (primaryAddress || cityLine) {
    metaItems.push({
      key: "address",
      label: "Address",
      icon: "address",
      children: (
        <>
          {primaryAddress ? (
            <span className="header-meta-address">{primaryAddress}</span>
          ) : null}
          {cityLine ? <span className="mono">{cityLine}</span> : null}
        </>
      ),
    });
  }
  if (established) {
    metaItems.push({
      key: "established",
      label: "Established",
      icon: "established",
      children: (
        <>
          {established}
          <span className="mono">{yearsElapsedSince(established)} yrs</span>
        </>
      ),
    });
  }
  if (rjsc) {
    metaItems.push({
      key: "rjsc",
      label: "RJSC",
      icon: "registry",
      children: <span className="mono">{rjsc}</span>,
    });
  }
  if (bin || epbExp) {
    metaItems.push({
      key: "bin-epb",
      label: bin ? "BIN" : "EPB",
      icon: "registry",
      children: <span className="mono">{bin ?? epbExp}</span>,
    });
  }
  if (lastVerified) {
    metaItems.push({
      key: "last-verified",
      label: "Last verified",
      icon: "verified",
      children: (
        <>
          <span className="mono">{formatProfileDate(lastVerified)}</span>
          {lastVerifiedSource ? (
            <span className="mono">{lastVerifiedSource}</span>
          ) : null}
        </>
      ),
    });
  }

  return (
    <section className="header-card" aria-labelledby="company-name">
      <div className="header-glyph-col">
        <ReceiptsRing sources={payload.t13_source_count} size={64} />
        <SourcesExplainer variant="inline" />
      </div>

      <div className="header-main min-w-0">
        <div className="breadcrumb">{entityBreadcrumb}</div>
        <h1 id="company-name" className="header-name">
          {formatCompanyName(s.company_name)}
        </h1>
        {s.parent_group_name ? (
          <p className="header-parentline">
            <span style={{ color: "var(--ink-tertiary)" }}>Member of</span>{" "}
            <Link
              href={`/app/discover?group=${encodeURIComponent(s.parent_group_name)}`}
            >
              {s.parent_group_name}
            </Link>
          </p>
        ) : null}

        <p className="header-classification">
          <span className="header-classification-item">
            <Factory size={13} weight="duotone" aria-hidden />
            {entityLabel(s.entity_type)}
          </span>
          {s.factory_types.slice(0, 2).map((t) => (
            <span key={t} className="header-classification-item">
              <Package size={13} weight="duotone" aria-hidden />
              {t}
            </span>
          ))}
          {headerFactoryTypes.overflow > 0 ? (
            <span
              className="header-classification-item"
              title={s.factory_types.slice(2).join(", ")}
            >
              +{headerFactoryTypes.overflow} more
            </span>
          ) : null}
        </p>

        <div className="header-trust-row">
          <VerifiedByBadge pills={payload.pills} />
        </div>

        <ProfileHeaderMetaGrid items={metaItems} />
        {otherAddressCount > 0 ? (
          <AddressesJumpLink count={otherAddressCount} />
        ) : null}
      </div>

      <div className="header-side">
        <div className="header-action-row">
          <SaveButton supplierId={s.id} initialSaved={isSaved} shape="profile" />
          <Button
            asChild
            size="lg"
            variant="primary"
            className="h-11 min-w-[8.5rem] gap-2 rounded-lg px-4 text-sm font-semibold shadow-sm"
            title="Send a Request for Quote to this supplier"
            aria-label="Contact supplier (Request for Quote)"
          >
            <Link href={`/app/rfqs/new?supplier=${s.id}`}>
              <ChatCircleDots size={17} weight="regular" aria-hidden />
              <span>Contact</span>
            </Link>
          </Button>
        </div>
      </div>
    </section>
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

// ---------- Products strip ------------------------------------------------
// Rendered via the client-side `ProductsStripExpandable` component so that
// the "+ N more" affordance can expand inline.

// ---------- Overview tab --------------------------------------------------

function OverviewTab({ payload }: { payload: ProfilePayload }) {
  const s = payload.supplier;
  const dedupedAddresses = dedupAddresses(payload.addresses);

  const facts: { label: string; value: ReactNode }[] = [];
  if (s.parent_group_name)
    facts.push({ label: "Parent group", value: s.parent_group_name });
  if (s.established_date)
    facts.push({ label: "Established", value: s.established_date });
  if (s.factory_types.length > 0)
    facts.push({
      label: "Factory type",
      value: formatFactoryTypesList(s.factory_types),
    });
  if (s.bepza_zone) facts.push({ label: "EPZ zone", value: s.bepza_zone });
  if (s.country) facts.push({ label: "Country", value: s.country });
  facts.push({
    label: "Tier 1–3 sources",
    value: String(payload.t13_source_count),
  });

  return (
    <ProfileTabStack>
      <ProfileCard>
        <ProfileCardHeader
          title="Company overview"
          meta={`${payload.provenance.length} active source records`}
        />
        <div className="profile-overview-layout">
          <p className="profile-overview-body">{entityNarrative(s)}</p>
          <ProfileFactGrid facts={facts} />
        </div>
      </ProfileCard>

      {dedupedAddresses.length > 0 ? (
        <ProfileCard id="locations">
          <ProfileCardHeader
            title="Locations & addresses"
            meta={`${dedupedAddresses.length} on file`}
          />
          <ul className="profile-location-list">
            {dedupedAddresses.map((a, i) => (
              <AddressCard key={i} address={a} primary={i === 0} />
            ))}
          </ul>
        </ProfileCard>
      ) : null}
    </ProfileTabStack>
  );
}

const ADDRESS_KIND_LABEL: Record<string, string> = {
  factory: "Factory",
  registered: "Registered office",
  registered_office: "Registered office",
  mailing: "Mailing address",
  head_office: "Head office",
  office: "Office",
  warehouse: "Warehouse",
  corporate: "Corporate office",
};

function addressKindLabel(k: string): string {
  const key = k.toLowerCase().trim();
  return (
    ADDRESS_KIND_LABEL[key] ??
    key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ")
  );
}

// Tidy a raw source code for display in the address provenance line
// (e.g. "OEKO_TEX" → "OEKO-TEX", "BRAND_HM" → "H&M").
function sourceCodeLabel(code: string): string {
  if (code === "OEKO_TEX") return "OEKO-TEX";
  if (code === "BRAND_HM") return "H&M";
  if (code === "BRAND_MS") return "M&S";
  if (code.startsWith("BRAND_")) {
    const raw = code.slice(6).replace(/_/g, " ").trim();
    return raw
      ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
      : code;
  }
  return code.replace(/_/g, "-");
}

function AddressCard({
  address,
  primary,
}: {
  address: DedupedAddress;
  primary: boolean;
}) {
  return (
    <li className="profile-location-row">
      <span aria-hidden className="profile-location-icon">
        <MapPin size={18} weight="duotone" />
      </span>
      <div className="profile-location-body">
        <div className="flex flex-wrap items-center gap-2">
          {address.kinds.map((k) => (
            <span key={k} className="profile-kind-badge">
              {addressKindLabel(k)}
            </span>
          ))}
          {primary && address.kinds.length === 0 ? (
            <span className="text-[11px] font-medium text-ink-tertiary">
              Primary
            </span>
          ) : null}
        </div>
        <p className="profile-location-address">{address.address}</p>
        {address.verified_by.length > 0 ? (
          <p className="profile-location-meta">
            Address corroborated by{" "}
            <span className="font-medium text-ink-primary">
              {address.verified_by.map(sourceCodeLabel).join(" + ")}
            </span>
          </p>
        ) : null}
      </div>
    </li>
  );
}

function entityNarrative(s: Supplier): string {
  const kind =
    s.entity_type === "buying_house"
      ? "buying house"
      : factoryTypesNarrative(s.factory_types) ?? "garment manufacturer";
  const where = formatCityDistrictShort(s.city, s.district);
  const since = s.established_date
    ? ` operating since ${s.established_date}`
    : "";
  const cleanedProducts = dedupProducts(s.principal_products);
  const products =
    cleanedProducts.length > 0
      ? ` Principal products: ${cleanedProducts.slice(0, 4).join(", ")}.`
      : "";
  return `${formatCompanyName(s.company_name)} is a ${kind}${
    where ? ` based in ${where}` : ""
  }${since}.${products}`;
}

function pillByCode(pills: Pill[], code: string): Pill | undefined {
  return pills.find((p) => p.source_code === code);
}

function entityLabel(e: Supplier["entity_type"]): string {
  if (e === "factory") return "Garment manufacturer";
  if (e === "buying_house") return "Buying house";
  return "Supplier";
}
