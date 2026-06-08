// Spec S5 — /supplier/partners (Phase 3 final spec). Lists factory↔buying-house
// relationships grouped by status across every supplier the caller has
// claimed, plus the request form. Server component; calls
// `public.supplier_relationship_list` and inherits its RLS-mirroring
// visibility (the RPC re-enforces ownership of one side).

import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table";
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
        <p className="text-[11px] text-ink-tertiary">
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
        <ResponsiveTable
          mode="priority"
          priorityKeys={["partner", "role"]}
          columns={PARTNER_COLUMNS}
          rows={rows}
          rowKey={(r) => r.id}
          caption={title}
          emptyState={
            <p className="text-sm text-ink-tertiary">{emptyText}</p>
          }
        />
      </CardContent>
    </Card>
  );
}

function counterpartyOf(row: Relationship): Counterparty {
  return row.viewer_role === "buying_house" ? row.factory : row.buying_house;
}
function myCompanyOf(row: Relationship): Counterparty {
  return row.viewer_role === "buying_house" ? row.buying_house : row.factory;
}

const PARTNER_COLUMNS: Column<Relationship>[] = [
  {
    key: "partner",
    label: "Partner",
    render: (r) => {
      const c = counterpartyOf(r);
      return (
        <Link
          href={`/app/suppliers/${c.slug}`}
          className="font-display text-sm font-semibold text-ink-primary hover:underline"
        >
          {c.company_name}
        </Link>
      );
    },
  },
  {
    key: "role",
    label: "Role",
    render: (r) => (
      <Tag>{r.viewer_role === "buying_house" ? "factory" : "buying house"}</Tag>
    ),
  },
  {
    key: "status",
    label: "Status",
    render: (r) => <StatusBadge status={r.status} />,
  },
  {
    key: "for",
    label: "For",
    render: (r) => {
      const mine = myCompanyOf(r);
      return (
        <Link
          href={`/app/suppliers/${mine.slug}`}
          className="text-[13px] text-ink-secondary hover:underline"
        >
          {mine.company_name}
        </Link>
      );
    },
  },
  {
    key: "who",
    label: "Direction",
    render: (r) => (
      <span className="text-[13px] text-ink-tertiary">
        {r.initiated_by_me ? "you requested" : "they requested"}
        {r.decided_at
          ? ` · decided ${new Date(r.decided_at).toLocaleDateString()}`
          : ""}
      </span>
    ),
  },
  {
    key: "note",
    label: "Note",
    render: (r) =>
      r.note ? (
        <span className="whitespace-pre-wrap text-[13px] text-ink-secondary">
          “{r.note}”
        </span>
      ) : (
        "—"
      ),
  },
  {
    key: "actions",
    label: "Actions",
    numeric: true,
    render: (r) => (
      <PartnerActionButtons
        id={r.id}
        canDecide={r.can_decide}
        canRevoke={r.can_revoke}
      />
    ),
  },
];

function StatusBadge({ status }: { status: Relationship["status"] }) {
  if (status === "accepted") return <Badge tone="success">Accepted</Badge>;
  if (status === "pending") return <Badge tone="active">Pending</Badge>;
  if (status === "rejected") return <Badge tone="alert">Rejected</Badge>;
  return <Badge tone="neutral">Revoked</Badge>;
}
