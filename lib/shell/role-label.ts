import type { Role } from "@/lib/auth";

/** Public-facing role line shown under the user's name in shell chrome. */
export const ROLE_PUBLIC_LABEL: Record<Role, string> = {
  buyer: "Buyer account",
  supplier: "Supplier account",
  admin: "Admin account",
};

export function publicRoleLabel(role: Role | null | undefined): string {
  if (role && role in ROLE_PUBLIC_LABEL) {
    return ROLE_PUBLIC_LABEL[role as Role];
  }
  return "Signed in";
}
