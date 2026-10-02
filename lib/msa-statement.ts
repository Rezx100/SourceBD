// The UK Modern Slavery Act 2015 §54 statement the MSA generator drafts
// (Spec B9, /app/compliance/msa). Pure: no React, so the text a buyer copies
// or downloads is exactly what `lib/msa-statement.test.ts` reads.
//
// Nothing fake (PRODUCT.md): the draft states only what SourceBD's records
// show about the buyer's saved suppliers, and says where each figure comes
// from. What SourceBD cannot know — the buyer's policies, training, due
// diligence, board approval, what it did about a match — is a
// `[Confirm: …]` placeholder the buyer fills in or deletes. A placeholder
// that holds a whole sentence is a claim for the buyer to check; the others
// say what to write.

import { formatCount, formatDay } from "@/lib/dashboard/facts";

/** `compliance_msa_inputs()` (migration 0030), over the buyer's published saved suppliers. */
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
  /** Saved suppliers with an active match on ANY list SourceBD holds, not only UFLPA. */
  sanctions_hits: number;
  /** Certificates expiring in the next 90 days; the RPC never counts one already expired. */
  expiring_certs_90d: number;
};

/**
 * The UFLPA tracker's counts (`compliance_uflpa_tracker()`) for the same
 * suppliers, as its page shows them: a supplier with a match is not also
 * counted as a region flag. Null when the tracker did not load.
 */
export type MsaScreening = { total: number; hits: number; flags: number; clear: number };

export type StatementArgs = {
  /** The buyer's own fields, as typed; empty ones become placeholders. */
  org: string;
  year: string;
  signerName: string;
  signerRole: string;
  /** The day the figures are read, `YYYY-MM-DD`. */
  asOf: string;
  inputs: MsaInputs;
  screening: MsaScreening | null;
};

const PLACEHOLDER_OPEN = "[Confirm:";

/** A gap only the buyer can fill. */
export function confirm(text: string): string {
  return `${PLACEHOLDER_OPEN} ${text}]`;
}

/** How many `[Confirm: …]` placeholders a text still holds. */
export function countPlaceholders(text: string): number {
  return text.split(PLACEHOLDER_OPEN).length - 1;
}

