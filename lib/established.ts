// Shared formatter for the free-text `suppliers.established_date` column.
//
// The column is text and arrives in mixed shapes ("2009-03-09", "1999",
// "1999-01-01", occasionally a stray label). The buyer/marketing surfaces
// must render the YEAR only per frontend-design-spec.md §4.4 — never the raw
// ISO date. This extracts the first 4-digit run; if none is present it
// falls back to the raw string rather than inventing a value.

export function establishedYear(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/\d{4}/);
  return match ? match[0] : raw;
}
