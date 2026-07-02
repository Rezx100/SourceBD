import { resolveLocationFromAddress } from "@/lib/resolve-location-from-address";

function titleCasePlace(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Full city / district line with foreign-reader labels (City …, Dist …). */
export function formatCityDistrictLine(
  city: string | null | undefined,
  district: string | null | undefined,
): string | null {
  const parts: string[] = [];

  if (city?.trim()) {
    parts.push(`City ${titleCasePlace(city.trim())}`);
  }
  if (district?.trim()) {
    parts.push(`Dist ${titleCasePlace(district.trim())}`);
  }

  return parts.length > 0 ? parts.join(", ") : null;
}

/** City / Dist line for profile headers — prefer locality parsed from the
 *  displayed primary address so HQ and factory rows stay consistent. */
export function formatProfileCityLine(
  primaryAddress: string | null | undefined,
  city: string | null | undefined,
  district: string | null | undefined,
): string | null {
  const fromAddress = resolveLocationFromAddress(primaryAddress);
  if (fromAddress) {
    return formatCityDistrictLine(fromAddress.city, fromAddress.district);
  }
  return formatCityDistrictLine(city, district);
}

/** @deprecated Use `formatCityDistrictLine`. Kept for existing imports. */
export const formatCityDistrictShort = formatCityDistrictLine;

/** Single-word locality for the compact list-card design (decided 2 Jul, UX
 *  audit): cards show just "Dhaka", not the profile header's verbose
 *  "City Dhaka, Dist Dhaka" line. Prefers the locality parsed from the
 *  displayed primary address, same source-of-truth as `formatProfileCityLine`,
 *  falling back to the raw `city`/`district` fields. */
export function formatCardLocation(
  primaryAddress: string | null | undefined,
  city: string | null | undefined,
  district: string | null | undefined,
): string | null {
  const fromAddress = resolveLocationFromAddress(primaryAddress);
  const resolvedCity = fromAddress?.city ?? city?.trim() ?? null;
  const resolvedDistrict = fromAddress?.district ?? district?.trim() ?? null;
  const label = resolvedCity || resolvedDistrict;
  return label ? titleCasePlace(label) : null;
}
