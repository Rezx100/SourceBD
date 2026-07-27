"use client";

// Interactive Locations section — binds LocationsMap ↔ address list via shared
// selectedIndex state so clicking an address row flies to that pin, and clicking
// a map pin highlights that row in the list.

import { useCallback, useState } from "react";
import {
  Buildings,
  EnvelopeSimple,
  Factory,
  MapPin,
} from "@phosphor-icons/react";

import { AuthorityChip } from "@/components/supplier/authority-chip";
import { LocationsAddressGroup } from "@/components/supplier/locations-address-group";
import { LocationsMap, type LocationMapMarker } from "@/components/supplier/locations-map";
import { secondaryTypeLabels } from "@/lib/dedup-addresses";
import { toTitleCaseAddress } from "@/lib/format-location";

// ─── Serialisable shape passed from the server component ─────────────────────

export type SerializableLocation = {
  displayAddress: string;
  floors: string[];
  variants: string[];
  types: string[];
  authorities: string[];
  /** Index into the `markers` array for this location, or null if not geocoded. */
  markerIndex: number | null;
};

export type SerializableGroup = {
  title: string;
  locations: SerializableLocation[];
};

// ─── Group icon map ───────────────────────────────────────────────────────────

const GROUP_ICON: Record<string, React.ReactNode> = {
  Factories: <Factory size={17} weight="duotone" aria-hidden />,
  "Registered offices": <Buildings size={17} weight="duotone" aria-hidden />,
  "Mailing addresses": <EnvelopeSimple size={17} weight="duotone" aria-hidden />,
  "Other addresses": <MapPin size={17} weight="duotone" aria-hidden />,
};

// ─── Address row ─────────────────────────────────────────────────────────────

function AddressRow({
  location,
  groupTitle,
  isSelected,
  onClick,
}: {
  location: SerializableLocation;
  groupTitle: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const also = secondaryTypeLabels(location.types);
  const display = toTitleCaseAddress(location.displayAddress);
  const extraFloors = location.floors.filter(
    (floor) => !display.toLowerCase().includes(floor.toLowerCase()),
  );

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full flex-col gap-2 rounded-lg px-2 py-3 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        isSelected
          ? "bg-brand-forest-soft ring-1 ring-brand-forest/20"
          : "hover:bg-neutral-50",
      ].join(" ")}
      aria-current={isSelected ? "true" : undefined}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:flex-1">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-[8px] border border-neutral-200/70 bg-[#fafaf9] text-neutral-500 sm:mt-px sm:size-auto sm:rounded-none sm:border-0 sm:bg-transparent sm:text-neutral-400"
          aria-hidden
        >
          {GROUP_ICON[groupTitle] ?? <MapPin size={17} weight="duotone" aria-hidden />}
        </span>
        <p
          className="min-w-0 pt-0.5 text-[14.5px] leading-[1.45] text-neutral-800 sm:pt-0"
          title={
            location.variants.length > 0
              ? `Also recorded as: ${location.variants.join(" · ")}`
              : undefined
          }
        >
          {display}
          {extraFloors.length > 0 ? (
            <span className="ml-1.5 text-[13px] font-normal text-neutral-500">
              Also on {extraFloors.join(", ")}
            </span>
          ) : null}
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
              label={code.replace(/_/g, "-")}
              className="px-2 py-[3px] text-[11px] sm:px-2.5 sm:py-0.5 sm:text-[12px]"
            />
          ))}
        </div>
      ) : null}
    </button>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function LocationsSection({
  markers,
  groups,
}: {
  markers: LocationMapMarker[];
  groups: SerializableGroup[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleAddressClick = useCallback((markerIndex: number | null) => {
    setSelectedIndex((prev) => (prev === markerIndex ? null : markerIndex));
  }, []);

  const handleMapFocus = useCallback((index: number | null) => {
    setSelectedIndex(index);
  }, []);

  return (
    <div>
      {markers.length > 0 ? (
        <div className="mb-5">
          <LocationsMap
            markers={markers}
            focusedIndex={selectedIndex}
            onFocusChange={handleMapFocus}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <LocationsAddressGroup
            key={group.title}
            title={group.title}
            count={group.locations.length}
          >
            {group.locations.map((location) => {
              const isSelected =
                location.markerIndex !== null &&
                selectedIndex === location.markerIndex;

              return (
                <AddressRow
                  key={location.displayAddress}
                  location={location}
                  groupTitle={group.title}
                  isSelected={isSelected}
                  onClick={() => handleAddressClick(location.markerIndex)}
                />
              );
            })}
          </LocationsAddressGroup>
        ))}
      </div>
    </div>
  );
}
