import type { ReactNode } from "react";
import {
  Buildings,
  EnvelopeSimple,
  Factory,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";

import { AuthorityChip } from "@/components/supplier/authority-chip";
import { LocationsAddressGroup } from "@/components/supplier/locations-address-group";
import { LocationsMap } from "@/components/supplier/locations-map";
import { geocodeAddresses } from "@/lib/barikoi";
import { PrincipalProductsCard } from "@/components/supplier/principal-products-card";
import {
  ProfileCard,
  ProfileCardHeader,
  ProfileTabStack,
} from "@/components/supplier/profile-ui";
import {
  buildLocationOverview,
  locationOverviewMeta,
  mergeUniqueLocations,
  secondaryTypeLabels,
  type AddressRowRaw,
  type GroupTitle,
  type UniqueLocation,
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

const GROUP_ICON: Record<GroupTitle, ReactNode> = {
  Factories: <Factory size={17} weight="duotone" aria-hidden />,
  "Registered offices": <Buildings size={17} weight="duotone" aria-hidden />,
  "Mailing addresses": <EnvelopeSimple size={17} weight="duotone" aria-hidden />,
  "Other addresses": <MapPin size={17} weight="duotone" aria-hidden />,
};

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

  return (
    <ProfileCard id="locations">
      <ProfileCardHeader
        title="Locations & addresses"
        meta={locationOverviewMeta(
          overview.uniqueLocationCount,
          overview.sourceRecordCount,
        )}
      />
      <div className="flex flex-col gap-5">
        {overview.groups.map((group) => (
          <LocationsAddressGroup
            key={group.title}
            title={group.title}
            count={group.locations.length}
          >
            {group.locations.map((location, i) => (
              <AddressRow key={i} location={location} groupTitle={group.title} />
            ))}
          </LocationsAddressGroup>
        ))}
      </div>
    </ProfileCard>
  );
}

export async function ProfileOverviewTab<TAddress extends AddressRowRaw>({
  supplier: s,
  t13SourceCount,
  provenanceCount,
  addresses,
}: {
  supplier: ProfileOverviewSupplier;
  t13SourceCount: number;
  provenanceCount: number;
  addresses: readonly TAddress[];
  discoverHref: "/app/discover" | "/discover";
}) {
  const overview = buildLocationOverview(addresses);
  const primaryAddress =
    mergeUniqueLocations(addresses)[0]?.displayAddress ?? null;

  // Geocode the deduped locations for the map (Barikoi; DB cache first,
  // bounded live fallback). Failure or missing key = no map, never an error.
  const mapMarkers = await geocodeAddresses(
    overview.groups.flatMap((g) =>
      g.locations.map((l) => toTitleCaseAddress(l.displayAddress)),
    ),
  );

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

      {overview.uniqueLocationCount > 0 ? (
        <ProfileCard id="locations">
          <ProfileCardHeader
            title="Locations & addresses"
            meta={locationOverviewMeta(
              overview.uniqueLocationCount,
              overview.sourceRecordCount,
            )}
          />
          {mapMarkers.length > 0 ? (
            <div className="mb-5">
              <LocationsMap markers={mapMarkers} />
            </div>
          ) : null}
          <div className="flex flex-col gap-5">
            {overview.groups.map((group) => (
              <LocationsAddressGroup
                key={group.title}
                title={group.title}
                count={group.locations.length}
              >
                {group.locations.map((location, i) => (
                  <AddressRow key={i} location={location} groupTitle={group.title} />
                ))}
              </LocationsAddressGroup>
            ))}
          </div>
        </ProfileCard>
      ) : null}
    </ProfileTabStack>
  );
}

function AddressRow<TAddress extends AddressRowRaw>({
  location,
  groupTitle,
}: {
  location: UniqueLocation<TAddress>;
  groupTitle: GroupTitle;
}) {
  const also = secondaryTypeLabels(location.types);
  const display = toTitleCaseAddress(location.displayAddress);

  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-2.5 sm:flex-1">
        {/* Phones: boxed mark to match the source-mark language used
            elsewhere on the profile (Registries, Certifications); sm+
            reverts to the quieter bare icon. */}
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-neutral-200/70 bg-[#fafaf9] text-neutral-500 sm:mt-px sm:size-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:text-neutral-400"
          aria-hidden
        >
          {GROUP_ICON[groupTitle]}
        </span>
        <p className="min-w-0 pt-0.5 text-[14.5px] leading-[1.45] text-neutral-800 sm:pt-0">
          {display}
          {also.length > 0 ? (
            <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
              Also: {also.join(", ")}
            </span>
          ) : null}
        </p>
      </div>
      {location.authorities.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pl-[38px] sm:shrink-0 sm:justify-end sm:gap-1 sm:pl-0">
          {location.authorities.map((code) => (
            <AuthorityChip
              key={code}
              label={sourceCodeLabel(code)}
              className="px-2 py-[3px] text-[11px] sm:px-2.5 sm:py-0.5 sm:text-[12px]"
            />
          ))}
        </div>
      ) : null}
    </div>
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
