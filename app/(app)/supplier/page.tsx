import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { FormGrid } from "@/components/ui/form-grid";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Supplier portal landing (extended by Spec S1).
// Lists companies the caller has claimed and pending claim requests, plus
// a claim-flow CTA. Per the α/β/γ decision (2026-05-20) the supplier
// surface NEVER renders the SBI numeric — only links to the canonical
// profile. The profile editor and inbox ship in S2–S5.
export const dynamic = "force-dynamic";

type OwnedSupplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: string;
  city: string | null;
  district: string | null;
};

type ClaimMini = {
  id: string;
  status: string;
  method: string;
  proof_email: string;
  supplier: {
    company_name: string;
    city: string | null;
    district: string | null;
  };
};

export default async function SupplierHome() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id;

  let owned: OwnedSupplier[] = [];
  if (uid) {
    const { data } = await supabase
      .from("suppliers")
      .select("id, slug, company_name, entity_type, city, district")
      .eq("claimed_by", uid)
      .eq("is_published", true)
      .order("company_name");
    owned = (data ?? []) as OwnedSupplier[];
  }

  const { data: mine } = await supabase.rpc("claim_list_mine");
  const allClaims = ((mine as { results?: ClaimMini[] } | null)?.results ??
    []) as ClaimMini[];
  const openClaims = allClaims.filter(
    (c) => c.status === "pending_email" || c.status === "email_verified",
  );

  type RfqRow = {
    id: string;
    status: "open" | "accepted" | "closed" | "cancelled";
    viewer_role: "buyer" | "supplier" | "both";
  };
  const { data: rfqData } = await supabase.rpc("rfq_list", { p_status: null });
  const allRfqs = (rfqData ?? []) as RfqRow[];
  const supplierRfqs = allRfqs.filter((r) => r.viewer_role !== "buyer");
  const openRfqCount = supplierRfqs.filter((r) => r.status === "open").length;

  type RelRow = {
    id: string;
    status: "pending" | "accepted" | "rejected" | "revoked";
    viewer_role: "buying_house" | "factory";
    initiated_side: "buying_house" | "factory";
  };
  const { data: relData } = await supabase.rpc("supplier_relationship_list", {
    p_supplier_id: null,
    p_status: null,
  });
  const allRels = (relData ?? []) as RelRow[];
  const pendingIncomingCount = allRels.filter(
    (r) => r.status === "pending" && r.viewer_role !== r.initiated_side,
  ).length;
  const acceptedRelCount = allRels.filter((r) => r.status === "accepted").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-[11px] text-ink-tertiary">
          Supplier
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Portal
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Claimed companies</CardTitle>
          <CardMeta>{owned.length} owned</CardMeta>
        </CardHeader>
        <CardContent>
          {owned.length === 0 ? (
            <div className="space-y-3 text-sm text-ink-secondary">
              <p>You haven&apos;t claimed any companies yet.</p>
              <Button asChild variant="primary">
                <Link href="/supplier/claim">Claim your company</Link>
              </Button>
            </div>
          ) : (
            <FormGrid cols={3}>
              {owned.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-3 rounded-card border border-hairline bg-bg-l0 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/app/suppliers/${s.slug}`}
                      className="text-sm font-semibold text-ink-primary hover:underline"
                    >
                      {s.company_name}
                    </Link>
                    <p className="text-xs text-ink-tertiary">
                      {s.entity_type.replace(/_/g, " ")} ·{" "}
                      {[s.city, s.district].filter(Boolean).join(", ") || "—"}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center gap-2">
                    <Tag>Owned</Tag>
                    <Button asChild variant="primary" size="sm" className="ml-auto">
                      <Link href={`/supplier/profile/${s.id}`}>
                        Edit profile
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </FormGrid>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending claims</CardTitle>
          <CardMeta>{openClaims.length} open</CardMeta>
        </CardHeader>
        <CardContent>
          {openClaims.length === 0 ? (
            <p className="text-sm text-ink-tertiary">
              No claims awaiting verification or admin review.
            </p>
          ) : (
            <FormGrid cols={2}>
              {openClaims.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-card border border-hairline bg-bg-l0 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/supplier/claim/${c.id}`}
                      className="text-sm font-semibold text-ink-primary hover:underline"
                    >
                      {c.supplier.company_name}
                    </Link>
                    <p className="text-xs text-ink-tertiary">
                      {c.proof_email} ·{" "}
                      {c.method === "domain_email" ? "Domain proof" : "Manual review"}
                    </p>
                  </div>
                  <Tag>
                    {c.status === "pending_email" ? "Awaiting email" : "Awaiting admin"}
                  </Tag>
                </div>
              ))}
            </FormGrid>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RFQ inbox</CardTitle>
          <CardMeta>
            {supplierRfqs.length} total · {openRfqCount} open
          </CardMeta>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-ink-secondary">
          {supplierRfqs.length === 0 ? (
            <p>
              No buyer RFQs yet. When a buyer addresses an RFQ to one of
              your claimed companies it will land in your{" "}
              <Link
                href="/supplier/rfqs"
                className="font-semibold text-ink-primary hover:underline"
              >
                RFQs received
              </Link>{" "}
              inbox.
            </p>
          ) : (
            <p>
              {openRfqCount > 0
                ? `${openRfqCount} open ${openRfqCount === 1 ? "RFQ is" : "RFQs are"} awaiting your quote.`
                : "All RFQs you have received are closed."}
            </p>
          )}
          <Button asChild variant="primary" size="sm">
            <Link href="/supplier/rfqs">Open RFQ inbox</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Partners</CardTitle>
          <CardMeta>
            {acceptedRelCount} accepted · {pendingIncomingCount} awaiting you
          </CardMeta>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-ink-secondary">
          {allRels.length === 0 ? (
            <p>
              Declare partner factories or buying houses. Both sides must
              accept before the relationship surfaces on buyer-side profiles.
            </p>
          ) : pendingIncomingCount > 0 ? (
            <p>
              {pendingIncomingCount} partnership{" "}
              {pendingIncomingCount === 1 ? "request is" : "requests are"}{" "}
              awaiting your decision.
            </p>
          ) : (
            <p>
              {acceptedRelCount} active partnership
              {acceptedRelCount === 1 ? "" : "s"}.
            </p>
          )}
          <Button asChild variant="primary" size="sm">
            <Link href="/supplier/partners">Open partners</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
