import { ButtonLink, TypeChip } from "@/components/kit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Company profile</h1>
        <p className="max-w-3xl text-md text-ink-2">
          Choose a company to edit its supplier-attested fields. Register data from BGMEA, BKMEA, BTMA, BGAPMEA, RSC and certification bodies is never overwritten by your edits.
        </p>
      </header>

      <section aria-label="Your companies" className="rounded-md border border-line p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-md font-semibold text-ink">Your companies</h2>
          <p className="text-sm text-ink-3">{owned.length} owned</p>
        </div>
        <div className="mt-4">
          {owned.length === 0 ? (
            <div className="flex flex-col items-start gap-3 text-base text-ink-2">
              <p>You haven&apos;t claimed any companies yet.</p>
              <ButtonLink href="/supplier/claim" kind="primary">
                Claim your company
              </ButtonLink>
            </div>
          ) : (
            <ul className="m-0 list-none divide-y divide-line p-0">
              {owned.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-ink">
                      {s.company_name}
                    </p>
                    <p className="text-sm text-ink-3">
                      {s.supplier_attested_at
                        ? `Last edited ${new Date(s.supplier_attested_at).toISOString().slice(0, 10)}`
                        : "Not yet edited"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TypeChip>Owned</TypeChip>
                    <ButtonLink href={`/supplier/profile/${s.id}`} kind="primary">
                      Edit profile
                    </ButtonLink>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
