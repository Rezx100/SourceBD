import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupplierProfileForm } from "@/components/supplier-profile-form";

// Supplier Profile Editor — per-supplier editor (Spec S2).
// 404s when the caller does not own the supplier (no existence leak).
// Renders register-sourced read-only chips above the editable form so the
// supplier can see what the Tier 1–3 registers say without overwriting it.
export const dynamic = "force-dynamic";

type Profile = {
  supplier: {
    id: string;
    slug: string;
    company_name: string;
    entity_type: string;
    country: string | null;
    city: string | null;
    district: string | null;
    address_raw: string | null;
  };
  register: {
    email_primary: string | null;
    phones: string[] | null;
    contact_name: string | null;
    contact_role: string | null;
    website: string | null;
  };
  editable: {
    tagline: string | null;
    about: string | null;
    moq: number | null;
    lead_time_days: number | null;
    capabilities: string[];
    contact_name: string | null;
    contact_role: string | null;
    contact_email: string | null;
    contact_phone: string | null;
  };
  attested_at: string | null;
  attested_by: string | null;
};

export default async function SupplierProfileEdit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("supplier_profile_get", {
    p_supplier_id: id,
  });
  if (error || data === null) {
    notFound();
  }
  const p = data as Profile;

  const reg = p.register;
  const sup = p.supplier;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-[12px] text-ink-tertiary">
          Supplier · Profile · Edit
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tightish text-ink-primary">
          {sup.company_name}
        </h1>
        <p className="mt-1 text-xs text-ink-tertiary">
          {sup.entity_type.replace(/_/g, " ")} ·{" "}
          {[sup.city, sup.district].filter(Boolean).join(", ") || "—"}
        </p>
        <div className="mt-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/supplier/profile">← All companies</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Register record (read-only)</CardTitle>
          <CardMeta>Tier 1–3 sources</CardMeta>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-tertiary">
                Address
              </dt>
              <dd className="text-ink-primary">{sup.address_raw ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-tertiary">
                Register email
              </dt>
              <dd className="text-ink-primary">{reg.email_primary ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-tertiary">
                Register phones
              </dt>
              <dd className="text-ink-primary">
                {(reg.phones ?? []).filter(Boolean).join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-tertiary">
                Register website
              </dt>
              <dd className="text-ink-primary break-all">
                {reg.website ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-tertiary">
                Register contact name
              </dt>
              <dd className="text-ink-primary">{reg.contact_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-tertiary">
                Register contact role
              </dt>
              <dd className="text-ink-primary">{reg.contact_role ?? "—"}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-tertiary">
            These fields come from BGMEA / BKMEA / BTMA / BGAPMEA / RSC and
            certification bodies. They are evidence-backed and the editor
            cannot overwrite them. Use the form below to add supplier-attested
            details that complement the register.
          </p>
        </CardContent>
      </Card>

      <SupplierProfileForm supplierId={sup.id} initial={p.editable} />

      <p className="text-xs text-ink-tertiary">
        Last edited:{" "}
        {p.attested_at
          ? new Date(p.attested_at).toISOString().replace("T", " ").slice(0, 16) +
            " UTC"
          : "never"}
      </p>
    </div>
  );
}
