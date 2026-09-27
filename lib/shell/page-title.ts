import { variantFromPath, type ShellVariant } from "@/components/shell/sidebar";

const EXACT: Record<string, string> = {
  "/app": "Dashboard",
  "/app/discover": "Search suppliers",
  "/app/match": "Find matches",
  "/app/saved": "Saved suppliers",
  "/app/searches": "Saved searches",
  "/app/products": "Products",
  "/app/products/new": "New product",
  "/app/headings": "HS headings",
  "/app/messages": "Messages",
  "/app/rfqs": "RFQs",
  "/app/orders": "Orders",
  "/app/compliance": "Compliance",
  "/app/settings": "Workspace",
  "/app/settings/workspace": "Workspace",
  "/app/settings/subscription": "Subscription",
  "/app/settings/members": "Members",
  "/app/settings/inquiry": "Inquiry templates",
  "/app/settings/profile": "Profile",
  "/app/settings/notifications": "Notifications",
  "/supplier": "Dashboard",
  "/supplier/profile": "Company profile",
  "/supplier/rfqs": "RFQs received",
  "/supplier/messages": "Messages",
  "/supplier/partners": "Partners",
  "/supplier/documents": "Documents",
  "/supplier/claim": "Claim your company",
  "/admin": "Overview",
  "/admin/queue": "Review queue",
  "/admin/suppliers": "Suppliers",
  "/admin/claims": "Supplier claims",
  "/admin/certifications": "Certification review",
  "/admin/sanctions": "Sanctions screening",
  "/admin/sources": "Sources & ingestion",
  "/admin/feedback": "User feedback",
  "/admin/beta": "Beta analytics",
  "/admin/users": "Users & access",
  "/admin/audit-log": "Audit log",
};

const PREFIX: [string, string][] = [
  ["/app/suppliers/", "Company profile"],
  ["/app/rfqs/", "RFQ"],
  ["/app/messages/", "Conversation"],
  ["/app/orders/", "Order"],
  ["/app/products/", "Product"],
  ["/app/compliance/", "Compliance"],
  ["/supplier/rfqs/", "RFQ"],
  ["/supplier/messages/", "Conversation"],
  ["/supplier/profile/", "Edit profile"],
  ["/supplier/claim/", "Claim"],
  ["/admin/suppliers/", "Supplier"],
  ["/admin/users/", "User"],
  ["/admin/audit-log/", "Audit entry"],
];

const VARIANT_FALLBACK: Record<ShellVariant, string> = {
  buyer: "Buyer workspace",
  supplier: "Supplier workspace",
  admin: "Admin console",
};

export function pageTitleFromPath(
  pathname: string,
  role?: Parameters<typeof variantFromPath>[1],
): string {
  const normalised = pathname.split("?")[0] ?? pathname;
  const exact = EXACT[normalised];
  if (exact) return exact;
  for (const [prefix, title] of PREFIX) {
    if (normalised.startsWith(prefix)) return title;
  }
  return VARIANT_FALLBACK[variantFromPath(normalised, role)];
}
