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

/** @deprecated Use `formatCityDistrictLine`. Kept for existing imports. */
export const formatCityDistrictShort = formatCityDistrictLine;
