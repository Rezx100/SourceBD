// Spec S5 — /supplier/partners (Phase 3 final spec). Lists factory↔buying-house
// relationships grouped by status across every supplier the caller has
// claimed, plus the request form. Server component; calls
// `public.supplier_relationship_list` and inherits its RLS-mirroring
// visibility (the RPC re-enforces ownership of one side).

import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-tertiary">
          Supplier
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          Partners
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-secondary">
          Buying houses and factories can declare partnerships. Both sides
          must agree before a relationship becomes public on the buyer-side
          profile pages.
        </p>
      </header>

      {owned.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center text-sm text-ink-secondary">
            <UsersThree
              size={32}
              weight="duotone"
              className="mx-auto text-ink-tertiary"
              aria-hidden
            />
            <p>Claim a buying house or factory to manage partnerships.</p>
            <Link
              href="/supplier/claim"
              className="font-semibold text-accent-indigo hover:underline"
            >
              Claim your company
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Request a partnership</CardTitle>
              <CardMeta>
                Buying houses request factories, factories request buying
                houses.
              </CardMeta>
            </CardHeader>
            <CardContent>
              <SupplierPartnerRequestForm ownedSuppliers={owned} />
            </CardContent>
          </Card>

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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardMeta>{meta}</CardMeta>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-tertiary">{emptyText}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col divide-y divide-hairline p-0">
            {rows.map((r) => (
              <li key={r.id} className="py-3">
                <RelationshipRow row={r} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RelationshipRow({ row }: { row: Relationship }) {
  const counterparty =
    row.viewer_role === "buying_house" ? row.factory : row.buying_house;
  const myCompany =
    row.viewer_role === "buying_house" ? row.buying_house : row.factory;
  const counterpartyRole =
    row.viewer_role === "buying_house" ? "factory" : "buying house";

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/app/suppliers/${counterparty.slug}`}
            className="font-display text-sm font-semibold text-ink-primary hover:underline"
          >
            {counterparty.company_name}
          </Link>
          <Tag>{counterpartyRole}</Tag>
          <StatusBadge status={row.status} />
        </div>
        <p className="mt-0.5 text-[12px] text-ink-tertiary">
          {[counterparty.city, counterparty.district]
            .filter(Boolean)
            .join(", ") || "—"}
          {" · for "}
          <Link
            href={`/app/suppliers/${myCompany.slug}`}
            className="hover:underline"
          >
            {myCompany.company_name}
          </Link>
          {" · "}
          {row.initiated_by_me ? "you requested" : "they requested"}
          {row.decided_at
            ? ` · decided ${new Date(row.decided_at).toLocaleDateString()}`
            : ""}
        </p>
        {row.note ? (
          <p className="mt-1 max-w-prose whitespace-pre-wrap text-[13px] text-ink-secondary">
            “{row.note}”
          </p>
        ) : null}
      </div>
      <PartnerActionButtons
        id={row.id}
        canDecide={row.can_decide}
        canRevoke={row.can_revoke}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: Relationship["status"] }) {
  if (status === "accepted") return <Badge tone="success">Accepted</Badge>;
  if (status === "pending") return <Badge tone="active">Pending</Badge>;
  if (status === "rejected") return <Badge tone="alert">Rejected</Badge>;
  return <Badge tone="neutral">Revoked</Badge>;
}
