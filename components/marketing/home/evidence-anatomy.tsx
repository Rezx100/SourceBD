// Evidence anatomy — use-cases layout for /home-demo.
//
// Left accordion + right stage mirror the reference use-cases interaction.
// Every right-side panel is a production profile card fed by
// buyer_supplier_profile — Registries, Certifications, Sanctions, Contact,
// Addresses, Provenance. No fabricated rows.

import {
  DemoAddressesPanel,
  DemoCertificationsPanel,
  DemoContactPanel,
  DemoProvenancePanel,
  DemoRegistriesPanel,
  DemoSanctionsPanel,
} from "@/components/marketing/home/evidence-demo-panels";
import {
  EvidenceAnatomyStage,
  type EvidenceCaseMeta,
} from "@/components/marketing/home/evidence-anatomy-stage";
import { CERT_KINDS } from "@/components/discover/filter-rail";
import { fetchPublicDiscoverSuppliers } from "@/lib/discover-suppliers";
import { getPublicSupplierOverview } from "@/lib/public-supplier-profile";

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
  rsc_remediation: unknown;
  brand_attributions: BrandAttribution[];
  sanctions: SanctionsHit[];
  provenance: Provenance[];
  addresses: AddressRowRaw[];
  documents: ComplianceDocument[];
};

type PublicAddress = {
  kind: string;
  address: string;
  source_code: string;
  fetched_at: string;
};

function publicAddresses(rows: AddressRowRaw[]): PublicAddress[] {
  return rows.map((r) => ({
    kind: r.kind,
    address: r.address,
    source_code: r.source_code,
    fetched_at: r.fetched_at,
  }));
}

const REGISTRY_CODES = new Set([
  "BGMEA",
  "BKMEA",
  "BTMA",
  "BGAPMEA",
  "RSC",
  "EPB",
]);

function hasEvidenceAnatomy(payload: ProfilePayload): boolean {
  const registryCount = payload.pills.filter((p) =>
    REGISTRY_CODES.has(p.source_code),
  ).length;
  return registryCount > 0 && payload.certifications.length > 0;
}

/** Prefer the densest real profile so demo cards can fill row caps. */
function evidenceDensity(payload: ProfilePayload): number {
  const registryCount = new Set(
    payload.pills
      .filter((p) => REGISTRY_CODES.has(p.source_code))
      .map((p) => p.source_code),
  ).size;
  const brandProvenance = payload.provenance.filter((p) =>
    /tier4|brand/i.test(p.tier),
  ).length;
  return (
    registryCount +
    payload.certifications.length +
    payload.addresses.length +
    payload.documents.length +
    payload.provenance.length +
    payload.brand_attributions.length +
    brandProvenance
  );
}

/** Discover pool size — profile RPCs are fetched sequentially from this list. */
const FEATURED_CANDIDATE_LIMIT = 6;
/** Overview RPCs per homepage render. First slug may be sanctioned;
 *  do not spend the only attempt on a skip. A 57014 means the database
 *  is sick — stop immediately; do not serial-await two more timeouts. */
const FEATURED_PROFILE_ATTEMPTS = 3;
/** Good-enough density to stop early (discover is already receipts-sorted). */
const FEATURED_DENSITY_EARLY_EXIT = 10;

async function loadFeaturedProfile(): Promise<ProfilePayload | null> {
  const certKinds = CERT_KINDS.map((c) => c.value);
  const { rows, error } = await fetchPublicDiscoverSuppliers({
    p_q: null,
    p_entity_types: null,
    p_min_sources: 3,
    p_cert_kinds: [...certKinds],
    p_rsc_min: null,
    p_city: null,
    p_district: null,
    p_category: null,
    p_sort: "receipts",
    p_limit: FEATURED_CANDIDATE_LIMIT,
    p_offset: 0,
    p_registries: null,
    p_factory_types: null,
    p_brand_codes: null,
    p_completeness_min: null,
    p_workers_min: null,
  });

  if (error || rows.length === 0) return null;

  try {
    const slugs = rows.map((r) => r.slug).filter((s): s is string => !!s);
    let best: ProfilePayload | null = null;
    let bestScore = -1;
    let attempts = 0;
    for (const slug of slugs) {
      if (attempts >= FEATURED_PROFILE_ATTEMPTS) break;
      attempts += 1;

      const pack = await getPublicSupplierOverview(slug);
      if (pack.timedOut) break;
      const data = pack.data;
      if (data == null) continue;

      const payload = data as ProfilePayload;
      if (payload.supplier.is_sanctioned) continue;
      if (!hasEvidenceAnatomy(payload)) continue;

      const score = evidenceDensity(payload);
      if (score > bestScore) {
        best = payload;
        bestScore = score;
      }
      if (bestScore >= FEATURED_DENSITY_EARLY_EXIT) break;
    }
    return best;
  } catch {
    return null;
  }
}

// Editorial category framing for the left rail. Panel ids stay wired to the
// live Compliance surfaces; order is narrative, not product-tab order.
const CASES: EvidenceCaseMeta[] = [
  {
    id: "registries",
    index: "01",
    title: "Government Registries",
    description: "Legal identity and statutory records.",
  },
  {
    id: "certifications",
    index: "02",
    title: "Certifications",
    description: "Current certificates from issuing bodies.",
  },
  {
    id: "provenance",
    index: "03",
    title: "Trade Activity",
    description: "Export history and manufacturing footprint.",
  },
  {
    id: "sanctions",
    index: "04",
    title: "Compliance",
    description: "Sanctions and screening.",
  },
  {
    id: "contact",
    index: "05",
    title: "Contacts",
    description: "Verified communication channels.",
  },
  {
    id: "addresses",
    index: "06",
    title: "Locations",
    description: "Production and office addresses.",
  },
];

export async function EvidenceAnatomy() {
  const payload = await loadFeaturedProfile();
  if (!payload) return null;

  const s = payload.supplier;
  const addresses = publicAddresses(payload.addresses);

  const registryPills = payload.pills.filter((p) =>
    REGISTRY_CODES.has(p.source_code),
  );

  const panels = {
    registries:
      registryPills.length > 0 ? (
        <DemoRegistriesPanel pills={payload.pills} />
      ) : undefined,
    certifications:
      payload.certifications.length > 0 ? (
        <DemoCertificationsPanel certifications={payload.certifications} />
      ) : undefined,
    sanctions: (
      <DemoSanctionsPanel hitCount={payload.sanctions.length} />
    ),
    contact: (
      <DemoContactPanel
        meta={
          s.is_sanctioned
            ? "Contact disabled — sanctions flag active"
            : "Sign up free to unlock"
        }
      />
    ),
    addresses:
      addresses.length > 0 ? (
        <DemoAddressesPanel addresses={addresses} />
      ) : undefined,
    provenance:
      payload.provenance.length > 0 ? (
        <DemoProvenancePanel
          provenance={payload.provenance}
          t13SourceCount={payload.t13_source_count}
        />
      ) : undefined,
  };

  return (
    <section
      aria-label="Evidence anatomy"
      className="relative overflow-hidden border-b border-neutral-200 bg-neutral-50"
    >
      <div className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 sm:py-20 md:py-28">
        <EvidenceAnatomyStage cases={CASES} panels={panels} />
      </div>
    </section>
  );
}
