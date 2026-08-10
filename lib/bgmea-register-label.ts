/**
 * Buyer-facing BGMEA register wording (REZ-115).
 * Derived from the registry pill label written by the view — never guessed
 * from the bare registration number.
 */
export function bgmeaRegisterPlainLabel(label: string | null | undefined): string | null {
  const t = (label ?? "").trim().toLowerCase();
  if (t.includes("general")) return "General member";
  if (t.includes("associate")) return "Associate member";
  return null;
}
