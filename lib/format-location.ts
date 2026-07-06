import { resolveLocationFromAddress } from "@/lib/resolve-location-from-address";
import { cleanAddressString } from "@/lib/dedup-addresses";

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

/** Compact "Gazipur, Dhaka" locality line — the single source of truth for
 *  "based in <location>" copy across the header and the Overview narrative,
 *  so the two surfaces never disagree. Never emits the verbose "City …,
 *  Dist …" labels; collapses to one term when city and district match. */
export function formatProfileLocationCompact(
  primaryAddress: string | null | undefined,
  city: string | null | undefined,
  district: string | null | undefined,
): string | null {
  const fromAddress = resolveLocationFromAddress(primaryAddress);
  const resolvedCity = fromAddress?.city ?? city?.trim() ?? null;
  const resolvedDistrict = fromAddress?.district ?? district?.trim() ?? null;
  if (!resolvedCity && !resolvedDistrict) return null;
  if (
    !resolvedDistrict ||
    !resolvedCity ||
    resolvedCity.toLowerCase() === resolvedDistrict.toLowerCase()
  ) {
    return titleCasePlace(resolvedCity ?? resolvedDistrict!);
  }
  return `${titleCasePlace(resolvedCity)}, ${titleCasePlace(resolvedDistrict)}`;
}

function titleCaseWord(word: string, prevChar: string): string {
  if (word.length === 0) return word;
  // Ordinal suffix glued to a digit: "2nd", not "2Nd".
  if (/\d/.test(prevChar) && /^(st|nd|rd|th)$/i.test(word)) {
    return word.toLowerCase();
  }
  // Unit / plot fragments like "9/A", "I/F" — keep single letters as-is.
  if (word.length === 1) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** ALL-CAPS registry addresses → Title Case at render time. Keeps ordinal
 *  suffixes lowercase ("2nd Floor"), preserves unit patterns like "9/A" and
 *  "I/F", and strips consecutive duplicate words. */
export function toTitleCaseAddress(address: string | null | undefined): string {
  if (!address) return "";

  let result = "";
  const cleaned = cleanAddressString(address);
  const re = /[A-Za-z]+(?:[''][A-Za-z]+)*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    result += cleaned.slice(lastIndex, match.index);
    const prevChar = match.index > 0 ? cleaned[match.index - 1]! : "";
    result += titleCaseWord(match[0], prevChar);
    lastIndex = match.index + match[0].length;
  }
  result += cleaned.slice(lastIndex);

  // "gazipur gazipur" → "gazipur" (case-insensitive consecutive dupes).
  result = result.replace(/\b(\w+(?:['']\w+)*)\b(\s+\1\b)+/gi, "$1");

  return result.replace(/\s+/g, " ").trim();
}