function count(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

function counted(items: { label: string; count: number }[]): string {
  return items.map((i) => `${i.label} (${formatCount(i.count)})`).join(", ");
}

function bullets(items: string[]): string {
  return items.length > 0 ? items.map((i) => `- ${i}`).join("\n") : "- None recorded on SourceBD";
}

export function buildStatement(args: StatementArgs): string {
  const { inputs, screening } = args;
  const org = args.org.trim();
  const year = args.year.trim();
  // Outside a placeholder an empty field is itself one; inside one it reads
  // as plain words, so placeholders never nest.
  const orgOut = org || confirm("organisation name");
  const orgIn = org || "your organisation";
  const yearOut = year || confirm("financial year");
  const yearIn = year || "the financial year";
  const signer = args.signerName.trim() || confirm("signatory name");
  const role = args.signerRole.trim() || confirm("signatory role");
  const asOf = formatDay(args.asOf) ?? args.asOf;
  const published = inputs.total_published;
  const rscAvg = inputs.rsc_avg_progress_pct != null ? `${inputs.rsc_avg_progress_pct.toFixed(1)}%` : null;

  const countries =
    inputs.by_country.length > 0
      ? counted(inputs.by_country.map((c) => ({ label: c.country, count: c.count })))
      : "none recorded on SourceBD";

  const registers =
    inputs.by_register.length > 0
      ? `Register records on SourceBD for these suppliers (suppliers on each): ${counted(
          inputs.by_register.map((r) => ({ label: r.register, count: r.count })),
        )}.`
      : "SourceBD holds no BGMEA, BKMEA, BTMA, BGAPMEA, EPB or RSC record for these suppliers.";

  // The RPC counts every certificate on record, lapsed ones included.
  const certs =
    inputs.by_certification.length > 0
      ? `Certification records on SourceBD (suppliers with each; lapsed certificates included): ${counted(
          inputs.by_certification.map((c) => ({ label: prettyCert(c.kind), count: c.count })),
        )}.`
      : "SourceBD holds no certification record for these suppliers.";

  const rsc =
    inputs.rsc_covered > 0
      ? `${count(inputs.rsc_covered, "of these suppliers is", "of these suppliers are")} in the RMG Sustainability Council (RSC) safety remediation programme${
          rscAvg ? `, with average remediation progress of ${rscAvg}` : ""
        }, according to RSC records on SourceBD.`
      : "None of these suppliers is in the RMG Sustainability Council (RSC) safety remediation programme, according to RSC records on SourceBD.";

  // Only the list the tracker reads is named. A match on another list SourceBD
  // holds is still disclosed, without a name the buyer would have to stand by.
  const otherLists = screening ? Math.max(0, inputs.sanctions_hits - screening.hits) : 0;
  const screeningLines = screening
    ? [
        `SourceBD checks each of our ${count(screening.total, "saved supplier")} against the U.S. Department of Homeland Security UFLPA Entity List. As at ${asOf}: ${count(
          screening.hits,
          "match",
          "matches",
        )}, ${count(screening.flags, "region flag")}, ${formatCount(screening.clear)} clear.${
          screening.flags > 0
            ? " A region flag means the supplier's record on SourceBD (its group name or address) mentions Xinjiang or the Uyghur region."
            : ""
        }`,
        ...(otherLists > 0
          ? [
              `${count(otherLists, "further saved supplier matches", "further saved suppliers match")} an entry on another sanctions or forced-labour list held by SourceBD.`,
            ]
          : []),
        ...(screening.hits + screening.flags + otherLists > 0
          ? [
              confirm(
                `what ${orgIn} did about each match and region flag, for example asked for documents, paused orders or ended the relationship.`,
              ),
            ]
          : []),
      ]
    : [
        confirm(
          "the result of checking your suppliers against the UFLPA Entity List. SourceBD's UFLPA tracker did not load, so this draft cannot state it; reload the page to fill it in.",
        ),
      ];

  const expiring = `${
    inputs.expiring_certs_90d > 0
      ? `${count(inputs.expiring_certs_90d, "certificate", "certificates")} held by our saved suppliers ${
          inputs.expiring_certs_90d === 1 ? "expires" : "expire"
        } within the next 90 days, according to SourceBD's certificate records.`
      : "No certificate on SourceBD's records for our saved suppliers expires within the next 90 days."
  } Certificates that have already lapsed are not counted here.`;

  const kpis = [
    `Published suppliers saved: **${formatCount(published)}**`,
    `In the RSC remediation programme: **${formatCount(inputs.rsc_covered)}**${rscAvg ? ` (average progress ${rscAvg})` : ""}`,
    ...(screening
      ? [`UFLPA Entity List matches: **${formatCount(screening.hits)}**`, `UFLPA region flags: **${formatCount(screening.flags)}**`]
      : []),
    `Certificates expiring within 90 days (lapsed certificates not counted): **${formatCount(inputs.expiring_certs_90d)}**`,
  ];

  const body = `**Organisation:** ${orgOut}
**Financial year:** ${yearOut}

This statement is made under section 54 of the UK Modern Slavery Act 2015. It sets out the steps ${orgOut} has taken during the financial year ${yearOut} to ensure that slavery and human trafficking are not taking place in any of its supply chains or in any part of its own business.

## 1. Organisation and supply chain structure

${confirm(`what ${orgIn} does: what it sells, where it operates, its annual turnover and how many people it employs.`)}

${confirm(`${orgIn} sources from the suppliers described below.`)} The figures describe the ${count(published, "published supplier")} saved in our SourceBD account, as at ${asOf}, from SourceBD's supplier records.

Countries: ${countries}.

By facility type:

${bullets(inputs.by_entity_type.map((e) => `${prettyEntityType(e.entity_type)}: ${formatCount(e.count)}`))}

Top locations:

${bullets(inputs.top_regions.slice(0, 5).map((r) => `${[r.city, r.district].filter(Boolean).join(", ")}: ${count(r.count, "supplier")}`))}

Top parent groups:

${bullets(inputs.top_parent_groups.slice(0, 5).map((g) => `${g.parent_group_name}: ${count(g.count, "supplier")}`))}

## 2. Policies in relation to slavery and human trafficking

${confirm(
  `the policies ${orgIn} has in force that address slavery and human trafficking (for example a modern slavery policy, a supplier code of conduct, a whistleblowing policy or a responsible recruitment policy) and what they require of suppliers. Name only the ones you have.`,
)}

## 3. Due diligence processes

${confirm(`the due diligence ${orgIn} carries out on suppliers before and during the relationship, for example document checks, audits or site visits.`)}

${registers} ${certs}

${rsc}

## 4. Risk assessment

${confirm(`how ${orgIn} assesses modern slavery risk in its supply chains and its own business, and where it found the highest risk.`)}

${screeningLines.join("\n\n")}

${expiring}

## 5. Training

${confirm(`the training on modern slavery ${orgIn} gave during ${yearIn}: who received it and how often. If none was given, say so.`)}

## 6. Effectiveness — key performance indicators

${confirm(`how ${orgIn} measures whether these steps are working, and what changed during ${yearIn}.`)}

Figures from SourceBD for our saved suppliers, as at ${asOf}:

${bullets(kpis)}

## 7. Approval

${confirm(`This statement was approved by the board of directors (or equivalent) of ${orgIn} on (date of approval).`)}

**Signed:** ${signer}
**Role:** ${role}
**Date:** _____________________
`;

  const pending = countPlaceholders(body);
  // The warning travels with the text, so a pasted copy still carries it.
  const note =
    pending > 0
      ? `> DRAFT: ${count(pending, "item")} marked "Confirm" still ${pending === 1 ? "needs" : "need"} your answer. SourceBD cannot know ${
          pending === 1 ? "it" : "them"
        }. Fill in or delete each one, then delete this note.\n\n`
      : "";

  return `# Modern Slavery Act 2015 — Section 54 Transparency Statement\n\n${note}${body}`;
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
