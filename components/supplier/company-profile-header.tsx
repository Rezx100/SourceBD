import type { ReactNode } from "react";
import Link from "next/link";
import { Buildings, Factory, MapPin } from "@phosphor-icons/react/dist/ssr";

import { CompanyAvatar } from "@/components/supplier/company-avatar";
import {
  ProfileHeaderStatsRow,
  type ProfileHeaderMetaItem,
} from "@/components/supplier/profile-header-meta";
import { VerifiedAuthorityPill } from "@/components/supplier/verified-authority-pill";
import { mergeUniqueLocations, type AddressRowRaw } from "@/lib/dedup-addresses";
import {
  formatMonthYear,
  formatProfileDate,
  groupProvenanceAuthorities,
  latestProvenanceRecord,
  verifiedBadgeLabelCompact,
  verifiedBadgeLabelWithDate,
} from "@/lib/format-supplier-profile";
import { formatCompanyName } from "@/lib/format-company-name";
import { resolveHeaderRegistration } from "@/lib/header-registration";
import { formatCardLocation, toTitleCaseAddress } from "@/lib/format-location";
import { profileHeaderChipClass } from "@/lib/profile-tab-styles";
import { cn } from "@/lib/utils";

export type CompanyProfileHeaderSupplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: "factory" | "buying_house" | "unknown";
  city: string | null;
  district: string | null;
  address_raw: string | null;
  completeness_pct: number;
  parent_group_name: string | null;
  established_date: string | null;
  factory_types: string[];
  employees_total: number | null;
};

/** REZ-114 — pre-selected workers headline (never raw employees_total alone). */
export type ProfileWorkersHeadline = {
  value: number | null;
  caption: string;
};

export type CompanyProfileHeaderPill = {
  source_code: string;
  value: string | null;
  inherited_from?: string | null;
  /** REZ-110: facility-held — ignored by resolveHeaderRegistration. */
  building_name?: string | null;
};

export type CompanyProfileHeaderProvenance = {
  source_code: string;
  display_name: string;
  tier: string;
  last_seen_at: string;
};

const ENTITY_LABELS: Record<CompanyProfileHeaderSupplier["entity_type"], string | null> = {
  factory: "Factory",
  buying_house: "Buying house",
  unknown: null,
};

