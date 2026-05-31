// Spec M3 — Compliance education content (shared source of truth).
//
// Single TS constant module powering the hub `/compliance` page and the
// 5 dynamic detail pages `/compliance/[slug]`. No DB read, no MDX, no CMS.
//
// Every citation is Tier 1 (gov/regulatory) or Tier 5 (US/UK/EU regulatory)
// per `context/architecture.md` Source Trust Hierarchy. The M3 smoke
// asserts every page renders >=1 Tier-1-or-5 citation and zero Tier-4
// (brand) hosts.
//
// `last_reviewed_at` per page is the staleness signal. A page-level
// inline assertion (in `app/(marketing)/compliance/[slug]/page.tsx`)
// throws at render if any page is older than 365 days, so stale content
// fails `pnpm build`, not just the smoke. Bump the date in this file
// whenever a spec revisits the copy.

export type SourceTier = "tier1_gov" | "tier5_regulatory";

export type Citation = {
  label: string;
  url: string;
  issuer: string;
  tier: SourceTier;
  accessed_on: string; // ISO 8601 yyyy-mm-dd
};

export type Section = {
  heading: string;
  body: string[]; // paragraphs
  bullets?: string[];
};

export type CompliancePage = {
  slug: "uk-msa" | "uflpa" | "eu-cbam" | "eu-eudr" | "eu-csddd";
  title: string; // <h1> on the detail page
  shortName: string; // hub tile + nav references
  headline: string; // one-line summary (hub tile + meta description)
  summary: string; // opening paragraph at top of detail page
  sections: Section[]; // ordered per JC #11 anatomy (first 5 sections)
  references: Citation[]; // rendered in section 6 "References"
  last_reviewed_at: string; // ISO 8601 yyyy-mm-dd
  seo: { description: string; ogTitle: string };
};

export const DISCLAIMER =
  "Educational summary, not legal advice. Consult counsel for obligations specific to your business.";

// The shared anatomy heading order — matches JC #11. Detail-page
// renderer iterates `sections` in this order, then appends a 6th
// section "References" built from `references`.
export const SECTION_ORDER: ReadonlyArray<string> = [
  "What it is",
  "Who it applies to",
  "What you must do",
  "Penalties for non-compliance",
  "How SourceBD's data helps",
];

