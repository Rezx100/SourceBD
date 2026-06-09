// Server-rendered "Claim this company" CTA for buyer + public profile pages.
//
// Visibility:
//   * Anonymous viewer → link to /signup?role=supplier&next=/supplier/claim?supplier=<slug>
//   * Authed supplier  → link to /supplier/claim?supplier=<slug>
//   * Authed admin     → link to /supplier/claim?supplier=<slug>
//   * Authed buyer     → hidden (buyers don't claim)
//
// Always hidden if supplier is already claimed (caller decides whether to
// render at all by inspecting `claimed_by`).

import Link from "next/link";

import { Storefront } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { getServerRole } from "@/lib/auth";

export async function ClaimCtaButton({ slug }: { slug: string }) {
  const role = await getServerRole();
  if (role === "buyer") return null;
  const supplierQs = `?supplier=${encodeURIComponent(slug)}`;
  const href =
    role === "supplier" || role === "admin"
      ? `/supplier/claim${supplierQs}`
      : `/signup?role=supplier&next=${encodeURIComponent(
          `/supplier/claim${supplierQs}`,
        )}`;
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      title="Are you this supplier? Claim ownership to manage the profile."
      aria-label="Claim this company profile"
    >
      <Link href={href}>
        <Storefront size={14} weight="regular" aria-hidden />
        <span className="r9-btn-label">Claim this company</span>
      </Link>
    </Button>
  );
}