export function CompanyProfileHeader<TAddress extends AddressRowRaw>({
  supplier: s,
  workers,
  t13SourceCount,
  pills,
  provenance,
  addresses,
  followSlot,
  contactSlot,
  discoverHref,
}: {
  supplier: CompanyProfileHeaderSupplier;
  /** REZ-114 selection result — required for Production workers fact. */
  workers: ProfileWorkersHeadline;
  t13SourceCount: number;
  pills: readonly CompanyProfileHeaderPill[];
  provenance: readonly CompanyProfileHeaderProvenance[];
  addresses: readonly TAddress[];
  followSlot: ReactNode;
  contactSlot: ReactNode;
  discoverHref: "/app/discover" | "/discover";
}) {
  const uniqueLocations = mergeUniqueLocations(addresses);
  const primaryAddress =
    uniqueLocations[0]?.displayAddress ?? s.address_raw ?? addresses[0]?.address ?? null;
  const latestProv = latestProvenanceRecord(provenance);
  const registration = resolveHeaderRegistration(pills);
  const authorityGroups = groupProvenanceAuthorities(provenance);

  const verifiedDateLabel = latestProv ? formatProfileDate(latestProv.last_seen_at) : null;
  const addressLabel = primaryAddress ? toTitleCaseAddress(primaryAddress) : null;
  const locationLabel = formatCardLocation(primaryAddress, s.city, s.district);
  const entityLabel = ENTITY_LABELS[s.entity_type];

  // Label-over-value fact cluster below the hairline — same quiet scale as
  // the rest of the profile surface. Full address lives here (not truncated
  // to city like the preview card), so no data is dropped.
  const facts: ProfileHeaderMetaItem[] = [];
  if (addressLabel) {
    facts.push({
      key: "address",
      label: "Registered address",
      icon: "address",
      children: addressLabel,
    });
  }
  if (workers.value != null) {
    facts.push({
      key: "employees",
      label: "Production workers",
      icon: "employees",
      children: (
        <span>
          {workers.value.toLocaleString()}
          {workers.caption ? (
            <span className="mt-0.5 block text-[11px] font-normal text-neutral-500">
              {workers.caption}
            </span>
          ) : null}
        </span>
      ),
    });
  } else {
    facts.push({
      key: "employees",
      label: "Production workers",
      icon: "employees",
      children: (
        <span>
          Unknown
          {workers.caption ? (
            <span className="mt-0.5 block text-[11px] font-normal text-neutral-500">
              {workers.caption}
            </span>
          ) : null}
        </span>
      ),
    });
  }
  const establishedLabel = formatMonthYear(s.established_date);
  if (establishedLabel) {
    facts.push({
      key: "established",
      label: "Established",
      icon: "established",
      children: establishedLabel,
    });
  }
  if (registration) {
    facts.push({
      key: "registration",
      label: `${registration.sourceCode} registration`,
      icon: "registry",
      children: registration.value,
    });
  }

  const showFooter = facts.length > 0 || followSlot || contactSlot;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[18px] border border-neutral-200 bg-white px-3 py-3.5 text-left sm:px-7 sm:py-5",
        "shadow-[0_1px_2px_rgba(15,15,20,0.04),0_6px_16px_-8px_rgba(15,15,20,0.06)]",
        "transition-shadow duration-200 ease-smooth hover:shadow-[0_1px_3px_rgba(15,15,20,0.05),0_10px_24px_-10px_rgba(15,15,20,0.09)]",
        // One restrained accent: a faint forest wash behind the identity
        // block only — gives the eye somewhere to rest without decorating.
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-28 before:bg-gradient-to-b before:from-brand-forest/[0.035] before:to-transparent",
      )}
      aria-labelledby="company-name"
    >
      {/* 1px nudge so content sits just off the left hairline, without
          disturbing the card's own symmetric padding. */}
      <div className="pl-px sm:pl-0">
        {/* Identity block — avatar optically centred against the name +
            metadata stack, name dominating. On phones the avatar+name pair
            sits alone and the chip/parent rows drop below at full card
            width, so long company names and the verified pill never fight
            the avatar for ~230px of column. */}
        <div className="relative">
          <div className="flex items-center gap-3 xs:gap-3.5 sm:gap-5">
            <CompanyAvatar
              name={s.company_name}
              verified={t13SourceCount > 0}
              variant="profile"
              className="shrink-0"
            />

            <div className="min-w-0 flex-1">
              <h1
                id="company-name"
                className="line-clamp-2 font-display text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-neutral-900 [overflow-wrap:anywhere] min-[390px]:text-[26px] min-[390px]:leading-[1.1] sm:text-[34px] sm:leading-[1.06]"
              >
                {formatCompanyName(s.company_name)}
              </h1>

              <div className="mt-3 hidden flex-wrap items-center gap-x-4 gap-y-2 sm:flex">
                <HeaderChips
                  entityLabel={entityLabel}
                  locationLabel={locationLabel}
                  t13SourceCount={t13SourceCount}
                  verifiedDateLabel={verifiedDateLabel}
                  provenanceCount={provenance.length}
                  authorityGroups={authorityGroups}
                />
              </div>

              {s.parent_group_name ? (
                <div className="hidden sm:block">
                  <ParentGroupLine
                    name={s.parent_group_name}
                    discoverHref={discoverHref}
                  />
                </div>
              ) : null}
            </div>
          </div>

          {/* Phone-only copies of the chip + parent rows, at full card width.
              nowrap + a scroll fallback keeps entity type, location, and the
              verified badge on a single line even for longer district names. */}
          <div className="mt-3 flex flex-nowrap items-center gap-1.5 overflow-x-auto sm:hidden">
            <HeaderChips
              entityLabel={entityLabel}
              locationLabel={locationLabel}
              t13SourceCount={t13SourceCount}
              verifiedDateLabel={verifiedDateLabel}
              provenanceCount={provenance.length}
              authorityGroups={authorityGroups}
            />
          </div>
          {s.parent_group_name ? (
            <div className="sm:hidden">
              <ParentGroupLine name={s.parent_group_name} discoverHref={discoverHref} />
            </div>
          ) : null}
        </div>

        {showFooter ? (
          <>
            {/* Hairline fades at both ends so it reads as a content-width
                separator, not an edge-to-edge cut. */}
            <div
              aria-hidden
              className="mt-4 h-px bg-gradient-to-r from-neutral-200/0 via-neutral-200/70 to-neutral-200/0 sm:mt-5"
            />
            <div className="mt-4 flex flex-col gap-4 sm:mt-5 sm:gap-5 lg:flex-row lg:items-center">
              <ProfileHeaderStatsRow stats={facts} />
              {/* Phones: full-width action pair — Follow keeps its
                  intrinsic width, the primary Contact CTA absorbs the
                  remaining span so neither label can truncate. sm+:
                  intrinsic-width row. */}
              <div
                className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:shrink-0 sm:items-center sm:gap-1.5 lg:ml-6 lg:justify-end"
                aria-label="Profile actions"
              >
                {followSlot}
                {contactSlot}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function HeaderChips({
  entityLabel,
  locationLabel,
  t13SourceCount,
  verifiedDateLabel,
  provenanceCount,
  authorityGroups,
}: {
  entityLabel: string | null;
  locationLabel: string | null;
  t13SourceCount: number;
  verifiedDateLabel: string | null;
  provenanceCount: number;
  authorityGroups: ReturnType<typeof groupProvenanceAuthorities>;
}) {
  return (
    <>
      {entityLabel ? (
        <span className={profileHeaderChipClass}>
          <Factory size={11} weight="duotone" aria-hidden className="shrink-0 text-neutral-500 sm:hidden" />
          <Factory size={14} weight="duotone" aria-hidden className="hidden shrink-0 text-neutral-500 sm:block" />
          <span className="truncate">{entityLabel}</span>
        </span>
      ) : null}
      {locationLabel ? (
        <span className={profileHeaderChipClass}>
          <MapPin size={11} weight="duotone" aria-hidden className="shrink-0 text-neutral-500 sm:hidden" />
          <MapPin size={14} weight="duotone" aria-hidden className="hidden shrink-0 text-neutral-500 sm:block" />
          <span className="truncate">{locationLabel}</span>
        </span>
      ) : null}
      {t13SourceCount > 0 && verifiedDateLabel ? (
        <VerifiedAuthorityPill
          badgeLabel={verifiedBadgeLabelWithDate(t13SourceCount, verifiedDateLabel)}
          badgeLabelShort={verifiedBadgeLabelCompact(t13SourceCount)}
          authorityCount={t13SourceCount}
          provenanceRecordCount={provenanceCount}
          authorities={authorityGroups}
        />
      ) : null}
    </>
  );
}

function ParentGroupLine({
  name,
  discoverHref,
}: {
  name: string;
  discoverHref: "/app/discover" | "/discover";
}) {
  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[13.5px] font-medium text-neutral-600">
      <Buildings
        size={16}
        weight="duotone"
        aria-hidden
        className="shrink-0 text-neutral-400"
      />
      <span className="text-neutral-500">Member of</span>
      <Link
        href={`${discoverHref}?group=${encodeURIComponent(name)}`}
        className="font-semibold text-brand-forest underline decoration-brand-forest/30 underline-offset-2 hover:bg-brand-forest-soft"
      >
        {name}
      </Link>
    </p>
  );
}
