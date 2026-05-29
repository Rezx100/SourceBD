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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
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
            <ul className="divide-y divide-hairline">
              {owned.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3">
                  <div>
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
                  <Tag>Owned</Tag>
                </li>
              ))}
            </ul>
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
            <ul className="divide-y divide-hairline">
              {openClaims.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile editor & inbox</CardTitle>
          <CardMeta>Specs S2–S5</CardMeta>
        </CardHeader>
        <CardContent className="text-sm text-ink-secondary">
          Profile editing, inquiries and the RFQ inbox ship in the remainder
          of Phase 3.
        </CardContent>
      </Card>
    </div>
  );
}
