// Spec S5 — /supplier/partners (Phase 3 final spec). Lists factory↔buying-house
// relationships grouped by status across every supplier the caller has
// claimed, plus the request form. Server component; calls
// `public.supplier_relationship_list` and inherits its RLS-mirroring
// visibility (the RPC re-enforces ownership of one side).

import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/dist/ssr";

import { Empty, Table, Td, Th, Tr, TypeChip, linkClass } from "@/components/kit";
import { RfqChip } from "@/components/rfqs/chip";
import { PartnerActionButtons } from "@/components/supplier-partner-actions";
import { SupplierPartnerRequestForm } from "@/components/supplier-partner-request-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Counterparty = {
  id: string;
  slug: string;
  company_name: string;
  city: string | null;
  district: string | null;
};

type Relationship = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "revoked";
  viewer_role: "buying_house" | "factory";
  initiated_side: "buying_house" | "factory";
  initiated_by_me: boolean;
  can_decide: boolean;
  can_revoke: boolean;
  note: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
  buying_house: Counterparty;
  factory: Counterparty;
};

type OwnedSupplier = {
  id: string;
  slug: string;
  company_name: string;
  entity_type: "buying_house" | "factory";
};

export default async function SupplierPartnersPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user?.id;

  let owned: OwnedSupplier[] = [];
  if (uid) {
    const { data } = await supabase
      .from("suppliers")
      .select("id, slug, company_name, entity_type")
      .eq("claimed_by", uid)
      .eq("is_published", true)
      .in("entity_type", ["buying_house", "factory"])
      .order("company_name");
    owned = (data ?? []) as OwnedSupplier[];
  }

  const { data: relData } = await supabase.rpc("supplier_relationship_list", {
    p_supplier_id: null,
    p_status: null,
  });
  const all: Relationship[] = (relData as Relationship[] | null) ?? [];

  const pendingIncoming = all.filter(
    (r) => r.status === "pending" && r.viewer_role !== r.initiated_side,
  );
  const pendingOutgoing = all.filter(
    (r) => r.status === "pending" && r.viewer_role === r.initiated_side,
  );
  const accepted = all.filter((r) => r.status === "accepted");
  const inactive = all.filter(
    (r) => r.status === "rejected" || r.status === "revoked",
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Partners</h1>
        <p className="max-w-3xl text-md text-ink-2">
          Buying houses and factories can declare partnerships. Both sides must agree before a relationship becomes public on the buyer-side profile pages.
        </p>
      </header>

      {owned.length === 0 ? (
        <Empty
          icon={UsersThree}
          title="Claim a buying house or factory to manage partnerships."
          action={
            <Link href="/supplier/claim" className={linkClass}>
              Claim your company
            </Link>
          }
        />
      ) : (
        <>
          <section aria-label="Request a partnership" className="rounded-md border border-line p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-md font-semibold text-ink">Request a partnership</h2>
              <p className="text-sm text-ink-3">
                Buying houses request factories, factories request buying
                houses.
              </p>
            </div>
            <div className="mt-4">
              <SupplierPartnerRequestForm ownedSuppliers={owned} />
            </div>
          </section>

          <RelationshipGroup
            title="Incoming requests"
            meta={`${pendingIncoming.length} awaiting your decision`}
            rows={pendingIncoming}
            emptyText="No incoming requests."
          />
          <RelationshipGroup
            title="Outgoing requests"
            meta={`${pendingOutgoing.length} pending counterparty`}
            rows={pendingOutgoing}
            emptyText="No outgoing requests."
          />
          <RelationshipGroup
            title="Active partnerships"
            meta={`${accepted.length} accepted`}
            rows={accepted}
            emptyText="No active partnerships yet."
          />
          {inactive.length > 0 ? (
            <RelationshipGroup
              title="Rejected & revoked"
              meta={`${inactive.length} inactive`}
              rows={inactive}
              emptyText=""
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function RelationshipGroup({
  title,
  meta,
  rows,
  emptyText,
}: {
  title: string;
  meta: string;
  rows: Relationship[];
  emptyText: string;
}) {
  return (
    <section aria-label={title} className="overflow-clip rounded-md border border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4">
        <h2 className="text-md font-semibold text-ink">{title}</h2>
        <p className="text-sm text-ink-3">{meta}</p>
      </div>
      {rows.length === 0 ? (
        <p className="border-t border-line px-5 py-4 text-base text-ink-3">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[900px]">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr>
                <Th>Partner</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>For</Th>
                <Th>Direction</Th>
                <Th>Note</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = counterpartyOf(r);
                const mine = myCompanyOf(r);
                return (
                  <Tr key={r.id}>
                    <Td>
                      <Link
                        href={`/app/suppliers/${c.slug}`}
                        className="font-medium text-ink hover:underline"
                      >
                        {c.company_name}
                      </Link>
                    </Td>
                    <Td>
                      <TypeChip>
                        {r.viewer_role === "buying_house" ? "factory" : "buying house"}
                      </TypeChip>
                    </Td>
                    <Td>
                      <StatusChip status={r.status} />
                    </Td>
                    <Td>
                      <Link
                        href={`/app/suppliers/${mine.slug}`}
                        className="text-ink-2 hover:underline"
                      >
                        {mine.company_name}
                      </Link>
                    </Td>
                    <Td className="text-ink-3">
                      {r.initiated_by_me ? "you requested" : "they requested"}
                      {r.decided_at
                        ? ` · decided ${new Date(r.decided_at).toLocaleDateString()}`
                        : ""}
                    </Td>
                    <Td>
                      {r.note ? (
                        <span className="whitespace-pre-wrap">“{r.note}”</span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td align="right">
                      <PartnerActionButtons
                        id={r.id}
                        canDecide={r.can_decide}
                        canRevoke={r.can_revoke}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}

function counterpartyOf(row: Relationship): Counterparty {
  return row.viewer_role === "buying_house" ? row.factory : row.buying_house;
}
function myCompanyOf(row: Relationship): Counterparty {
  return row.viewer_role === "buying_house" ? row.buying_house : row.factory;
}

function StatusChip({ status }: { status: Relationship["status"] }) {
  if (status === "accepted") return <RfqChip tone="accepted">Accepted</RfqChip>;
  if (status === "pending") return <RfqChip tone="waiting">Pending</RfqChip>;
  if (status === "rejected") return <RfqChip tone="closed">Rejected</RfqChip>;
  return <RfqChip tone="closed">Revoked</RfqChip>;
}
