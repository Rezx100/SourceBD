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
import { PageHeader } from "@/components/ui/page-kit";

// Supplier Profile Editor — listing page (Spec S2).
// Lists the caller's claimed companies; each row deep-links to the
// per-supplier editor at /supplier/profile/[id]. Empty state CTA to the
// claim flow. Honours α/β/γ — no SBI numeric anywhere.
export const dynamic = "force-dynamic";

type OwnedRow = {
  id: string;
  slug: string;
  company_name: string;
  supplier_attested_at: string | null;
};

export default async function SupplierProfileList() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id;

  let owned: OwnedRow[] = [];
  if (uid) {
    const { data } = await supabase
      .from("suppliers")
      .select("id, slug, company_name, supplier_attested_at")
      .eq("claimed_by", uid)
      .eq("is_published", true)
      .order("company_name");
    owned = (data ?? []) as OwnedRow[];
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        kicker="Supplier"
        title="Company profile"
        description="Choose a company to edit its supplier-attested fields. Register data from BGMEA, BKMEA, BTMA, BGAPMEA, RSC and certification bodies is never overwritten by your edits."
      />

      <Card>
        <CardHeader>
          <CardTitle>Your companies</CardTitle>
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
                <li
                  key={s.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">
                      {s.company_name}
                    </p>
                    <p className="text-xs text-ink-tertiary">
                      {s.supplier_attested_at
                        ? `Last edited ${new Date(s.supplier_attested_at).toISOString().slice(0, 10)}`
                        : "Not yet edited"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag>Owned</Tag>
                    <Button asChild variant="primary" size="sm">
                      <Link href={`/supplier/profile/${s.id}`}>
                        Edit profile
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
