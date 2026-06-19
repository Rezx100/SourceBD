// MSA §54 generator — Spec B9 (/app/compliance/msa).
//
// Server component. Calls compliance_msa_inputs() to assemble the
// aggregates that feed the UK Modern Slavery Act §54 statement template,
// then mounts the <MsaGeneratorForm/> client island for composition.

import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

import { MsaGeneratorForm, type MsaInputs } from "@/components/msa-generator-form";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-kit";

export const dynamic = "force-dynamic";

export default async function MsaPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("compliance_msa_inputs");
  const inputs = (data ?? null) as MsaInputs | null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-4">
        <Link
          href="/app/compliance"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-tertiary transition-colors hover:text-ink-primary"
        >
          <ArrowLeft size={13} weight="bold" aria-hidden /> Compliance
        </Link>
        <PageHeader
          kicker="Compliance"
          title="Modern Slavery Act §54 statement generator"
          description="Composes a draft UK Modern Slavery Act 2015 §54 transparency statement from your saved-supplier footprint. The draft covers the six areas the Home Office guidance asks for: organisation, supply chain structure, policies, due diligence, risk assessment, training and effectiveness. Review with counsel before publishing."
        />
      </div>

      {error ? (
        <Card>
          <CardContent className="text-sm text-sem-red">
            Could not load MSA inputs.
          </CardContent>
        </Card>
      ) : null}

      {inputs ? (
        <Card>
          <CardHeader>
            <CardTitle>Footprint snapshot</CardTitle>
            <CardMeta>
              Derived from your{" "}
              <span className="font-semibold">
                {inputs.total_published.toLocaleString()}
              </span>{" "}
              published saved suppliers
            </CardMeta>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Saved" value={inputs.total_saved} />
              <Stat label="Published" value={inputs.total_published} />
              <Stat label="RSC covered" value={inputs.rsc_covered} />
              <Stat
                label="Expiring (90d)"
                value={inputs.expiring_certs_90d}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Block title="Countries">
                {inputs.by_country.length === 0 ? (
                  <Empty />
                ) : (
                  <TagRow
                    items={inputs.by_country.map((c) => ({
                      label: `${c.country} · ${c.count}`,
                    }))}
                  />
                )}
              </Block>
              <Block title="Registers">
                {inputs.by_register.length === 0 ? (
                  <Empty />
                ) : (
                  <TagRow
                    items={inputs.by_register.map((c) => ({
                      label: `${c.register} · ${c.count}`,
                    }))}
                  />
                )}
              </Block>
              <Block title="Certifications">
                {inputs.by_certification.length === 0 ? (
                  <Empty />
                ) : (
                  <TagRow
                    items={inputs.by_certification.map((c) => ({
                      label: `${prettyCert(c.kind)} · ${c.count}`,
                    }))}
                  />
                )}
              </Block>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {inputs ? <MsaGeneratorForm inputs={inputs} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[11px] text-ink-tertiary">
        {label}
      </p>
      <p className="font-display text-2xl font-semibold tabular-nums text-ink-primary">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[11px] text-ink-tertiary">
        {title}
      </p>
      {children}
    </div>
  );
}

function TagRow({ items }: { items: { label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Tag key={i.label} tone="neutral">
          {i.label}
        </Tag>
      ))}
    </div>
  );
}

function Empty() {
  return <p className="text-[12px] text-ink-tertiary">—</p>;
}

function prettyCert(k: string): string {
  switch (k) {
    case "wrap":
      return "WRAP";
    case "oeko_tex":
      return "OEKO-TEX";
    case "gots":
      return "GOTS";
    case "sa8000":
      return "SA8000";
    case "bsci":
      return "BSCI";
    case "ocs":
      return "OCS";
    case "grs":
      return "GRS";
    case "rcs":
      return "RCS";
    case "sedex":
      return "Sedex";
    case "higg":
      return "Higg";
    case "fairtrade":
      return "Fairtrade";
    default:
      return k.toUpperCase();
  }
}
