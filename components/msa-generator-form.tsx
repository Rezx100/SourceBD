"use client";

// MSA generator form (client island) — Spec B9.
//
// Composes a draft UK Modern Slavery Act 2015 §54 transparency statement
// from server-aggregated MsaInputs + a small set of buyer-supplied fields
// (organisation name, reporting period, sign-off name + role). The output
// is a plain markdown document with the seven sections the Home Office
// guidance asks for. Copy-to-clipboard + download-as-.md only — no upload
// or server submission.

import { useMemo, useState } from "react";
import { Copy, DownloadSimple } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import {
  Card,
  CardContent,
  CardHeader,
  CardMeta,
  CardTitle,
} from "@/components/ui/card";

export type MsaInputs = {
  total_saved: number;
  total_published: number;
  by_country: { country: string; count: number }[];
  by_entity_type: { entity_type: string; count: number }[];
  by_register: { register: string; count: number }[];
  by_certification: { kind: string; count: number }[];
  top_regions: { city: string; district: string; count: number }[];
  top_parent_groups: { parent_group_name: string; count: number }[];
  rsc_covered: number;
  rsc_avg_progress_pct: number | null;
  sanctions_hits: number;
  expiring_certs_90d: number;
};

export function MsaGeneratorForm({ inputs }: { inputs: MsaInputs }) {
  const currentYear = new Date().getFullYear();
  const [org, setOrg] = useState("");
  const [year, setYear] = useState(String(currentYear - 1));
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("Director");

  const draft = useMemo(
    () =>
      buildStatement({
        org: org.trim() || "[Organisation name]",
        year: year.trim() || String(currentYear - 1),
        signerName: signerName.trim() || "[Signatory name]",
        signerRole: signerRole.trim() || "Director",
        inputs,
      }),
    [org, year, signerName, signerRole, inputs, currentYear],
  );

  function handleCopy() {
    if (typeof navigator === "undefined") return;
    void navigator.clipboard.writeText(draft);
  }

  function handleDownload() {
    const blob = new Blob([draft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (org.trim() || "msa-statement")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    a.href = url;
    a.download = `${slug || "msa-statement"}-${year || currentYear - 1}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft your statement</CardTitle>
        <CardMeta>
          All composition runs in your browser. Nothing is uploaded.
        </CardMeta>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Organisation name">
            <input
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="e.g. Example Apparel Ltd"
              className="w-full rounded-control border border-hairline-strong bg-surface-l1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-accent-indigo focus:outline-none"
            />
          </Field>
          <Field label="Reporting financial year">
            <input
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder={String(currentYear - 1)}
              className="w-full rounded-control border border-hairline-strong bg-surface-l1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-accent-indigo focus:outline-none"
            />
          </Field>
          <Field label="Signatory name">
            <input
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full rounded-control border border-hairline-strong bg-surface-l1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-accent-indigo focus:outline-none"
            />
          </Field>
          <Field label="Signatory role">
            <input
              value={signerRole}
              onChange={(e) => setSignerRole(e.target.value)}
              placeholder="Director"
              className="w-full rounded-control border border-hairline-strong bg-surface-l1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-accent-indigo focus:outline-none"
            />
          </Field>
        </div>

        <StickyActionBar>
          <Button variant="primary" size="sm" onClick={handleDownload}>
            <DownloadSimple size={16} weight="bold" /> Download .md
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy size={16} weight="bold" /> Copy to clipboard
          </Button>
        </StickyActionBar>

        <div>
          <p className="mb-2 text-[12px] text-ink-tertiary">
            Preview
          </p>
          <textarea
            readOnly
            value={draft}
            className="h-[440px] w-full resize-y rounded-control border border-hairline-strong bg-surface-l1 px-3 py-2 font-mono text-[13px] leading-relaxed text-ink-primary focus:border-accent-indigo focus:outline-none"
          />
        </div>

        <p className="text-[13px] text-ink-tertiary">
          This is a starting draft only. The UK Home Office guidance for §54
          statements (
          <em>Transparency in supply chains: a practical guide</em>) requires
          board approval and a signed PDF on your homepage. Have counsel
          review before publication.
        </p>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-[12px] text-ink-tertiary">
        {label}
      </span>
      {children}
    </label>
  );
}

function buildStatement(args: {
  org: string;
  year: string;
  signerName: string;
  signerRole: string;
  inputs: MsaInputs;
}): string {
  const { org, year, signerName, signerRole, inputs } = args;

  const countryList =
    inputs.by_country.length > 0
      ? inputs.by_country
          .map((c) => `${c.country} (${c.count})`)
          .join(", ")
      : "[no country data]";

  const registerList =
    inputs.by_register.length > 0
      ? inputs.by_register
          .map((r) => `${r.register} (${r.count})`)
          .join(", ")
      : "industry registers (BGMEA, BKMEA, BTMA, BGAPMEA, EPB, RSC)";

  const certList =
    inputs.by_certification.length > 0
      ? inputs.by_certification
          .map((c) => `${prettyCert(c.kind)} (${c.count})`)
          .join(", ")
      : "recognised social and environmental standards";

  const topGroups =
    inputs.top_parent_groups.length > 0
      ? inputs.top_parent_groups
          .slice(0, 5)
          .map((g) => `- ${g.parent_group_name} — ${g.count} facility(ies)`)
          .join("\n")
      : "- [no parent-group data]";

  const topRegions =
    inputs.top_regions.length > 0
      ? inputs.top_regions
          .slice(0, 5)
          .map(
            (r) =>
              `- ${[r.city, r.district].filter(Boolean).join(", ")} — ${r.count} facility(ies)`,
          )
          .join("\n")
      : "- [no region data]";

  const rscLine =
    inputs.rsc_covered > 0
      ? `${inputs.rsc_covered} of our supplier facilities are covered by the RMG Sustainability Council (RSC) safety remediation programme${inputs.rsc_avg_progress_pct != null ? `, with an average remediation completion of ${inputs.rsc_avg_progress_pct.toFixed(1)}%` : ""}.`
      : "We are increasing our coverage by the RMG Sustainability Council (RSC) safety remediation programme.";

  const sanctionLine =
    inputs.sanctions_hits === 0
      ? "We screen every supplier in our active sourcing list against the U.S. Department of Homeland Security UFLPA Entity List and other relevant denied-party lists, and we maintain zero active hits across our saved supplier base."
      : `We screen every supplier in our active sourcing list against the U.S. Department of Homeland Security UFLPA Entity List and other relevant denied-party lists. We currently have ${inputs.sanctions_hits} supplier(s) flagged for review and are pursuing remediation or disengagement in line with our policy.`;

  const expiringLine =
    inputs.expiring_certs_90d === 0
      ? "All recognised social and environmental certifications across our saved supplier base remain current."
      : `${inputs.expiring_certs_90d} certification(s) across our saved supplier base are due to expire within 90 days. Our compliance team monitors renewal status and engages suppliers ahead of expiry.`;

  return `# Modern Slavery Act 2015 — Section 54 Transparency Statement

**Organisation:** ${org}
**Financial year:** ${year}

This statement is made pursuant to section 54 of the UK Modern Slavery Act 2015 and sets out the steps ${org} has taken during the financial year ${year} to ensure that slavery and human trafficking are not taking place in any of our supply chains or in any part of our own business.

## 1. Organisation and supply chain structure

${org} sources ready-made garments and related textile products from a supply base of ${inputs.total_published.toLocaleString()} verified supplier facilities. Our active supply base is concentrated in: ${countryList}. The breakdown by facility type is:

${
  inputs.by_entity_type.length > 0
    ? inputs.by_entity_type
        .map(
          (e) =>
            `- ${prettyEntityType(e.entity_type)} — ${e.count.toLocaleString()}`,
        )
        .join("\n")
    : "- [no entity-type data]"
}

Top sourcing regions:

${topRegions}

Top parent groups represented in our saved supplier base:

${topGroups}

## 2. Policies in relation to slavery and human trafficking

${org} maintains a formal Modern Slavery and Human Trafficking Policy, a Supplier Code of Conduct, a Whistleblowing Policy and a Recruitment Policy. These policies prohibit forced labour, child labour, debt bondage and the withholding of identity documents anywhere in our operations or our supply chain, and they require our suppliers to apply the same standards to their own sub-tier suppliers.

## 3. Due diligence processes

We conduct supplier due diligence prior to onboarding and on a continuing basis. Our due diligence is anchored in verified data from industry registers and certification bodies, including: ${registerList}. Suppliers in our active list hold the following recognised social and environmental certifications: ${certList}.

${rscLine}

## 4. Risk assessment

We assess modern-slavery risk at the country, region, facility and product level. ${sanctionLine}

${expiringLine}

Where a supplier presents elevated risk — including geographic exposure to regions associated with forced-labour concerns — we escalate the supplier to enhanced due diligence, request additional documentation and may suspend new purchase orders pending review.

## 5. Training

${org} provides training on modern slavery awareness to all staff involved in procurement, supplier on-boarding and supply-chain operations, and we share guidance materials with our supplier base.

## 6. Effectiveness — key performance indicators

We track effectiveness against the following indicators for the saved supplier base used in our sourcing decisions:

- Total verified supplier facilities under management: **${inputs.total_published.toLocaleString()}**
- Supplier facilities covered by RSC remediation: **${inputs.rsc_covered.toLocaleString()}**${inputs.rsc_avg_progress_pct != null ? ` (avg ${inputs.rsc_avg_progress_pct.toFixed(1)}% complete)` : ""}
- Active UFLPA Entity List matches: **${inputs.sanctions_hits.toLocaleString()}**
- Recognised certifications expiring within 90 days: **${inputs.expiring_certs_90d.toLocaleString()}**

We review these indicators on a recurring basis through SourceBD's Compliance Hub and act on any deterioration.

## 7. Approval

This statement was approved by the Board of Directors of ${org} and is signed on its behalf.

**Signed:** ${signerName}
**Role:** ${signerRole}
**Date:** _____________________
`;
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

function prettyEntityType(t: string): string {
  if (t === "factory") return "Factory";
  if (t === "buying_house") return "Buying house";
  return t.replace(/_/g, " ");
}
