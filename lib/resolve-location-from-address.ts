// Derive city / district labels from free-text Bangladesh addresses shown on
// supplier profiles. Mirrors the high-confidence alias map in ETL address_norm
// so the City / Dist line matches the primary address row, not the supplier-
// level factory locality when those differ (e.g. Gulshan HQ vs Rupganj mill).

export type ResolvedLocation = {
  city: string;
  district: string;
};

type AliasRule = {
  pattern: RegExp;
  city: string;
  district: string;
};

/** Longer / more specific patterns first. */
const ALIAS_RULES: AliasRule[] = [
  { pattern: /\bgulshan[\s-]*2\b/i, city: "Gulshan", district: "Dhaka" },
  { pattern: /\bgulshan\b/i, city: "Gulshan", district: "Dhaka" },
  { pattern: /\bbanani\b/i, city: "Banani", district: "Dhaka" },
  { pattern: /\bdhanmondi\b/i, city: "Dhanmondi", district: "Dhaka" },
  { pattern: /\buttara\b/i, city: "Uttara", district: "Dhaka" },
  { pattern: /\bmirpur\b/i, city: "Mirpur", district: "Dhaka" },
  { pattern: /\bmohakhali\b/i, city: "Mohakhali", district: "Dhaka" },
  { pattern: /\btejgaon\b/i, city: "Tejgaon", district: "Dhaka" },
  { pattern: /\bmotijheel\b/i, city: "Motijheel", district: "Dhaka" },
  { pattern: /\bsavar\b/i, city: "Savar", district: "Dhaka" },
  { pattern: /\bashulia\b/i, city: "Ashulia", district: "Dhaka" },
  { pattern: /\bkeraniganj\b/i, city: "Keraniganj", district: "Dhaka" },
  { pattern: /\btongi\b/i, city: "Tongi", district: "Gazipur" },
  { pattern: /\bsreepur\b/i, city: "Sreepur", district: "Gazipur" },
  { pattern: /\brupganj\b/i, city: "Rupganj", district: "Narayanganj" },
  { pattern: /\brupgonj\b/i, city: "Rupganj", district: "Narayanganj" },
  { pattern: /\bsonargaon\b/i, city: "Sonargaon", district: "Narayanganj" },
  { pattern: /\bsiddhirganj\b/i, city: "Siddhirganj", district: "Narayanganj" },
  { pattern: /\bfatullah\b/i, city: "Fatullah", district: "Narayanganj" },
  { pattern: /\bagrabad\b/i, city: "Agrabad", district: "Chattogram" },
  { pattern: /\bhalishahar\b/i, city: "Halishahar", district: "Chattogram" },
];

const DISTRICT_RULES: { pattern: RegExp; district: string }[] = [
  { pattern: /\bnarayanganj\b/i, district: "Narayanganj" },
  { pattern: /\bnarayangonj\b/i, district: "Narayanganj" },
  { pattern: /\bgazipur\b/i, district: "Gazipur" },
  { pattern: /\bdhaka\b/i, district: "Dhaka" },
  { pattern: /\bdacca\b/i, district: "Dhaka" },
  { pattern: /\bchattogram\b/i, district: "Chattogram" },
  { pattern: /\bchittagong\b/i, district: "Chattogram" },
  { pattern: /\bcumilla\b/i, district: "Cumilla" },
  { pattern: /\bcomilla\b/i, district: "Cumilla" },
  { pattern: /\bsylhet\b/i, district: "Sylhet" },
  { pattern: /\brangpur\b/i, district: "Rangpur" },
  { pattern: /\bkhulna\b/i, district: "Khulna" },
  { pattern: /\brajshahi\b/i, district: "Rajshahi" },
  { pattern: /\bmymensingh\b/i, district: "Mymensingh" },
  { pattern: /\bnarsingdi\b/i, district: "Narsingdi" },
];

/** Best-effort parse of city + district from a displayed address string. */
export function resolveLocationFromAddress(
  address: string | null | undefined,
): ResolvedLocation | null {
  const text = address?.trim();
  if (!text) return null;

  for (const rule of ALIAS_RULES) {
    if (rule.pattern.test(text)) {
      return { city: rule.city, district: rule.district };
    }
  }

  for (const rule of DISTRICT_RULES) {
    if (rule.pattern.test(text)) {
      return { city: rule.district, district: rule.district };
    }
  }

  return null;
}
