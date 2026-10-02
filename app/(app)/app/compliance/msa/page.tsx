// Modern Slavery Act §54 statement generator — Spec B9 (/app/compliance/msa).
//
// Server component. Calls compliance_msa_inputs() for the saved-supplier
// footprint and compliance_uflpa_tracker() for the UFLPA counts the risk
// section discloses (region flags included), then mounts the
// <MsaGeneratorForm/> client island, which composes the draft in the browser.

import { Chip } from "@/components/dashboard/chips";
import { BackToHub, prettyCert } from "@/components/dashboard/compliance";
import { DetailList, ErrorNote, PageHeader, PageSection, Page } from "@/components/dashboard/page";
import { Caption } from "@/components/dashboard/type";
import { MsaGeneratorForm } from "@/components/msa-generator-form";
import { formatCount } from "@/lib/dashboard/facts";
import type { MsaInputs, MsaScreening } from "@/lib/msa-statement";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function ChipRow({ items }: { items: string[] }) {
  if (items.length === 0) return <Caption>None on file</Caption>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((label) => (
        <Chip key={label} compact>
          {label}
        </Chip>
      ))}
    </span>
  );
}

async function MsaPageBody() {
  const supabase = await createSupabaseServerClient();
  const [msa, ufl] = await Promise.all([supabase.rpc("compliance_msa_inputs"), supabase.rpc("compliance_uflpa_tracker")]);
  const error = msa.error;
  const inputs = error ? null : ((msa.data ?? null) as MsaInputs | null);
  const screening = ufl.error ? null : ((ufl.data ?? null) as MsaScreening | null);

  return (
    <>
      <PageHeader
        title="Modern Slavery Act statement"
        caption="Composes a draft UK Modern Slavery Act 2015 §54 transparency statement from your saved suppliers. It covers the areas the Home Office guidance asks for: organisation and supply chain, policies, due diligence, risk assessment, training and effectiveness. Review it with counsel before publishing."
        actions={<BackToHub />}
      />

      {error ? <ErrorNote>Could not load the statement inputs. Reload the page to try again.</ErrorNote> : null}
      {inputs && !screening ? (
        <ErrorNote>The UFLPA tracker did not load, so the draft leaves its result for you to confirm. Reload the page to try again.</ErrorNote>
      ) : null}

      {inputs ? (
        <>
          <PageSection
            title="Your supplier footprint"
            caption={`From your ${formatCount(inputs.total_published)} published saved suppliers`}
          >
            <DetailList
              rows={[
                { label: "Saved suppliers", value: <span className="tabular-nums">{formatCount(inputs.total_saved)}</span> },
                { label: "Published", value: <span className="tabular-nums">{formatCount(inputs.total_published)}</span> },
                { label: "Covered by the RSC", value: <span className="tabular-nums">{formatCount(inputs.rsc_covered)}</span> },
                {
                  label: "Certificates expiring in 90 days",
                  value: <span className="tabular-nums">{formatCount(inputs.expiring_certs_90d)}</span>,
                },
                { label: "Countries", value: <ChipRow items={inputs.by_country.map((c) => `${c.country} · ${c.count}`)} /> },
                { label: "Registers", value: <ChipRow items={inputs.by_register.map((r) => `${r.register} · ${r.count}`)} /> },
                {
                  label: "Certifications",
                  value: <ChipRow items={inputs.by_certification.map((c) => `${prettyCert(c.kind)} · ${c.count}`)} />,
                },
              ]}
            />
          </PageSection>

          <MsaGeneratorForm inputs={inputs} screening={screening} />
        </>
      ) : null}
    </>
  );
}

export default async function MsaPage() {
  return <Page>{await MsaPageBody()}</Page>;
}
