import Link from "next/link";

import { TermsAcceptBanner } from "@/components/frame/terms-banner";
import { ButtonLink, TypeChip, linkClass } from "@/components/kit";
import { TERMS_VERSION } from "@/lib/onboarding";
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

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-md border border-line p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-3">{meta}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function SupplierHome() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id;

  let owned: OwnedSupplier[] = [];
  // Which terms this person has accepted (moderation plan 1d, legal track 4.10: suppliers' acceptance is
  // recorded too). Unknown when the read fails, and then no banner: a nag on a broken read is worse than none.
  let terms: { known: boolean; version: string | null } = { known: false, version: null };
  if (uid) {
    const [{ data }, profile] = await Promise.all([
      supabase
        .from("suppliers")
        .select("id, slug, company_name, entity_type, city, district")
        .eq("claimed_by", uid)
        .eq("is_published", true)
        .order("company_name"),
      Promise.resolve(supabase.from("profiles").select("terms_version").eq("id", uid).maybeSingle()).then(
        (r) => ({ known: !r.error, version: (r.data as { terms_version?: string | null } | null)?.terms_version ?? null }),
        () => ({ known: false, version: null }),
      ),
    ]);
    owned = (data ?? []) as OwnedSupplier[];
    terms = profile;
  }
  const termsDue = terms.known && terms.version !== TERMS_VERSION;

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Portal</h1>
        <p className="text-md text-ink-2">
          Manage your claimed companies, incoming RFQs and partner relationships.
        </p>
      </header>

      {termsDue ? <TermsAcceptBanner version={TERMS_VERSION} accepted={terms.version} /> : null}

      <Panel title="Claimed companies" meta={`${owned.length} owned`}>
        {owned.length === 0 ? (
          <div className="flex flex-col items-start gap-3 text-base text-ink-2">
            <p>You haven&apos;t claimed any companies yet.</p>
            <ButtonLink href="/supplier/claim" kind="primary">
              Claim your company
            </ButtonLink>
          </div>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
            {owned.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/app/suppliers/${s.slug}`}
                    className="text-base font-semibold text-ink hover:underline"
                  >
                    {s.company_name}
                  </Link>
                  <p className="text-sm text-ink-3">
                    {s.entity_type.replace(/_/g, " ")} ·{" "}
                    {[s.city, s.district].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
                <div className="mt-auto flex items-center gap-2">
                  <TypeChip>Owned</TypeChip>
                  <ButtonLink
                    href={`/supplier/profile/${s.id}`}
                    kind="primary"
                    className="ml-auto"
                  >
                    Edit profile
                  </ButtonLink>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Pending claims" meta={`${openClaims.length} open`}>
        {openClaims.length === 0 ? (
          <p className="text-base text-ink-3">
            No claims awaiting verification or admin review.
          </p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2">
            {openClaims.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/supplier/claim/${c.id}`}
                    className="text-base font-semibold text-ink hover:underline"
                  >
                    {c.supplier.company_name}
                  </Link>
                  <p className="text-sm text-ink-3 [overflow-wrap:anywhere]">
                    {c.proof_email} ·{" "}
                    {c.method === "domain_email" ? "Domain proof" : "Manual review"}
                  </p>
                </div>
                <TypeChip className="shrink-0">
                  {c.status === "pending_email" ? "Awaiting email" : "Awaiting admin"}
                </TypeChip>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="RFQ inbox"
        meta={`${supplierRfqs.length} total · ${openRfqCount} open`}
      >
        <div className="flex flex-col items-start gap-3 text-base text-ink-2">
          {supplierRfqs.length === 0 ? (
            <p>
              No buyer RFQs yet. When a buyer addresses an RFQ to one of
              your claimed companies it will land in your{" "}
              <Link href="/supplier/rfqs" className={linkClass}>
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
          <ButtonLink href="/supplier/rfqs" kind="primary">
            Open RFQ inbox
          </ButtonLink>
        </div>
      </Panel>

      <Panel
        title="Partners"
        meta={`${acceptedRelCount} accepted · ${pendingIncomingCount} awaiting you`}
      >
        <div className="flex flex-col items-start gap-3 text-base text-ink-2">
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
          <ButtonLink href="/supplier/partners" kind="primary">
            Open partners
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
