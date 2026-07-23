/** Shared registry ID resolution for the profile header and Compliance tab. */

export const HEADER_REGISTRATION_PRIORITY = ["RJSC", "BIN", "EPB"] as const;

export type RegistryPillLike = {
  source_code: string;
  value: string | null;
  inherited_from?: string | null;
};

/** Same `pill.value` field rendered in Compliance → Registries rows. */
export function registryPillRef(
  pills: readonly RegistryPillLike[],
  sourceCode: string,
): string | null {
  const matches = pills.filter(
    (p) => p.source_code === sourceCode && p.value?.trim(),
  );
  if (matches.length === 0) return null;
  const direct = matches.find((p) => !p.inherited_from);
  return (direct ?? matches[0])!.value!.trim();
}

export function resolveHeaderRegistration(
  pills: readonly RegistryPillLike[],
): { sourceCode: string; value: string; statValue: string } | null {
  for (const code of HEADER_REGISTRATION_PRIORITY) {
    const value = registryPillRef(pills, code);
    if (value) {
      return { sourceCode: code, value, statValue: `${code} ${value}` };
    }
  }
  return null;
}
