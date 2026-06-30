import type { ReactNode } from "react";
import {
  CalendarBlank,
  ClockCounterClockwise,
  Hash,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";

export type ProfileHeaderMetaItem = {
  key: string;
  label: string;
  icon: "address" | "established" | "registry" | "verified";
  children: ReactNode;
};

const META_ICONS = {
  address: MapPin,
  established: CalendarBlank,
  registry: Hash,
  verified: ClockCounterClockwise,
} as const;

export function ProfileHeaderMetaGrid({
  items,
}: {
  items: ProfileHeaderMetaItem[];
}) {
  if (items.length === 0) return null;

  return (
    <dl className="header-meta-row">
      {items.map((item) => {
        const Icon = META_ICONS[item.icon];
        return (
          <div key={item.key} className="header-meta-cell">
            <dt className="header-meta-label">
              <Icon size={14} weight="duotone" aria-hidden />
              <span>{item.label}</span>
            </dt>
            <dd className="header-meta-value">{item.children}</dd>
          </div>
        );
      })}
    </dl>
  );
}