export const COMPLIANCE_PAGES: CompliancePage[] = [
  // ────────────────────────────────────────────────────────────────────
  // UK Modern Slavery Act 2015, §54
  // ────────────────────────────────────────────────────────────────────
  {
    slug: "uk-msa",
    title: "UK Modern Slavery Act §54 — supply-chain transparency",
    shortName: "UK Modern Slavery Act",
    headline:
      "Section 54 statements for commercial organisations with £36M+ turnover supplying goods or services in the UK.",
    summary:
      "Section 54 of the UK Modern Slavery Act 2015 requires commercial organisations carrying on business in the UK with a global turnover of £36 million or more to publish an annual slavery and human trafficking statement. The statement must describe the steps the organisation has taken to ensure modern slavery is not taking place in its supply chains or in any part of its own business.",
    sections: [
      {
        heading: "What it is",
        body: [
          "Section 54 of the Modern Slavery Act 2015 introduced a public reporting duty for large commercial organisations. The statute does not prescribe what an organisation must do about modern slavery — it requires public disclosure of what the organisation has done, signed at board level and published on the home page of its UK website.",
          "The Home Office maintains a central registry of submitted statements; organisations are expected to submit a copy each financial year.",
        ],
      },
      {
        heading: "Who it applies to",
        body: [
          "The duty applies to any body corporate or partnership, wherever incorporated, that:",
        ],
        bullets: [
          "carries on a business, or part of a business, in the United Kingdom;",
          "supplies goods or services; and",
          "has a total annual turnover of £36 million or more (worldwide group turnover where applicable).",
        ],
      },
      {
        heading: "What you must do",
        body: [
          "Each financial year you must publish a statement that, in the recommended structure, covers:",
        ],
        bullets: [
          "the organisation's structure, business and supply chains;",
          "its policies on slavery and human trafficking;",
          "its due diligence processes;",
          "the parts of its business and supply chains where there is a risk of slavery and human trafficking taking place, and the steps it has taken to assess and manage that risk;",
          "its effectiveness in ensuring slavery and human trafficking is not taking place, measured against performance indicators it considers appropriate;",
          "the training about slavery and human trafficking available to its staff.",
        ],
      },
      {
        heading: "Penalties for non-compliance",
        body: [
          "The Act provides for civil enforcement by the Secretary of State through injunction proceedings in the High Court; failure to comply with an injunction can lead to an unlimited fine.",
          "In practice the principal cost of non-compliance is reputational: the central registry is public, customers and investors check it, and the UK Government has signalled an intention to strengthen enforcement.",
        ],
      },
      {
        heading: "How SourceBD's data helps",
        body: [
          "Drafting a §54 statement requires you to describe your supply chain structure with named factories, the registers and certifications they hold, and the steps you have taken to assess risk. SourceBD surfaces the receipts that back those claims:",
        ],
        bullets: [
          "Government registers (BGMEA, BKMEA, BTMA, BGAPMEA, EPB, RSC) with reg numbers per supplier.",
          "Independent certifications (WRAP, OEKO-TEX, GOTS, SA8000) with issuer, certificate number, and expiry where published.",
          "RSC remediation percentage on every covered factory, with mirrored CAP, fire, electrical, structural, and boiler inspection documents.",
          "An MSA-statement aggregate generator in the Compliance Hub that compiles supplier counts by country, register, certification, and RSC coverage from your saved set.",
        ],
      },
    ],
    references: [
      {
        label: "Modern Slavery Act 2015, Section 54",
        url: "https://www.legislation.gov.uk/ukpga/2015/30/section/54",
        issuer: "UK Government (legislation.gov.uk)",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "Modern slavery statement registry",
        url: "https://modern-slavery-statement-registry.service.gov.uk/",
        issuer: "UK Home Office",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "Transparency in supply chains: a practical guide",
        url: "https://www.gov.uk/government/publications/transparency-in-supply-chains-a-practical-guide",
        issuer: "UK Home Office",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
    ],
    last_reviewed_at: "2026-06-01",
    seo: {
      description:
        "What the UK Modern Slavery Act §54 requires of importers and brands sourcing from Bangladesh, with citations to UK Government sources.",
      ogTitle: "UK Modern Slavery Act §54 — SourceBD compliance guide",
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // US UFLPA
  // ────────────────────────────────────────────────────────────────────
  {
    slug: "uflpa",
    title: "US Uyghur Forced Labor Prevention Act (UFLPA)",
    shortName: "UFLPA",
    headline:
      "Rebuttable presumption that goods made wholly or in part in Xinjiang, or by listed entities, are made with forced labour and barred from US entry.",
    summary:
      "The Uyghur Forced Labor Prevention Act creates a rebuttable presumption that any goods mined, produced, or manufactured wholly or in part in the Xinjiang Uyghur Autonomous Region of the People's Republic of China, or by entities on the UFLPA Entity List, are made with forced labour and are therefore prohibited from importation into the United States under 19 U.S.C. §1307. Importers must rebut the presumption with clear and convincing evidence; otherwise US Customs and Border Protection will detain, exclude, or seize the shipment.",
    sections: [
      {
        heading: "What it is",
        body: [
          "Public Law 117-78 (signed December 2021, effective 21 June 2022) shifts the burden of proof onto importers. CBP enforces it through detentions at US ports of entry; the Department of Homeland Security maintains the UFLPA Entity List, which names companies whose goods are presumed to be made with forced labour.",
        ],
      },
      {
        heading: "Who it applies to",
        body: [
          "Any importer of record bringing goods into the United States. There is no de minimis threshold and no sector carve-out — apparel, footwear, electronics, polysilicon, tomatoes, and cotton-containing products are all in scope.",
        ],
      },
      {
        heading: "What you must do",
        body: [
          "To clear a shipment that CBP suspects falls under the presumption, you must provide:",
        ],
        bullets: [
          "a complete supply-chain trace from raw input to finished good, with named entities at every tier;",
          "documentary evidence (purchase orders, transportation records, payroll records, time-and-attendance records) that the supply chain has no nexus to Xinjiang or to any listed entity;",
          "evidence that meets the CBP \"clear and convincing\" standard, not merely a balance-of-probability showing.",
        ],
      },
      {
        heading: "Penalties for non-compliance",
        body: [
          "Detained shipments incur demurrage costs while held; excluded shipments must be re-exported or destroyed. CBP publishes monthly enforcement statistics showing detained, denied, and released shipments by industry and country of origin. Repeat or wilful violations expose the importer to civil penalties under 19 U.S.C. §1592 (up to the domestic value of the merchandise) and, in egregious cases, criminal liability.",
        ],
      },
      {
        heading: "How SourceBD's data helps",
        body: [
          "Bangladesh is not Xinjiang, but UFLPA traceability requires you to prove the negative — that no input in your supply chain originated there. SourceBD's data layer supports that work:",
        ],
        bullets: [
          "Every published supplier in our index is screened against the UFLPA Entity List, the US CBP Withhold Release Orders, the OFAC SDN list, the UK OFSI consolidated list, the EU consolidated sanctions list, and the US DoL ILAB TVPRA goods-by-country catalogue.",
          "Suppliers flagged as active sanctions hits carry a top-of-profile red banner and a server-internal score of zero.",
          "The Compliance Hub UFLPA tracker scans your saved suppliers for both Entity List matches and conservative region-flag heuristics (parent group or address text matching `xinjiang|uyghur|uighur|XUAR`) so you see flags before you book production.",
        ],
      },
    ],
    references: [
      {
        label: "Public Law 117-78 — Uyghur Forced Labor Prevention Act",
        url: "https://www.congress.gov/117/plaws/publ78/PLAW-117publ78.pdf",
        issuer: "US Congress",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "UFLPA Entity List",
        url: "https://www.dhs.gov/uflpa-entity-list",
        issuer: "US Department of Homeland Security",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "UFLPA Operational Guidance for Importers",
        url: "https://www.cbp.gov/sites/default/files/assets/documents/2022-Jun/CBP_Guidance_for_Importers_for_UFLPA_13_June_2022.pdf",
        issuer: "US Customs and Border Protection",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "UFLPA Statistics Dashboard",
        url: "https://www.cbp.gov/newsroom/stats/trade/uflpa-statistics",
        issuer: "US Customs and Border Protection",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
    ],
    last_reviewed_at: "2026-06-01",
    seo: {
      description:
        "What the US UFLPA requires of importers, how rebuttable presumption works, and how SourceBD's UFLPA traceability tracker supports compliance.",
      ogTitle: "US UFLPA — SourceBD compliance guide",
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // EU CBAM
  // ────────────────────────────────────────────────────────────────────
  {
    slug: "eu-cbam",
    title: "EU Carbon Border Adjustment Mechanism (CBAM)",
    shortName: "EU CBAM",
    headline:
      "Carbon price at the EU border on imports of cement, iron and steel, aluminium, fertilisers, electricity, and hydrogen — apparel not yet in scope.",
    summary:
      "The Carbon Border Adjustment Mechanism (Regulation (EU) 2023/956) puts a carbon price on imports of selected carbon-intensive goods entering the European Union, mirroring the price paid by EU producers under the EU Emissions Trading System. The transitional phase began 1 October 2023; full financial liability begins 1 January 2026. Apparel and textiles are not in the initial scope, but the regulation provides for scope expansion and importers in adjacent sectors are reviewing their data systems now.",
    sections: [
      {
        heading: "What it is",
        body: [
          "CBAM levels the cost of carbon between EU-produced goods (which already pay under the ETS) and imported goods. During the transitional phase importers report embedded emissions only; from 2026 they purchase CBAM certificates corresponding to the embedded emissions in their imports.",
        ],
      },
      {
        heading: "Who it applies to",
        body: [
          "Importers of record bringing in goods in the CBAM scope:",
        ],
        bullets: [
          "cement;",
          "iron and steel;",
          "aluminium;",
          "fertilisers;",
          "electricity;",
          "hydrogen.",
          "Apparel and textile goods are NOT currently in scope. Trims, hardware (steel buttons, aluminium zippers), and metallic components may be in scope when imported separately. Verify the CN code of every imported item against the CBAM goods list before assuming exemption.",
        ],
      },
      {
        heading: "What you must do",
        body: [
          "If you import any in-scope goods you must:",
        ],
        bullets: [
          "register as a CBAM declarant in the CBAM Registry;",
          "submit quarterly reports during the transitional phase with embedded direct and indirect emissions;",
          "from 1 January 2026, surrender CBAM certificates each year equal to the embedded emissions of the prior year's imports;",
          "verify embedded-emissions data via an accredited verifier (full obligation from 2026).",
        ],
      },
      {
        heading: "Penalties for non-compliance",
        body: [
          "Penalties for failing to submit a CBAM report or for understating emissions range from EUR 10 to EUR 50 per tonne of unreported embedded emissions during the transitional phase. From the definitive phase, missing CBAM certificate surrenders are penalised at three times the average certificate price for the year of import, and penalty payment does not extinguish the surrender obligation.",
        ],
      },
      {
        heading: "How SourceBD's data helps",
        body: [
          "CBAM is not currently a Bangladesh-RMG problem at the garment level. SourceBD's value here is signalling: if you import steel buttons, aluminium trim, or metallic hardware sourced from Bangladesh, the SourceBD supplier profile shows the principal products of each factory, so you can confirm whether the CN-code-bearing component originates with that supplier or is a downstream addition. The Compliance Hub does not currently issue CBAM reports; the regulation is monitored for scope expansion and this page will be revised when textiles enter the goods list.",
        ],
      },
    ],
    references: [
      {
        label: "Regulation (EU) 2023/956 establishing a CBAM",
        url: "https://eur-lex.europa.eu/eli/reg/2023/956/oj",
        issuer: "EUR-Lex (Official Journal of the European Union)",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "CBAM — European Commission, DG Taxation and Customs Union",
        url: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en",
        issuer: "European Commission",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "Implementing Regulation (EU) 2023/1773 (transitional reporting)",
        url: "https://eur-lex.europa.eu/eli/reg_impl/2023/1773/oj",
        issuer: "EUR-Lex",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
    ],
    last_reviewed_at: "2026-06-01",
    seo: {
      description:
        "EU CBAM scope, reporting timeline, and why apparel is not currently in scope but adjacent components may be. Cited to EUR-Lex and the European Commission.",
      ogTitle: "EU CBAM — SourceBD compliance guide",
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // EU EUDR
  // ────────────────────────────────────────────────────────────────────
  {
    slug: "eu-eudr",
    title: "EU Deforestation Regulation (EUDR)",
    shortName: "EU EUDR",
    headline:
      "Due-diligence regime for cattle, cocoa, coffee, oil palm, rubber, soya, and wood — and downstream products including leather and printed paper.",
    summary:
      "Regulation (EU) 2023/1115 prohibits placing on the EU market, or exporting from it, a defined set of commodities and their downstream products unless they are deforestation-free, produced in accordance with the laws of the country of production, and covered by a due-diligence statement filed via the EU Information System. The regulation entered into force on 29 June 2023; obligations apply from 30 December 2025 (large operators) and 30 June 2026 (micro- and small enterprises).",
    sections: [
      {
        heading: "What it is",
        body: [
          "EUDR replaces the EU Timber Regulation with a wider scope and a stricter compliance test: not just legality but a zero-deforestation cut-off date of 31 December 2020. Operators and non-SME traders must collect geolocation data for every plot of land where the relevant commodity was produced and submit a Due Diligence Statement before the product enters the EU.",
        ],
      },
      {
        heading: "Who it applies to",
        body: [
          "Operators (placing the product on the EU market for the first time) and non-SME traders (making the product available downstream) of any product containing or made using:",
        ],
        bullets: [
          "cattle (and derived products such as leather);",
          "cocoa;",
          "coffee;",
          "oil palm;",
          "rubber (and derived products such as rubber-soled footwear, rubber prints);",
          "soya;",
          "wood (and derived products such as paper, printed cartons, wooden hangers, wooden buttons).",
          "Cotton, viscose, polyester, and acrylic are NOT currently in scope. Garment makers should still review hangtags, polybag printing, swing tickets, and cartons — printed paper is in scope.",
        ],
      },
      {
        heading: "What you must do",
        body: [
          "For each batch entering or leaving the EU you must:",
        ],
        bullets: [
          "collect plot-level geolocation (polygon for plots >4 ha, point for smaller plots) for every production site;",
          "assess deforestation risk against the 31 December 2020 cut-off and against producer-country legality;",
          "mitigate where the risk is non-negligible;",
          "submit a Due Diligence Statement (DDS) in the EU Information System before the product is placed on the market;",
          "retain all due-diligence records for five years.",
        ],
      },
      {
        heading: "Penalties for non-compliance",
        body: [
          "EU member states must set penalties that are effective, proportionate, and dissuasive. Article 25 sets a floor: fines must reach at least 4% of the operator's or trader's annual EU-wide turnover. Penalties also include confiscation of the goods and of the revenues, temporary exclusion from public procurement and public funding, and (for serious or repeated breaches) temporary prohibition from placing the relevant products on the EU market.",
        ],
      },
      {
        heading: "How SourceBD's data helps",
        body: [
          "Bangladesh-RMG inputs are mostly out of EUDR scope (cotton, polyester, viscose). The compliance work tends to be in trims, hardware, and packaging. SourceBD supports that:",
        ],
        bullets: [
          "Principal-products and factory-types arrays on every supplier let you filter for factories handling leather, wooden buttons, paper hangtags, or rubber components.",
          "Brand-disclosure attributions show which UK / EU brands have already published the supplier on their factory list — useful corroboration when documenting supply-chain history.",
          "Geolocation polygons are NOT in SourceBD's data layer today; the regulation requires per-plot polygons at the production site of the regulated commodity, which is a farm-level data product, not a factory-level one. SourceBD's value is the factory layer; pair it with a farm-traceability tool for the commodity tier when in-scope inputs are present.",
        ],
      },
    ],
    references: [
      {
        label: "Regulation (EU) 2023/1115 (EUDR)",
        url: "https://eur-lex.europa.eu/eli/reg/2023/1115/oj",
        issuer: "EUR-Lex",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "EUDR — European Commission, DG Environment",
        url: "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en",
        issuer: "European Commission",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "EUDR Frequently Asked Questions",
        url: "https://environment.ec.europa.eu/system/files/2024-04/Q%26A%20EUDR%20-%20updated%2003042024.pdf",
        issuer: "European Commission",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
    ],
    last_reviewed_at: "2026-06-01",
    seo: {
      description:
        "EU Deforestation Regulation scope, due-diligence statements, geolocation requirements, and what it means for garment trims, hardware, and packaging.",
      ogTitle: "EU EUDR — SourceBD compliance guide",
    },
  },

  // ────────────────────────────────────────────────────────────────────
  // EU CSDDD
  // ────────────────────────────────────────────────────────────────────
  {
    slug: "eu-csddd",
    title: "EU Corporate Sustainability Due Diligence Directive (CSDDD)",
    shortName: "EU CSDDD",
    headline:
      "Mandatory human-rights and environmental due diligence across the chain of activities of large EU and non-EU companies operating in the EU.",
    summary:
      "Directive (EU) 2024/1760 (CSDDD) imposes a mandatory human-rights and environmental due-diligence duty on large EU and non-EU companies operating in the EU. Companies must identify, prevent, mitigate, and account for actual and potential adverse impacts in their own operations, their subsidiaries, and their chain of activities — and adopt a climate transition plan compatible with the 1.5 °C trajectory. Member states must transpose the directive by 26 July 2027; obligations phase in from 2027 to 2029 by company size.",
    sections: [
      {
        heading: "What it is",
        body: [
          "CSDDD is the EU's response to the patchwork of national supply-chain laws (France Loi de Vigilance, Germany LkSG, Netherlands CSDDA). It harmonises the duty and gives victims access to EU civil courts; non-compliance can attract administrative fines of at least 5% of net worldwide turnover.",
        ],
      },
      {
        heading: "Who it applies to",
        body: [
          "Phased coverage by size and turnover. Final thresholds after the 2024 revision:",
        ],
        bullets: [
          "From 26 July 2027: EU companies with > 5,000 employees and > EUR 1.5 billion net worldwide turnover; non-EU companies with > EUR 1.5 billion net turnover generated in the EU.",
          "From 26 July 2028: EU companies with > 3,000 employees and > EUR 900 million; non-EU companies with > EUR 900 million EU turnover.",
          "From 26 July 2029: EU companies with > 1,000 employees and > EUR 450 million; non-EU companies with > EUR 450 million EU turnover.",
          "Smaller suppliers are out of direct scope but will receive due-diligence requests as part of in-scope buyers' duty over their chain of activities.",
        ],
      },
      {
        heading: "What you must do",
        body: [
          "An in-scope company must, across its own operations, its subsidiaries, and the chain of activities of its established business relationships:",
        ],
        bullets: [
          "integrate due diligence into policies and risk management;",
          "identify and assess actual and potential adverse human-rights and environmental impacts;",
          "prevent and mitigate potential adverse impacts; bring actual adverse impacts to an end or minimise their extent;",
          "engage meaningfully with affected stakeholders;",
          "establish and maintain a notification and complaints procedure;",
          "monitor the effectiveness of its due-diligence policy and measures;",
          "publicly communicate on due diligence;",
          "adopt and put into effect a climate transition plan consistent with the 1.5 °C objective of the Paris Agreement.",
        ],
      },
      {
        heading: "Penalties for non-compliance",
        body: [
          "Member states must impose penalties that are effective, proportionate, and dissuasive. Pecuniary penalties must be set with a maximum of at least 5% of the net worldwide turnover. Civil liability is provided: a company can be held liable for damages where it intentionally or negligently fails to comply with its prevention or mitigation duties and that failure causes damage to a natural or legal person.",
        ],
      },
      {
        heading: "How SourceBD's data helps",
        body: [
          "CSDDD requires a documented, repeatable due-diligence process across your chain of activities. SourceBD's receipts-first model is built for that:",
        ],
        bullets: [
          "Every supplier in the index carries source-pill provenance for every published claim — issuer, source URL, last-seen date — so each fact in your due-diligence record is verifiable by an auditor.",
          "RSC remediation percentages and the 7,000+ mirrored inspection documents support the actual-impacts identification and remediation evidence.",
          "Sanctions screening against six lists (UFLPA, US WROs, OFAC SDN, UK OFSI, EU consolidated sanctions, ILAB TVPRA) feeds the human-rights risk identification step.",
          "Brand-disclosure attributions show where named buyers have already verified a factory; useful when assessing risk in shared supply chains.",
        ],
      },
    ],
    references: [
      {
        label: "Directive (EU) 2024/1760 (CSDDD)",
        url: "https://eur-lex.europa.eu/eli/dir/2024/1760/oj",
        issuer: "EUR-Lex",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
      {
        label: "Corporate sustainability due diligence — European Commission",
        url: "https://commission.europa.eu/business-economy-euro/doing-business-eu/sustainability-due-diligence-responsible-business/corporate-sustainability-due-diligence_en",
        issuer: "European Commission",
        tier: "tier5_regulatory",
        accessed_on: "2026-06-01",
      },
    ],
    last_reviewed_at: "2026-06-01",
    seo: {
      description:
        "What the EU CSDDD requires of large EU and non-EU companies, phased thresholds 2027–2029, and how SourceBD's source-pill provenance supports auditable due-diligence records.",
      ogTitle: "EU CSDDD — SourceBD compliance guide",
    },
  },
];

// Hub-level metadata. Rendered on the `/compliance` landing page.
export const HUB_METADATA = {
  title: "Compliance — SourceBD",
  headline:
    "Receipts-first compliance education for UK, US, EU, and CA buyers sourcing from Bangladesh.",
  summary:
    "Five regulations shape supplier due diligence for brands and importers sourcing apparel from Bangladesh. SourceBD's index is built to support each of them. The pages below summarise what the regulation requires, who it binds, and what the SourceBD data layer surfaces to back your own compliance record.",
  description:
    "Compliance guides for UK Modern Slavery Act, US UFLPA, EU CBAM, EU EUDR, and EU CSDDD — with citations to government and EU sources.",
} as const;

// Look up by slug — exported so the dynamic route can resolve params.
export function findCompliancePage(
  slug: string,
): CompliancePage | undefined {
  return COMPLIANCE_PAGES.find((p) => p.slug === slug);
}

// Returns the oldest `last_reviewed_at` across all detail pages. Used by
// the hub page footer ("Last reviewed: …") and by the build-time
// staleness assertion. Returns ISO 8601.
export function oldestReviewedAt(): string {
  return COMPLIANCE_PAGES.map((p) => p.last_reviewed_at).sort()[0]!;
}

// Build-time staleness check. Throws if any page is older than the
// allowed window. Invoked at the top of every compliance page render
// so a stale page fails `pnpm build`, not just the smoke.
//
// Window is 365 days; this is a content-review cadence promise, not a
// regulatory clock.
const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
export function assertContentFresh(now: Date = new Date()): void {
  for (const p of COMPLIANCE_PAGES) {
    const t = Date.parse(p.last_reviewed_at);
    if (Number.isNaN(t)) {
      throw new Error(
        `compliance-pages: ${p.slug} has invalid last_reviewed_at ${JSON.stringify(p.last_reviewed_at)}`,
      );
    }
    if (now.getTime() - t > MAX_AGE_MS) {
      throw new Error(
        `compliance-pages: ${p.slug} last_reviewed_at=${p.last_reviewed_at} is older than 365 days; bump the date in lib/marketing/compliance-pages.ts before shipping`,
      );
    }
  }
}
