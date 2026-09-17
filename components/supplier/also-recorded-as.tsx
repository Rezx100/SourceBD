import { AuthorityChip } from "@/components/supplier/authority-chip";
import { toTitleCaseAddress } from "@/lib/format-location";
import type { AddressVariant } from "@/lib/dedup-addresses";

/** Hook-free "Also recorded as" pills. Extracted so the Locations row can be
 *  asserted at the rendered-HTML boundary without mounting the client map. */
export function AlsoRecordedAs({ variants }: { variants: AddressVariant[] }) {
  if (variants.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1" data-also-recorded="">
      <p className="text-[12px] text-neutral-500">Also recorded as</p>
      <ul className="flex flex-col gap-1">
        {variants.map((variant) => (
          <li
            key={variant.address}
            className="flex flex-wrap items-center gap-1.5"
            data-also-recorded-as=""
            data-also-recorded-authorities={variant.authorities.join(",")}
          >
            <span className="text-[12.5px] leading-[1.4] text-neutral-600">
              {toTitleCaseAddress(variant.address)}
            </span>
            {variant.authorities.map((code) => (
              <AuthorityChip
                key={code}
                label={code.replace(/_/g, "-")}
                className="px-1.5 py-[2px] text-[10.5px] sm:text-[11px]"
              />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hook-free location row shell — display spelling, pills, and the row
 *  attributes a buyer (and the HTTP guard) can count. */
export function LocationRowMarkup({
  groupTitle,
  display,
  variants,
  authorities = [],
}: {
  groupTitle: string;
  display: string;
  variants: AddressVariant[];
  authorities?: string[];
}) {
  return (
    <div data-location-row="" data-location-group={groupTitle}>
      <p data-location-display="">{toTitleCaseAddress(display)}</p>
      {authorities.length > 0 ? (
        <div>
          {authorities.map((code) => (
            <AuthorityChip
              key={code}
              label={code.replace(/_/g, "-")}
              className="px-1.5 py-[2px] text-[10.5px] sm:text-[11px]"
            />
          ))}
        </div>
      ) : null}
      <AlsoRecordedAs variants={variants} />
    </div>
  );
}
