import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/kit";
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

  const facts: [string, string, string?][] = [
    ["Address", sup.address_raw ?? "—"],
    ["Register email", reg.email_primary ?? "—", "[overflow-wrap:anywhere]"],
    ["Register phones", (reg.phones ?? []).filter(Boolean).join(", ") || "—"],
    ["Register website", reg.website ?? "—", "break-all"],
    ["Register contact name", reg.contact_name ?? "—"],
    ["Register contact role", reg.contact_role ?? "—"],
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {sup.company_name}
        </h1>
        <p className="text-md text-ink-2">
          {sup.entity_type.replace(/_/g, " ")} ·{" "}
          {[sup.city, sup.district].filter(Boolean).join(", ") || "—"}
        </p>
        <div className="mt-2">
          <ButtonLink href="/supplier/profile" kind="secondary">
            ← All companies
          </ButtonLink>
        </div>
      </header>

      <section aria-label="Register record" className="rounded-md border border-line p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-md font-semibold text-ink">Register record (read-only)</h2>
          <p className="text-sm text-ink-3">Tier 1–3 sources</p>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-base md:grid-cols-2">
          {facts.map(([label, value, extra]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-3">{label}</dt>
              <dd className={extra ? `text-ink ${extra}` : "text-ink"}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-3">
          These fields come from BGMEA / BKMEA / BTMA / BGAPMEA / RSC and
          certification bodies. They are evidence-backed and the editor
          cannot overwrite them. Use the form below to add supplier-attested
          details that complement the register.
        </p>
      </section>

      <SupplierProfileForm supplierId={sup.id} initial={p.editable} />

      <p className="text-xs text-ink-3">
        Last edited:{" "}
        {p.attested_at
          ? new Date(p.attested_at).toISOString().replace("T", " ").slice(0, 16) +
            " UTC"
          : "never"}
      </p>
    </div>
  );
}
