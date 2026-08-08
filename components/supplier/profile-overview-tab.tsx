import type { ReactNode } from "react";

import {
  LocationsSection,
  type SerializableGroup,
} from "@/components/supplier/locations-section";
import type { LocationKind, LocationMapMarker } from "@/components/supplier/locations-map";
import { geocodeLocations } from "@/lib/barikoi";
import { PrincipalProductsCard } from "@/components/supplier/principal-products-card";
import {
  ProfileFacilitiesSection,
  type ProfileFacility,
} from "@/components/supplier/profile-facilities-section";
import {
  ProfileCard,
  ProfileCardHeader,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import {
  buildLocationOverview,
  CATEGORY_BY_GROUP,
  locationOverviewMeta,
  mergeUniqueLocations,
  type AddressRowRaw,
} from "@/lib/dedup-addresses";
import { articleFor, formatMonthYear } from "@/lib/format-supplier-profile";
import { correctProductSpelling, dedupProducts } from "@/lib/product-icons";
import { formatCompanyName } from "@/lib/format-company-name";
import { formatProfileLocationCompact, toTitleCaseAddress } from "@/lib/format-location";
export type ProfileOverviewSupplier = {
  company_name: string;
  entity_type: "factory" | "buying_house" | "unknown";
  city: string | null;
  district: string | null;
  country: string | null;
  established_date: string | null;
  parent_group_name: string | null;
  bepza_zone: string | null;
  factory_types: string[];
  principal_products: string[];
  employees_total: number | null;
  machines_sewing: number | null;
  production_capacity_pcs_day: number | null;
  production_capacity_dozen_yearly: number | null;
  source_tags: string[];
};

function sourceCodeLabel(code: string): string {
  if (code === "OEKO_TEX") return "OEKO-TEX";
  if (code === "BRAND_HM") return "H&M";
  if (code === "BRAND_MS") return "M&S";
  if (code.startsWith("BRAND_")) {
    const raw = code.slice(6).replace(/_/g, " ").trim();
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : code;
  }
  return code.replace(/_/g, "-");
}


const NARRATIVE_AUTHORITY_PRIORITY = [
  "BGMEA",
  "OEKO_TEX",
  "BKMEA",
  "WRAP",
  "GOTS",
  "EPB",
  "RSC",
  "BGAPMEA",
] as const;

function topAuthorityLabels(codes: readonly string[], limit = 2): string[] {
  const set = new Set(codes);
  const picked: string[] = [];
  for (const code of NARRATIVE_AUTHORITY_PRIORITY) {
    if (set.has(code)) picked.push(sourceCodeLabel(code));
    if (picked.length >= limit) break;
  }
  if (picked.length < limit) {
    for (const code of codes) {
      const label = sourceCodeLabel(code);
      if (!picked.includes(label)) picked.push(label);
      if (picked.length >= limit) break;
    }
  }
  return picked;
}

export function ProfileAddressesCard<TAddress extends AddressRowRaw>({
  addresses,
}: {
  addresses: readonly TAddress[];
}) {
  const overview = buildLocationOverview(addresses);
  if (overview.uniqueLocationCount === 0) return null;

  const groups: SerializableGroup[] = overview.groups.map((group) => ({
    title: group.title,
    locations: group.locations.map((loc) => ({
      displayAddress: loc.displayAddress,
      floors: loc.floors,
      variants: loc.variants,
      types: loc.types,
      authorities: loc.authorities,
      markerIndex: null,
    })),
  }));

  return (
    <ProfileCard id="locations">
      <ProfileCardHeader
        title="Locations & addresses"
        meta={locationOverviewMeta(
          overview.uniqueLocationCount,
          overview.sourceRecordCount,
        )}
      />
      <LocationsSection markers={[]} groups={groups} />
    </ProfileCard>
  );
}

export async function ProfileOverviewTab<TAddress extends AddressRowRaw>({
  supplier: s,
  t13SourceCount,
  provenanceCount,
  addresses,
  discoverHref,
  slug,
  facilities = [],
}: {
  supplier: ProfileOverviewSupplier;
  t13SourceCount: number;
  provenanceCount: number;
  addresses: readonly TAddress[];
  discoverHref: "/app/discover" | "/discover";
  /** Profile slug — excluded from the nearby-sites map layer and used to name
   *  the GeoJSON pin export. */
  slug?: string;
  /** REZ-73: attached extension buildings of this mother company. Empty while
   *  B1 has not run — the Facilities section then renders nothing at all. */
  facilities?: readonly ProfileFacility[];
}) {
  const overview = buildLocationOverview(addresses);
  const primaryAddress =
    mergeUniqueLocations(addresses)[0]?.displayAddress ?? null;

  // Pins come from the ETL geocode cache only. Look each location up by the
  // raw registry spellings it was merged from — the cache is keyed on those,
  // not on the cleaned display address. A miss just means no pin.
  const geocoded = await geocodeLocations(
    overview.groups.flatMap((g) =>
      g.locations.map((l) => ({
        label: toTitleCaseAddress(l.displayAddress),
        lookups: l.source_rows.map((r) => r.address),
        // Carried through so the pin can be coloured by address kind (REZ-30).
        kind: CATEGORY_BY_GROUP[g.title],
      })),
    ),
  );

  const mapMarkers: LocationMapMarker[] = geocoded.map((g) => ({
    latitude: g.latitude,
    longitude: g.longitude,
    label: g.label,
    kind: (g.kind ?? "other") as LocationKind,
    confidencePct: g.confidencePct,
    addressStatus: g.addressStatus,
  }));

  // Build label → marker index so each SerializableLocation knows which map
  // pin it corresponds to. geocodeLocations drops cache-miss entries, so the
  // index only exists for locations with a cached geocode.
  const markerIndexByLabel = new Map(mapMarkers.map((m, i) => [m.label, i]));

  const serializedGroups: SerializableGroup[] = overview.groups.map((group) => ({
    title: group.title,
    locations: group.locations.map((loc) => ({
      displayAddress: loc.displayAddress,
      floors: loc.floors,
      variants: loc.variants,
      types: loc.types,
      authorities: loc.authorities,
      markerIndex:
        markerIndexByLabel.get(toTitleCaseAddress(loc.displayAddress)) ?? null,
    })),
  }));

  return (
    <ProfileTabStack>
      <PrincipalProductsCard products={s.principal_products} />

      <ProfileCard>
        {/* No trust-line meta and no bottom fact grid here — every one of
            those data points (established, factory type, country, authority
            count) already appears once in the narrative or the page header;
            repeating them in a second format on the same card read as
            template filler. */}
        <ProfileCardHeader title="Company overview" />
        <CompanyNarrative
          narrative={buildNarrative(s, primaryAddress, t13SourceCount, s.source_tags, {
            provenanceCount,
            uniqueLocationCount: overview.uniqueLocationCount,
            factoryLocationCount:
              overview.groups.find((g) => g.title === "Factories")?.locations.length ?? 0,
          })}
        />
      </ProfileCard>

      <ProfileFacilitiesSection own={s} facilities={facilities} />

      {overview.uniqueLocationCount > 0 ? (
        <ProfileCard id="locations">
          <ProfileCardHeader
            title="Locations & addresses"
            meta={locationOverviewMeta(
              overview.uniqueLocationCount,
              overview.sourceRecordCount,
            )}
          />
          <LocationsSection
            markers={mapMarkers}
            groups={serializedGroups}
            supplierSlug={slug}
            profileBasePath={
              discoverHref === "/app/discover" ? "/app/suppliers" : "/suppliers"
            }
          />
        </ProfileCard>
      ) : null}
    </ProfileTabStack>
  );
}

// ---------- narrative builder --------------------------------------------
//
// Company overview assembled strictly from fields that are actually
// populated: a one/two-sentence lede for identity, then skimmable highlight
// rows (operations, products, footprint, verification, brands). Key data
// points are marked `strong` so the eye can jump between them. No row is
// emitted unless its underlying data exists — sparse profiles degrade to
// just the lede instead of padding with filler.

const TRADE_BODY_CODES = ["BGMEA", "BKMEA", "BGAPMEA", "BTMA"] as const;
const CERT_CODES = ["OEKO_TEX", "GOTS", "WRAP", "SA8000", "BSCI", "AMFORI", "SEDEX"] as const;

/** Inline text where `[[...]]` spans render bold — keeps the builder as
 *  plain strings while the renderer emits real `<strong>` for skim + SEO. */
type NarrativeText = string;

type NarrativeHighlight = {
  key: "operations" | "products" | "footprint" | "verification" | "brands";
  label: string;
  text: NarrativeText;
};

type CompanyNarrativeData = {
  lede: NarrativeText;
  highlights: NarrativeHighlight[];
};

function joinList(items: readonly string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]!}`;
}

function establishedPhrase(dateIso: string | null): string | null {
  const label = formatMonthYear(dateIso);
  if (!label || !dateIso) return null;
  const year = new Date(dateIso).getFullYear();
  const yearsOperating = new Date().getFullYear() - year;
  return yearsOperating >= 2
    ? `operating since [[${label}]]`
    : `established in [[${label}]]`;
}

function buildNarrative(
  s: ProfileOverviewSupplier,
  primaryAddress: string | null,
  t13SourceCount: number,
  sourceTags: readonly string[],
  counts: {
    provenanceCount: number;
    uniqueLocationCount: number;
    factoryLocationCount: number;
  },
): CompanyNarrativeData {
  const name = formatCompanyName(s.company_name);
  const location = formatProfileLocationCompact(primaryAddress, s.city, s.district);
  const products = dedupProducts(s.principal_products);

  // Lede — identity, place, tenure, group.
  let kind: string;
  if (s.entity_type === "buying_house") {
    kind = "buying house";
  } else {
    const primaryProduct = products[0]
      ? correctProductSpelling(products[0]).toLowerCase()
      : null;
    kind = primaryProduct ? `${primaryProduct} manufacturer` : "garment manufacturer";
  }
  const place = location
    ? ` based in [[${location}${s.country ? `, ${s.country}` : ""}]]`
    : s.country
      ? ` based in [[${s.country}]]`
      : "";
  const tenure = establishedPhrase(s.established_date);
  let lede = `${name} is ${articleFor(kind)} [[${kind}]]${place}${tenure ? `, ${tenure}` : ""}.`;
  if (s.parent_group_name) {
    lede += ` It operates as part of [[${s.parent_group_name}]].`;
  }

  const highlights: NarrativeHighlight[] = [];

  // Operations — factory types, workforce, EPZ zone.
  const opsParts: string[] = [];
  if (s.entity_type !== "buying_house" && s.factory_types.length > 0) {
    opsParts.push(
      `${articleFor(s.factory_types[0]!)} [[${joinList(s.factory_types.map((t) => t.toLowerCase()))}]] operation`,
    );
  }
  if (s.employees_total != null) {
    opsParts.push(`a workforce of [[~${s.employees_total.toLocaleString()}]]`);
  }
  if (opsParts.length > 0) {
    let ops = `Runs ${joinList(opsParts)}`;
    if (s.bepza_zone) ops += ` inside the [[${s.bepza_zone}]] export processing zone`;
    highlights.push({ key: "operations", label: "Operations", text: `${ops}.` });
  } else if (s.bepza_zone) {
    highlights.push({
      key: "operations",
      label: "Operations",
      text: `Operates inside the [[${s.bepza_zone}]] export processing zone.`,
    });
  }

  // Products — breadth and leads. Leads that just restate the lede's kind
  // or the factory types ("Knit", "Woven" as products) are skipped so the
  // same words don't appear twice in three lines.
  if (products.length > 1) {
    const alreadySaid = new Set(
      [
        products[0] ?? "",
        ...s.factory_types,
        ...s.factory_types.map((t) => `${t}ted`),
      ].map((v) => v.toLowerCase()),
    );
    const leads = products
      .filter((p, i) => i === 0 || !alreadySaid.has(p.toLowerCase()))
      .slice(1, 4)
      .map((p) => correctProductSpelling(p));
    highlights.push({
      key: "products",
      label: "Product range",
      text:
        leads.length > 0
          ? `[[${products.length} declared categories]], including [[${joinList(leads)}]].`
          : `[[${products.length} declared categories]] on file.`,
    });
  }

  // Footprint — deduped locations.
  if (counts.uniqueLocationCount > 1) {
    const factories =
      counts.factoryLocationCount > 0
        ? `, including [[${counts.factoryLocationCount} ${
            counts.factoryLocationCount === 1 ? "factory site" : "factory sites"
          }]]`
        : "";
    highlights.push({
      key: "footprint",
      label: "Footprint",
      text: `[[${counts.uniqueLocationCount} distinct locations]] on file${factories}.`,
    });
  }

  // Verification — categorised trust breakdown.
  if (t13SourceCount > 0) {
    const tagSet = new Set(sourceTags);
    const evidence: string[] = [];
    const tradeBodies = TRADE_BODY_CODES.filter((c) => tagSet.has(c)).map(sourceCodeLabel);
    if (tradeBodies.length > 0) {
      evidence.push(
        `trade-body ${tradeBodies.length === 1 ? "registration" : "registrations"} with [[${joinList(tradeBodies)}]]`,
      );
    }
    if (tagSet.has("EPB")) {
      evidence.push("export registration with the [[Export Promotion Bureau]]");
    }
    const certs = CERT_CODES.filter((c) => tagSet.has(c)).map(sourceCodeLabel);
    if (certs.length > 0) {
      evidence.push(
        `${certs.length === 1 ? "certification" : "certifications"} from [[${joinList(certs)}]]`,
      );
    }
    if (tagSet.has("RSC")) {
      evidence.push("[[RMG Sustainability Council]] safety-programme enrolment");
    }

    const authorityWord = t13SourceCount === 1 ? "authority" : "authorities";
    const recordWord = counts.provenanceCount === 1 ? "record" : "records";
    let trust = `Corroborated by [[${t13SourceCount} independent ${authorityWord}]] across ${counts.provenanceCount} source ${recordWord}`;
    if (evidence.length > 0) {
      trust += `: ${joinList(evidence)}`;
    } else {
      const tops = topAuthorityLabels(sourceTags, 2);
      if (tops.length > 0) trust += `, including [[${joinList(tops)}]]`;
    }
    highlights.push({
      key: "verification",
      label: "Verification",
      text: `${trust}.`,
    });

    const brands = sourceTags
      .filter((t) => t.startsWith("BRAND_"))
      .map(sourceCodeLabel);
    if (brands.length > 0) {
      highlights.push({
        key: "brands",
        label: "Brand disclosures",
        text: `Named on ${brands.length === 1 ? "the published supplier list of" : "published supplier lists from"} [[${joinList(brands)}]].`,
      });
    }
  }

  return { lede, highlights };
}

/** Expand `[[...]]` markers into `<strong>` spans. */
function renderNarrativeText(text: NarrativeText): ReactNode[] {
  return text.split(/\[\[(.+?)\]\]/g).map((chunk, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-neutral-900">
        {chunk}
      </strong>
    ) : (
      chunk
    ),
  );
}

/** Editorial layout — a lede paragraph, then label/value rows aligned on a
 *  shared left column. No bullet icons: the labels do the wayfinding, which
 *  keeps the card reading like a written brief instead of a feature list. */
function CompanyNarrative({ narrative }: { narrative: CompanyNarrativeData }) {
  return (
    <div>
      <p className="max-w-[72ch] text-[15px] leading-7 text-neutral-700">
        {renderNarrativeText(narrative.lede)}
      </p>
      {narrative.highlights.length > 0 ? (
        <dl className="mt-5 space-y-3.5">
          {narrative.highlights.map((h) => (
            <div key={h.key} className="sm:flex sm:gap-5">
              <dt className="shrink-0 pt-px text-[12.5px] font-semibold leading-6 text-neutral-500 sm:w-[7.5rem]">
                {h.label}
              </dt>
              <dd className="min-w-0 max-w-[68ch] text-[14px] leading-6 text-neutral-600">
                {renderNarrativeText(h.text)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
