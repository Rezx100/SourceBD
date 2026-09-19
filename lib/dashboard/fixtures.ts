// Test fixtures for the dashboard kit: the shape `buyer_supplier_profile`,
// `supplier_epb_hscodes` and `production_workers_display_batch` return, with
// the values of the named test records copied verbatim from production on
// 19 Sep 2026 (rebuild spec §3 "Real records to test with"). Nothing here is
// invented: if a column is null on production it is null here, and the payloads
// are trimmed only by dropping keys the kit never reads (`documents`,
// `partner_factories`, `sanctions`, `supplier_about`, …).
// `lib/dashboard/fixtures.test.ts` re-checks the row counts and the named
// values against the payloads the RPCs returned on that read, so a fixture
// that drifts from production fails the suite instead of passing quietly.
//
// Every literal here is a value production holds. Where a state the screens
// must render has no production record — a sanctioned supplier, a pill a
// parent factory lends to a satellite — the fixture composes it from real
// rows and says so in a comment; it never attaches an invented number, URL or
// name to a named real company (ds-rebuild-must-stay §2).
//
// Contact fields are deliberately added to one fixture — marked `leaked`, and
// never returned by the RPC — so the boundary test can prove they never reach
// the HTML. Used only by tests and the /dev/ds screenshot harness, never by a page.

import type { HsLine, ProfilePayload, ProfilePill, RecordInput } from "./build-models";

export const TODAY = new Date("2026-09-18T10:00:00Z");

/** The longest name a buyer can reach: 100 characters (spec §3). Real, published. */
/** Aboni's second RSC site: a building of the record, never the record itself. */
export const ABONI_NEW_SHED = "Aboni Knitwear (New Shed)";

export const ZAHEEN_NAME =
  "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)";

/**
 * The longest name of all: 125 characters (spec §3, §6). Real record, slug
 * `indochine-apparel-bangladesh-limited-plot-54-56-previously-baxter-brenton-bd-clothing-manufacturing-co-ltd-extension`,
 * unpublished — so it reaches admin lists only, but the card, table row and
 * sheet must still carry it whole.
 */
export const LONG_NAME_125 =
  "Indochine Apparel (Bangladesh) Limited, Plot 54-56 (Previously Baxter Brenton (BD) Clothing Manufacturing Co. Ltd (Extension)";

/** Brand disclosure-list files, shared by the records that appear on them. */
const ASOS_LIST = "https://www.asosplc.com/media/cmzk3m5n/factory-list-april-2026.pdf";
const HM_LIST = "https://hmgroup.com/wp-content/uploads/spur/HM-Group-Supplier-List-May-2026 .xlsx";
const NEXT_LIST = "https://www.nextplc.co.uk/~/media/Files/N/next-plc-v4/Tier 1 -2 - 3 lists/T1 2025.pdf";

// ---------------------------------------------------------------------------
// Aboni Knitwear — the rich record: 11 registers, 4 certificates, 12 HS lines,
// a mother RSC row and a building RSC row.
// ---------------------------------------------------------------------------

export function aboniProfile(): ProfilePayload {
  return {
    supplier: {
      id: "8ce50581-2d84-4cc2-93de-506394eade5d",
      slug: "aboni-knitwear",
      company_name: "ABONI KNITWEAR LTD.",
      entity_type: "factory",
      city: "Dhaka",
      district: "Dhaka",
      address_raw: "PLOT-169-171, UNION: TETULZHORA, HAMAYETPUR, SAVAR, DHAKA",
      is_sanctioned: false,
      parent_group_name: "Babylon Group",
      established_date: "1985",
      factory_types: ["Dyeing", "Knit", "Packaging", "Woven"],
      principal_products: [
        "All Kind of Knit Item",
        "Babies' apparel",
        "Back Board",
        "Blouses",
        "Children's apparel",
        "Children's denim apparel",
        "Collar Insert",
        "Corrugated Carton",
        "Dyed fabrics",
        "Fashion Wears",
        "Greige fabrics",
        "Hang Tag",
        "Knitted Garments",
        "Ladies Items",
        "Men's apparel",
        "Men's denim apparel",
        "Neck Board",
        "photo in lay",
        "Photocard etc",
        "Price Tag",
        "Shirts",
        "Tissue Paper",
        "Unisex apparel",
        "Unisex denim apparel",
        "Women's apparel",
        "Women's denim apparel",
        "Worn accessories",
      ],
      employees_total: 3314,
      machines_sewing: 850,
      production_capacity_pcs_day: 1000000,
      production_capacity_dozen_yearly: null,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGMEA", "BGAPMEA", "EPB", "BRAND_ASOS", "WRAP", "GOTS", "BRAND_HM", "BRAND_NEXT", "RSC", "BKMEA", "OEKO_TEX"],
    },
    t13_source_count: 8,
    pills: [
      { source_code: "BGAPMEA", label: "BGAPMEA #", value: "597", source_url: "https://bgapmea.org/" },
      { source_code: "BGMEA", label: "BGMEA General member #", value: "3498", source_url: "https://www.bgmea.com.bd/member/71" },
      { source_code: "BKMEA", label: "BKMEA #", value: "625 - B/2002", source_url: "https://www.bkmea.com/" },
      { source_code: "EPB", label: "EPB Reg #", value: "BD04293", source_url: "https://edb.epb.gov.bd/exporter/3335/aboni-knitwear-ltd" },
      { source_code: "GOTS", label: "GOTS Cert #", value: "GOTS-27605", source_url: "https://www.global-trace-base.org/SCO029726/certificate-document" },
      { source_code: "GOTS", label: "GOTS Cert #", value: "GOTS-31587", source_url: "https://www.global-trace-base.org/SCO039488/certificate-document" },
      {
        source_code: "OEKO_TEX",
        label: "OEKO_TEX Cert #",
        value: "32597-100",
        source_url: "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/32597~1wdFVs~O_k6dxb3kavK9_H_E7YoN0nL2CE/",
      },
      { source_code: "RSC", label: "RSC ID", value: "9342", source_url: "https://www.rsc-bd.org/" },
      { source_code: "WRAP", label: "WRAP Cert #", value: "7865", source_url: "https://wrapcompliance.org/certified-facility/7865/" },
      { source_code: "RSC", label: "RSC ID", value: "23602", source_url: "https://www.rsc-bd.org/", building_name: ABONI_NEW_SHED },
    ],
    certifications: [
      {
        kind: "gots",
        certificate_no: "GOTS-31587",
        issuer: "TÜV Rheinland (China) Ltd.",
        issued_on: null,
        expires_on: "2027-05-12",
        scope:
          "Operations: Dyeing, Embroidery, embellishment, Finishing, Knitting, Manufacturing, Packing, Pre-treatment , Printing, Washing, laundering | Products: Men's apparel",
        document_url: "https://www.global-trace-base.org/SCO039488/certificate-document",
      },
      {
        kind: "gots",
        certificate_no: "GOTS-27605",
        issuer: "GSCS International Ltd.",
        issued_on: null,
        expires_on: "2026-04-04",
        scope:
          "Operations: Dyeing, Embroidery, embellishment, Finishing, Knitting, Manufacturing, Packing, Pre-treatment , Printing, Warehousing, distribution of non-final products, Washing, laundering | Products: Babies' apparel, Children's apparel, Children's denim apparel, Dyed fabrics, Greige fabrics, Men's apparel, Men's denim apparel, Unisex apparel, Unisex denim apparel, Women's apparel, Women's denim apparel, Worn accessories",
        document_url: "https://www.global-trace-base.org/SCO029726/certificate-document",
      },
      {
        kind: "oeko_tex",
        certificate_no: "32597-100",
        issuer: "OEKO-TEX",
        issued_on: null,
        expires_on: null,
        scope: "OEKO-TEX STANDARD 100",
        document_url: "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/32597~1wdFVs~O_k6dxb3kavK9_H_E7YoN0nL2CE/",
      },
      {
        kind: "wrap",
        certificate_no: "7865",
        issuer: "WRAP",
        issued_on: null,
        expires_on: "2026-09-29",
        scope: "Gold | Industries: Apparel | Products: Knitted Garments",
        document_url: "https://wrapcompliance.org/certified-facility/7865/",
      },
    ],
    rsc_remediation: [
      {
        progress_pct: 100,
        workers_count: 2662,
        remediation_status: "initialcompleted",
        training_status: "completed",
        fetched_at: "2026-07-30T22:13:36.187121+00:00",
        fire_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/12868.pdf",
        structural_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/21587.pdf",
        electrical_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/13284.pdf",
        boiler_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/340274.pdf",
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=9342",
      },
      {
        building_name: ABONI_NEW_SHED,
        progress_pct: 100,
        workers_count: 504,
        remediation_status: "initialcompleted",
        training_status: "completed",
        fetched_at: "2026-07-30T22:13:40.757784+00:00",
        fire_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/196749.pdf",
        structural_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/197684.pdf",
        electrical_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/212312.pdf",
        boiler_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/340217.pdf",
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=23602",
      },
    ],
    brand_attributions: [
      { source_code: "BRAND_ASOS", display_name: "ASOS supplier list", source_url: ASOS_LIST, last_seen_at: "2026-07-30T21:27:35.655595+00:00" },
      { source_code: "BRAND_HM", display_name: "H&M Group supplier list", source_url: HM_LIST, last_seen_at: "2026-06-26T23:02:29.477664+00:00" },
      { source_code: "BRAND_NEXT", display_name: "Next plc supplier list", source_url: NEXT_LIST, last_seen_at: "2026-05-18T22:44:33.591105+00:00" },
    ],
    provenance: [
      { source_code: "EPB", display_name: "Export Promotion Bureau", tier: "tier1_gov", source_ref: "3335", source_url: "https://epb.gov.bd", last_seen_at: "2026-08-14T21:58:33.681609+00:00" },
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "9342", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:17:33.22837+00:00" },
      { source_code: "BGAPMEA", display_name: "Bangladesh Garment Accessories & Packaging MEA", tier: "tier2_industry", source_ref: "90", source_url: "https://bgapmea.org", last_seen_at: "2026-06-26T23:24:31.412898+00:00" },
      { source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "general:3498", source_url: "https://www.bgmea.com.bd", last_seen_at: "2026-07-24T05:22:07.651889+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "619:detail", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T04:24:53.114376+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "625", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T03:03:52.197121+00:00" },
      { source_code: "GOTS", display_name: "Global Organic Textile Standard", tier: "tier3_cert", source_ref: "gots-SCO039488", source_url: "https://global-standard.org", last_seen_at: "2026-06-26T22:57:00.126799+00:00" },
      { source_code: "GOTS", display_name: "Global Organic Textile Standard", tier: "tier3_cert", source_ref: "gots-SCO029726", source_url: "https://global-standard.org", last_seen_at: "2026-06-26T22:56:55.664165+00:00" },
      { source_code: "OEKO_TEX", display_name: "OEKO-TEX", tier: "tier3_cert", source_ref: "oeko-tex-32597", source_url: "https://www.oeko-tex.com", last_seen_at: "2026-06-26T22:59:24.032164+00:00" },
      { source_code: "WRAP", display_name: "Worldwide Responsible Accredited Production", tier: "tier3_cert", source_ref: "wrap-7865", source_url: "https://wrapcompliance.org", last_seen_at: "2026-07-24T05:15:34.811285+00:00" },
      { source_code: "BRAND_ASOS", display_name: "ASOS supplier list", tier: "tier4_brand", source_ref: "b376ef6e0404ae78", source_url: ASOS_LIST, last_seen_at: "2026-07-30T21:27:35.655595+00:00" },
      { source_code: "BRAND_HM", display_name: "H&M Group supplier list", tier: "tier4_brand", source_ref: "aae431e7c9e0b1c9", source_url: HM_LIST, last_seen_at: "2026-06-26T23:02:29.477664+00:00" },
      { source_code: "BRAND_NEXT", display_name: "Next plc supplier list", tier: "tier4_brand", source_ref: "0c3207180f592be8", source_url: NEXT_LIST, last_seen_at: "2026-05-18T22:44:33.591105+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "Kandi Boilapur, Horindhara, Tetulzhora, Hemayetpur, Savar, Dhaka", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:24:31.412898+00:00" },
      { kind: "factory", address: "160-171, Tetulgora, Hemayetpur\nDhaka\nSavar", source_code: "BGMEA", fetched_at: "2026-07-24T05:22:07.651889+00:00" },
      { kind: "factory", address: "PLOT-169-171, UNION: TETULZHORA, HAMAYETPUR, SAVAR, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T03:03:52.197121+00:00" },
      { kind: "factory", address: "PLOT-169-171, UNION: TETULZHORA, HAMAYETPUR, SAVAR, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T04:24:53.114376+00:00" },
      {
        kind: "factory",
        address: "Plot- 169-171, 195-196, 200, Hamayetpur, Tetuljhora Union, Savar, Dhaka - 1340, Bangladesh",
        source_code: "OEKO_TEX",
        fetched_at: "2026-06-26T22:59:24.032164+00:00",
      },
      { kind: "mailing", address: "2-B/1, Darussalam Road,\nDhaka\nMirpur", source_code: "BGMEA", fetched_at: "2026-07-24T05:22:07.651889+00:00" },
      { kind: "mailing", address: "2B/1, DARUSSALAM ROAD, MIRPUR-1, MIRPUR, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T04:24:53.114376+00:00" },
      { kind: "mailing", address: "2B/1, DARUSSALAM ROAD, MIRPUR-1, MIRPUR, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T03:03:52.197121+00:00" },
      { kind: "registered", address: "2-B/1, Darussalam Road, Mirpur, Dhaka-1216", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:24:31.412898+00:00" },
    ],
  };
}

const ABONI_LINES: [string, string][] = [
  ["6102", "Woman's or girls' overcoats and similar articles, knitted or crocheted"],
  ["6103", "Men's or boys' suits, ensembles, etc, knitted or crocheted"],
  ["6104", "Women's or girls' suits, ensembles, etc, knitted or crocheted"],
  ["6105", "Men's or boys' shirts, knitted or crocheted"],
  ["6106", "Women's or girls' blouses, etc, knitted or crocheted"],
  ["6107", "Men's or boys' briefs and similar articles, knitted or crocheted"],
  ["6108", "Women's or girls' panties and similar articles, knitted or crocheted"],
  ["6109", "T-shirts, singlets and other vests, knitted or crocheted"],
  ["6110", "Jerseys, pullovers, cardigans and similar articles, knitted or crocheted"],
  ["6111", "Babies' garments and clothing accessories, knitted or crocheted"],
  ["6114", "Other garments, knitted or crocheted, nes"],
  ["6115", "Panty hose, tights, etc, and footwear, knitted or crocheted"],
];

const ABONI_URLS: Record<string, string> = {
  "6102": "769", "6103": "813", "6104": "814", "6105": "694", "6106": "695", "6107": "696",
  "6108": "697", "6109": "698", "6110": "699", "6111": "700", "6114": "778", "6115": "779",
};

export const ABONI_HS: HsLine[] = ABONI_LINES.map(([code, description]) => ({
  code,
  description,
  source_url: `https://edb.epb.gov.bd/hscode-exporters/${ABONI_URLS[code]}`,
}));

export function aboniInput(): RecordInput {
  // `production_workers_display_batch` returns the group figure: 2,662 (mother)
  // + 504 (New Shed) across both RSC sites, with the later of the two reads.
  return { profile: aboniProfile(), hscodes: ABONI_HS, workers: { value: 3166, source: "RSC", fetched_at: "2026-07-30T22:13:40.757784+00:00" }, today: TODAY };
}

// ---------------------------------------------------------------------------
// A.R. Fashion — the almost-empty record: one register, no number page, no
// certificate, no HS line, no address on file. A buying house, not a factory.
// ---------------------------------------------------------------------------

export function arFashionInput(): RecordInput {
  const profile = {
    supplier: {
      id: "61508d5d-845f-4638-aca2-63057d38236a",
      slug: "ar-fashion",
      company_name: "A.R. Fashion",
      entity_type: "buying_house",
      city: null,
      district: null,
      address_raw: null,
      is_sanctioned: false,
      parent_group_name: null,
      established_date: null,
      factory_types: [],
      principal_products: [],
      employees_total: null,
      machines_sewing: null,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: null,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: [],
    },
    t13_source_count: 1,
    // Production returns no source_url on this pill: the register published a number, not a page.
    pills: [{ source_code: "BGMEA", label: "BGMEA Associate member #", value: "330", source_url: null }],
    certifications: [],
    rsc_remediation: null,
    brand_attributions: [],
    provenance: [
      {
        source_code: "BGMEA",
        display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.",
        tier: "tier2_industry",
        source_ref: "330",
        source_url: "https://www.bgmea.com.bd",
        last_seen_at: "2026-07-30T23:21:02.933692+00:00",
      },
    ],
    addresses: [
      {
        kind: "registered",
        address: "Fazlur Rahman Center (5th Floor) 72,, Dilkusha, DT Road, Motijheel, Dhaka",
        source_code: "BGMEA",
        fetched_at: "2026-07-30T23:21:02.933692+00:00",
      },
    ],
  } as ProfilePayload;
  return { profile, hscodes: [], workers: null, today: TODAY };
}

// ---------------------------------------------------------------------------
// Zaheen Knitwears — the 100-character name, one source, an RSC row behind
// schedule. Not sanctioned on production; the gallery renders it as a labelled
// sanctioned SAMPLE.
// ---------------------------------------------------------------------------

export function zaheenSampleInput(): RecordInput & { leaked: { email_primary: string; phones: string[] } } {
  const profile = {
    supplier: {
      id: "e4669f72-a97a-40e4-9e6e-11df37d2e96e",
      slug: "zaheen-knitwear-limited-shed-3-4-5-10-11-12-13-and-building-security-etp-and-fire-pump",
      company_name: ZAHEEN_NAME,
      entity_type: "factory",
      city: "Narayanganj",
      district: "Narayanganj",
      address_raw: null,
      is_sanctioned: false,
      parent_group_name: null,
      established_date: null,
      factory_types: [],
      principal_products: [],
      employees_total: 1634,
      machines_sewing: null,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: null,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["RSC"],
      // Never returned by the RPC to a buyer; present here only to be proven absent from the HTML.
      email_primary: "leak-test@example.invalid",
      phones: ["+880 1700 000000"],
    },
    t13_source_count: 1,
    pills: [{ source_code: "RSC", label: "RSC ID", value: "24449", source_url: "https://www.rsc-bd.org/" }],
    certifications: [],
    rsc_remediation: [
      {
        progress_pct: 75,
        workers_count: 1634,
        remediation_status: "behindschedule",
        training_status: "yet to start",
        fetched_at: "2026-08-07T05:56:42.605291+00:00",
        fire_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/285883.pdf",
        structural_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/285160.pdf",
        electrical_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/283733.pdf",
        boiler_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/397187.pdf",
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=24449",
      },
    ],
    brand_attributions: [],
    provenance: [
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "24449", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:47:07.954625+00:00" },
    ],
    addresses: [],
  } as unknown as ProfilePayload;
  return {
    profile,
    hscodes: [],
    workers: { value: 1634, source: "RSC", fetched_at: "2026-08-07T05:56:42.605291+00:00" },
    today: TODAY,
    sanctionSample: true,
    leaked: { email_primary: "leak-test@example.invalid", phones: ["+880 1700 000000"] },
  };
}

/** The same record with production's own sanction flag set, for the states no sample flag can prove. */
export function sanctionedInput(): RecordInput {
  const base = zaheenSampleInput();
  return {
    ...base,
    profile: { ...base.profile, supplier: { ...base.profile.supplier, is_sanctioned: true } },
    sanctionSample: undefined,
  };
}

// ---------------------------------------------------------------------------
// S M Knitwears — two EPB registrations, six certificates (four of them
// OEKO-TEX), 24 HS lines across chapters 61 and 62, and an RSC row that
// belongs to a building, not to the company itself. Re-read from production
// 19 Sep 2026; the earlier copy of this fixture was short by two pills, two
// certificates, four provenance rows and seven addresses, and carried two
// OEKO-TEX profile URLs that do not exist.
// ---------------------------------------------------------------------------

const SM_LINES: [string, string, string][] = [
  ["6101", "Men's or boys' overcoats... and similar articles, knitted or crocheted", "846"],
  ["6102", "Woman's or girls' overcoats and similar articles, knitted or crocheted", "769"],
  ["6103", "Men's or boys' suits, ensembles, etc, knitted or crocheted", "813"],
  ["6104", "Women's or girls' suits, ensembles, etc, knitted or crocheted", "814"],
  ["6105", "Men's or boys' shirts, knitted or crocheted", "694"],
  ["6106", "Women's or girls' blouses, etc, knitted or crocheted", "695"],
  ["6107", "Men's or boys' briefs and similar articles, knitted or crocheted", "696"],
  ["6108", "Women's or girls' panties and similar articles, knitted or crocheted", "697"],
  ["6109", "T-shirts, singlets and other vests, knitted or crocheted", "698"],
  ["6110", "Jerseys, pullovers, cardigans and similar articles, knitted or crocheted", "699"],
  ["6111", "Babies' garments and clothing accessories, knitted or crocheted", "700"],
  ["6112", "Track-suits, ski-suits and swimwear, knitted or crocheted", "776"],
  ["6114", "Other garments, knitted or crocheted, nes", "778"],
  ["6115", "Panty hose, tights, etc, and footwear, knitted or crocheted", "779"],
  ["6117", "Other made up clothing or parts of garments, knitted or crocheted", "781"],
  ["6201", "Men's or boys' overcoats, and similar articles", "782"],
  ["6202", "Woman's or girls' overcoats, and similar articles", "783"],
  ["6203", "Men's or boys' suits, ensembles, jackets, blazers, trousers, etc", "784"],
  ["6204", "Women's or girls' suits, ensembles, jackets, dresses, skirts, etc", "785"],
  ["6205", "Men's or boys' shirts", "786"],
  ["6206", "Women's or girls' blouses, shirts and shirt-blouses", "787"],
  ["6207", "Men's or boys' underpants, briefs, nightshirts, pyjamas, etc", "788"],
  ["6208", "Women's or girls' slips, petticoats, nightdresses, pyjamas, etc", "789"],
  ["6209", "Bables' garments and clothing accessories", "790"],
];

export const SM_HS: HsLine[] = SM_LINES.map(([code, description, ref]) => ({
  code,
  description,
  source_url: `https://edb.epb.gov.bd/hscode-exporters/${ref}`,
}));

const OEKO_PROFILE = "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile";
const SM_OEKO_100 = `${OEKO_PROFILE}/9741~1wdI2V~Gc5OsM1AI-9iRdEvDZMRbc_8T2o/`;
const SM_OEKO_MIG = `${OEKO_PROFILE}/9741~1wdJ30~0zOmRMa0vLmWt5szv_SPcXWqjS8/`;
const SM_OEKO_ORGANIC = `${OEKO_PROFILE}/9741~1wdJ9J~Ksz0Rv6pcvUMkowB-S4SQ0iKJ8Q/`;
const SM_OEKO_STEP = `${OEKO_PROFILE}/9741~1wdIu4~GVy9ryLmhCJyFXIcyGxS6EZ-Ti8/`;
const ACCORD_FILE = "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files";

/** The building names the payloads carry, exported so a test cannot misspell one into passing. */
export const SM_EXTENSION = "S M Knitwears Limited. (Extension)";

export function smKnitwearProfile(): ProfilePayload {
  return {
    supplier: {
      id: "c07aca81-045c-4f7e-8812-2c19e512b5df",
      slug: "sm-knitwear",
      company_name: "S M KNITWEARS LIMITED",
      entity_type: "factory",
      city: "Gazipur",
      district: "Gazipur",
      address_raw: "SHIRIRCHALA, BHABANIPUR, GAZIPUR SADAR, SADAR, GAZIPUR",
      is_sanctioned: false,
      parent_group_name: "SM Group",
      established_date: "2001-01-01",
      factory_types: ["Dyeing", "Knit", "Packaging"],
      principal_products: [
        "All Kind of Knit Item", "Babies` apparel", "Band Roll", "Care Label", "Children`s apparel",
        "Croset", "Dyed fabrics", "Gum Tape", "Hand Tape", "Hit Transfer", "Hoddy Jacket",
        "Jacard Elastic", "Knitted Garments", "Legging", "Men`s apparel", "Night Wear",
        "Offset Printing", "Paper Carton Board", "Photo Box", "Photo Card", "Photo Print",
        "POLO SHIRT", "Polo Shirts", "Poly Bag", "Price Tag", "Print Label", "Pyjama",
        "Sewing Thread", "Shorts", "T-Shirt", "T-Shirts", "Tank Top", "Tape", "Twill Tape",
        "Unisex apparel", "Women`s apparel", "Woven Label",
      ],
      employees_total: 300,
      machines_sewing: 97,
      production_capacity_pcs_day: 11000,
      production_capacity_dozen_yearly: 4000000,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGAPMEA", "BGMEA", "EPB", "BRAND_ASOS", "WRAP", "GOTS", "BRAND_NEXT", "BKMEA", "RSC", "OEKO_TEX"],
    },
    t13_source_count: 8,
    pills: [
      { source_code: "BGAPMEA", label: "BGAPMEA #", value: "1838", source_url: "https://bgapmea.org/" },
      { source_code: "BGMEA", label: "BGMEA General member #", value: "3532", source_url: "https://www.bgmea.com.bd/member/3603" },
      { source_code: "BKMEA", label: "BKMEA #", value: "1092 - B/2009", source_url: "https://www.bkmea.com/" },
      { source_code: "EPB", label: "EPB Reg #", value: "BD04237", source_url: "https://edb.epb.gov.bd/exporter/1000/sm-knitwears-limited" },
      { source_code: "EPB", label: "EPB Reg #", value: "BD05278", source_url: "https://edb.epb.gov.bd/exporter/3660/sm-knit-wear" },
      { source_code: "GOTS", label: "GOTS Cert #", value: "GOTS-28946", source_url: "https://www.global-trace-base.org/SCO031435/certificate-document" },
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "9741-100", source_url: SM_OEKO_100 },
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "9741-mig", source_url: SM_OEKO_MIG },
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "9741-organic-cotton", source_url: SM_OEKO_ORGANIC },
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "9741-step", source_url: SM_OEKO_STEP },
      { source_code: "RSC", label: "RSC ID", value: "10902", source_url: "https://www.rsc-bd.org/" },
      { source_code: "WRAP", label: "WRAP Cert #", value: "124992", source_url: "https://wrapcompliance.org/certified-facility/124992/" },
      { source_code: "RSC", label: "RSC ID", value: "24545", source_url: "https://www.rsc-bd.org/", building_name: SM_EXTENSION },
    ],
    certifications: [
      {
        kind: "gots",
        certificate_no: "GOTS-28946",
        issuer: "USB Certification Denetim Gözetim ve Belgelendirme Hizmetleri A.Ş.",
        issued_on: null,
        expires_on: "2027-05-24",
        scope:
          "Operations: Dyeing, Embroidery, embellishment, Finishing, Knitting, Manufacturing, Packing, Pre-treatment , Printing, Washing, laundering | Products: Babies` apparel, Children`s apparel, Dyed fabrics, Men`s apparel, Unisex apparel, Women`s apparel",
        document_url: "https://www.global-trace-base.org/SCO031435/certificate-document",
      },
      { kind: "oeko_tex", certificate_no: "9741-mig", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX MADE IN GREEN", document_url: SM_OEKO_MIG },
      { kind: "oeko_tex", certificate_no: "9741-step", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX STeP", document_url: SM_OEKO_STEP },
      { kind: "oeko_tex", certificate_no: "9741-organic-cotton", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX ORGANIC COTTON", document_url: SM_OEKO_ORGANIC },
      { kind: "oeko_tex", certificate_no: "9741-100", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX STANDARD 100", document_url: SM_OEKO_100 },
      {
        kind: "wrap",
        certificate_no: "124992",
        issuer: "WRAP",
        issued_on: null,
        expires_on: "2026-07-21",
        scope: "Gold | Industries: Apparel | Products: Knitted Garments",
        document_url: "https://wrapcompliance.org/certified-facility/124992/",
      },
    ],
    // Production returns exactly one row, and it belongs to a building — not to the company.
    rsc_remediation: [
      {
        building_name: SM_EXTENSION,
        progress_pct: 53,
        workers_count: 907,
        remediation_status: "behindschedule",
        training_status: "yet to start",
        fetched_at: "2026-09-11T05:42:11.689462+00:00",
        fire_inspection_url: `${ACCORD_FILE}/318263.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/319770.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/320253.pdf`,
        boiler_inspection_url: `${ACCORD_FILE}/394192.pdf`,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=24545",
      },
    ],
    brand_attributions: [
      { source_code: "BRAND_ASOS", display_name: "ASOS supplier list", source_url: ASOS_LIST, last_seen_at: "2026-07-30T21:30:12.583394+00:00" },
      { source_code: "BRAND_NEXT", display_name: "Next plc supplier list", source_url: NEXT_LIST, last_seen_at: "2026-05-18T22:47:25.686932+00:00" },
    ],
    provenance: [
      { source_code: "EPB", display_name: "Export Promotion Bureau", tier: "tier1_gov", source_ref: "3660", source_url: "https://epb.gov.bd", last_seen_at: "2026-08-14T21:58:34.196427+00:00" },
      { source_code: "EPB", display_name: "Export Promotion Bureau", tier: "tier1_gov", source_ref: "1000", source_url: "https://epb.gov.bd", last_seen_at: "2026-08-14T21:58:27.826834+00:00" },
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "10902", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:42:11.108084+00:00" },
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "11557", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:40:11.988984+00:00" },
      { source_code: "BGAPMEA", display_name: "Bangladesh Garment Accessories & Packaging MEA", tier: "tier2_industry", source_ref: "1475", source_url: "https://bgapmea.org", last_seen_at: "2026-06-27T00:08:50.965602+00:00" },
      { source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "general:3532", source_url: "https://www.bgmea.com.bd", last_seen_at: "2026-07-24T08:31:15.197346+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "1088:detail", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T07:30:59.695104+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "2430:detail", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T06:16:28.212183+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "625:detail", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T04:24:23.083491+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "631", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T03:03:44.843323+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "1092", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T02:52:03.913142+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "1858", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T02:37:15.992235+00:00" },
      { source_code: "GOTS", display_name: "Global Organic Textile Standard", tier: "tier3_cert", source_ref: "gots-SCO031435", source_url: "https://global-standard.org", last_seen_at: "2026-06-26T23:43:58.851503+00:00" },
      { source_code: "OEKO_TEX", display_name: "OEKO-TEX", tier: "tier3_cert", source_ref: "oeko-tex-9741", source_url: "https://www.oeko-tex.com", last_seen_at: "2026-06-27T02:52:22.993559+00:00" },
      { source_code: "WRAP", display_name: "Worldwide Responsible Accredited Production", tier: "tier3_cert", source_ref: "wrap-124992", source_url: "https://wrapcompliance.org", last_seen_at: "2026-07-24T05:27:53.080573+00:00" },
      { source_code: "BRAND_ASOS", display_name: "ASOS supplier list", tier: "tier4_brand", source_ref: "288cf7788eeaacbc", source_url: ASOS_LIST, last_seen_at: "2026-07-30T21:30:12.583394+00:00" },
      { source_code: "BRAND_NEXT", display_name: "Next plc supplier list", tier: "tier4_brand", source_ref: "e79d762bb0cd7386", source_url: NEXT_LIST, last_seen_at: "2026-05-18T22:47:25.686932+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "7 No. Kewa, Shreepur, Gazipur", source_code: "BGAPMEA", fetched_at: "2026-06-27T00:08:50.965602+00:00" },
      { kind: "factory", address: "Shirirchala, Bhabanipur\nGazipur\nGazipur", source_code: "BGMEA", fetched_at: "2026-07-24T08:31:15.197346+00:00" },
      { kind: "factory", address: "SHIRIRCHALA, BHABANIPUR, GAZIPUR SADAR, SADAR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T03:03:44.843323+00:00" },
      { kind: "factory", address: "PLOT-A/107, BSCIC HOSIERY I/E, SHASONGAON, FATULLAH, NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T02:37:15.992235+00:00" },
      { kind: "factory", address: "SHIRIRCHALA, BHABANIPUR, GAZIPUR SADAR, SADAR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T04:24:23.083491+00:00" },
      { kind: "factory", address: "PLOT-A/107, BSCIC HOSIERY I/E, SHASONGAON, FATULLAH, NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T06:16:28.212183+00:00" },
      { kind: "factory", address: "PANCHABATI, , NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T07:30:59.695104+00:00" },
      { kind: "factory", address: "Shirirchala, Bhabanipur, Gazipur - 1740, Bangladesh", source_code: "OEKO_TEX", fetched_at: "2026-06-27T02:52:22.993559+00:00" },
      { kind: "mailing", address: "House-SE-04, Road-137, Gulshan-1\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T08:31:15.197346+00:00" },
      { kind: "mailing", address: "HOUSE-SE-4, ROAD-137, GULSHAN, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T04:24:23.083491+00:00" },
      { kind: "mailing", address: "PLOT-A/107, BSCIC HOSIERY I/E, SHASONGAON, FATULLAH, NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T06:16:28.212183+00:00" },
      { kind: "mailing", address: "PLOT-A/107, BSCIC HOSIERY I/E, SHASONGAON, FATULLAH, NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T02:37:15.992235+00:00" },
      { kind: "mailing", address: "HOUSE-SE-4, ROAD-137, GULSHAN, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T03:03:44.843323+00:00" },
      { kind: "mailing", address: "PANCHABATI, , NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T07:30:59.695104+00:00" },
      { kind: "registered", address: "House # SE-04, Road # 137, Gulshan-01, Dhaka-1212", source_code: "BGAPMEA", fetched_at: "2026-06-27T00:08:50.965602+00:00" },
    ],
  };
}

export function smKnitwearInput(): RecordInput {
  // `production_workers_display_batch` returns the Extension building's RSC
  // figure; the mother itself has no RSC row (1 of 2 sites — the builder says so).
  return {
    profile: smKnitwearProfile(),
    hscodes: SM_HS,
    workers: { value: 907, source: "RSC", fetched_at: "2026-09-11T05:42:11.689462+00:00" },
    today: TODAY,
  };
}

// ---------------------------------------------------------------------------
// A satellite carrying its parent factory's registrations.
//
// `v_supplier_registry_ids` unions a published parent's pills onto a published
// satellite, suffixes the label " (parent factory)" and sets `inherited_from`
// (RSC excluded). No published record matches today — every satellite the join
// finds is still unpublished, so the union returns 0 rows on 19 Sep 2026 — but
// `buyer_supplier_profile` will serve those pills the day one is published, and
// the kit must never print another company's register number as this record's
// own. The rows below are the real AB Apparels pair: the satellite's own RSC
// pill, plus the parent's five direct pills exactly as the view composes them.
// ---------------------------------------------------------------------------

const AB_PARENT_ID = "031f12df-4718-4ae8-bdde-eb7ddb13ed25";
const AB_PARENT_NAME = "AB APPARELS LTD";

const AB_INHERITED: ProfilePill[] = [
  { source_code: "BGMEA", label: "BGMEA General member # (parent factory)", value: "6077", source_url: "https://www.bgmea.com.bd/member/54", inherited_from: AB_PARENT_ID, inherited_from_name: AB_PARENT_NAME },
  { source_code: "EPB", label: "EPB Reg # (parent factory)", value: "BD05954", source_url: "https://edb.epb.gov.bd/exporter/313/ab-apparels-ltd", inherited_from: AB_PARENT_ID, inherited_from_name: AB_PARENT_NAME },
  { source_code: "GOTS", label: "GOTS Cert # (parent factory)", value: "GOTS-28029", source_url: "https://www.global-trace-base.org/SCO030289/certificate-document", inherited_from: AB_PARENT_ID, inherited_from_name: AB_PARENT_NAME },
  { source_code: "OEKO_TEX", label: "OEKO_TEX Cert # (parent factory)", value: "37940-100", source_url: `${OEKO_PROFILE}/37940~1wdFS1~ZJtEexz6qelegSJxNT3xwxzaLi4/`, inherited_from: AB_PARENT_ID, inherited_from_name: AB_PARENT_NAME },
  { source_code: "OEKO_TEX", label: "OEKO_TEX Cert # (parent factory)", value: "37940-step", source_url: `${OEKO_PROFILE}/37940~1wdIgO~JKpnIVYTB-a5H9KfXELKkiXTrQQ/`, inherited_from: AB_PARENT_ID, inherited_from_name: AB_PARENT_NAME },
];

export function inheritedPillsInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "3d64d325-29a1-4352-8675-5619a277dcaa",
      slug: "ab-apparels-ltd-extension",
      company_name: "AB APPARELS LTD (extension)",
      entity_type: "factory",
      city: "Dhaka",
      district: "Dhaka",
      address_raw: null,
      is_sanctioned: false,
      parent_group_name: null,
      established_date: null,
      factory_types: [],
      principal_products: [],
      employees_total: 651,
      machines_sewing: null,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: null,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["RSC"],
    },
    t13_source_count: 1,
    // Own first, then the parent's — the order the view's UNION ALL produces.
    pills: [{ source_code: "RSC", label: "RSC ID", value: "25817", source_url: "https://www.rsc-bd.org/" }, ...AB_INHERITED],
    certifications: [],
    rsc_remediation: null,
    brand_attributions: [],
    provenance: [
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "25817", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:31:44.000000+00:00" },
    ],
    addresses: [],
  };
  return { profile, hscodes: [], workers: { value: 651, source: "registry", fetched_at: null }, today: TODAY };
}

// ---------------------------------------------------------------------------
// A mother whose building holds registrations and a certificate of its own.
//
// `buyer_supplier_profile` unions a `facility_of` child's pills and
// certificates onto the mother, labelled `building_name`. Hossain Dyeing &
// Printing Mills (published) carries one OEKO-TEX pill and certificate of its
// own; its UNIT-2 building carries a BKMEA registration and a GOTS
// certificate. Read from production 19 Sep 2026.
//
// The kit must not count the building's rows as the record's — and must not
// print the bare negative "not in BGMEA, BKMEA, …" over a payload that carries
// a BKMEA registration, even a building's.
// ---------------------------------------------------------------------------

export const HOSSAIN_BUILDING = "HOSSAIN DYEING & PRINTING MILLS LTD. (UNIT-2)";
const HOSSAIN_OEKO = `${OEKO_PROFILE}/13350~1wdGeD~-g80hYqmxAGBrqTTLKQTcbWCm8w/`;
const HOSSAIN_GOTS = "https://www.global-trace-base.org/SCO000060/certificate-document";

export function buildingRegistrationsInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "4543927f-de94-47b1-a6be-9009302737ef",
      slug: "hossain-dyeing-and-printing-mills",
      company_name: "Hossain Dyeing & Printing Mills Ltd.",
      entity_type: "factory",
      city: "Gazipur",
      district: "Gazipur",
      address_raw: "Bangladesh\nGazipur - 1710",
      is_sanctioned: false,
      parent_group_name: null,
      established_date: null,
      factory_types: [],
      principal_products: [],
      employees_total: null,
      machines_sewing: null,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: null,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["OEKO_TEX"],
    },
    t13_source_count: 1,
    pills: [
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "13350-100", source_url: HOSSAIN_OEKO },
      { source_code: "BKMEA", label: "BKMEA #", value: "2451 - B/2023", source_url: "https://www.bkmea.com/", building_name: HOSSAIN_BUILDING },
      { source_code: "GOTS", label: "GOTS Cert #", value: "GOTS-15431", source_url: HOSSAIN_GOTS, building_name: HOSSAIN_BUILDING },
    ],
    certifications: [
      { kind: "oeko_tex", certificate_no: "13350-100", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX STANDARD 100", document_url: HOSSAIN_OEKO },
      {
        kind: "gots",
        certificate_no: "GOTS-15431",
        issuer: "CERES-CERT AG",
        issued_on: null,
        expires_on: "2026-11-15",
        scope: "Operations: Dyeing, Finishing, Manufacturing, Pre-treatment , Preparatory , Printing, Weaving | Products: Dyed fabrics, Dyed yarns, Home textiles, Printed fabrics, Undyed fabrics",
        document_url: HOSSAIN_GOTS,
        building_name: HOSSAIN_BUILDING,
      },
    ],
    rsc_remediation: null,
    brand_attributions: [],
    provenance: [
      { source_code: "OEKO_TEX", display_name: "OEKO-TEX", tier: "tier3_cert", source_ref: "oeko-tex-13350", source_url: "https://www.oeko-tex.com", last_seen_at: "2026-06-27T00:12:00.470443+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "Pathanpara, Pagar, Tongi, Gazipur - 1710, Bangladesh", source_code: "OEKO_TEX", fetched_at: "2026-06-27T00:12:00.470443+00:00" },
    ],
  };
  // The mother files no headcount; `production_workers_display_batch` returns
  // 1,784, which is UNIT-2's registry figure. The payload carries no RSC row,
  // so the kit cannot enumerate the sites behind that number.
  return { profile, hscodes: [], workers: { value: 1784, source: "registry", fetched_at: null }, today: TODAY };
}

// ---------------------------------------------------------------------------
// The two "largest list" records the rebuild spec §3 names, so the screens are
// exercised at the scale the database really reaches (§6 asks for both).
// Trimmed to the fields those lists touch; read from production 19 Sep 2026.
// ---------------------------------------------------------------------------

/** 54 EPB export codes — the most on any record (`plummy-fashions`, published). */
const PLUMMY_CODES = [
  "5208", "5513", "5905", "6001", "6002", "6003", "6004", "6005", "6006", "6101",
  "6102", "6103", "6104", "6105", "6106", "6107", "6108", "6109", "6110", "6111",
  "6112", "6113", "6114", "6115", "6116", "6117", "6201", "6202", "6203", "6204",
  "6205", "6206", "6207", "6208", "6209", "6210", "6211", "6212", "6213", "6214",
  "6215", "6216", "6217", "6301", "6302", "6303", "6304", "6305", "6306", "6307",
  "6308", "6309", "6310", "6505",
];

export const PLUMMY_HS: HsLine[] = PLUMMY_CODES.map((code) => ({ code, description: null, source_url: null }));

export function longestHsListInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "7f5d2dcd-118a-4d29-ad6b-76d59ab674b9",
      slug: "plummy-fashions",
      company_name: "PLUMMY FASHIONS LTD",
      entity_type: "factory",
      city: "Narayanganj",
      district: "Narayanganj",
      address_raw: "NORTH NORSHINGPUR, KASHIPUR, FATULLAH, NARAYANGANJ., FATULLAH, NARAYANGANJ",
      is_sanctioned: false,
      parent_group_name: null,
      established_date: "2021-12-08",
      factory_types: ["Knit"],
      principal_products: ["(B)", "Knit", "Polo Shirt", "T-Shirt"],
      employees_total: 350,
      machines_sewing: 794,
      production_capacity_pcs_day: 8000,
      production_capacity_dozen_yearly: 1260000,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGMEA", "EPB", "RSC", "BKMEA"],
    },
    t13_source_count: 4,
    pills: [
      { source_code: "BGMEA", label: "BGMEA General member #", value: "6663", source_url: "https://www.bgmea.com.bd/member/4457" },
      { source_code: "BKMEA", label: "BKMEA #", value: "1527 - A/2009", source_url: "https://www.bkmea.com/" },
      { source_code: "EPB", label: "EPB Reg #", value: "BD05884", source_url: "https://edb.epb.gov.bd/exporter/831/plummy-fashions-ltd" },
      { source_code: "RSC", label: "RSC ID", value: "12348", source_url: "https://www.rsc-bd.org/" },
    ],
    certifications: [],
    rsc_remediation: [
      {
        progress_pct: 100,
        workers_count: 800,
        remediation_status: "initialcompleted",
        training_status: "completed",
        fetched_at: "2026-07-24T06:51:47.037077+00:00",
        fire_inspection_url: `${ACCORD_FILE}/32141.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/31337.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/29884.pdf`,
        boiler_inspection_url: `${ACCORD_FILE}/378175.pdf`,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=12348",
      },
    ],
    brand_attributions: [],
    provenance: [
      { source_code: "EPB", display_name: "Export Promotion Bureau", tier: "tier1_gov", source_ref: "831", source_url: "https://epb.gov.bd", last_seen_at: "2026-07-30T21:57:58.78113+00:00" },
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "12348", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:38:17.752074+00:00" },
      { source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "general:6663", source_url: "https://www.bgmea.com.bd", last_seen_at: "2026-07-24T07:56:56.676718+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "1504:detail", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T06:47:40.327943+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "1527", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T02:42:46.59435+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "North Narshingpur, Kashipur,Fatullah\nNarayangonj\nNarayangonj", source_code: "BGMEA", fetched_at: "2026-07-24T07:56:56.676718+00:00" },
      { kind: "factory", address: "NORTH NORSHINGPUR, KASHIPUR, FATULLAH, NARAYANGANJ., FATULLAH, NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T02:42:46.59435+00:00" },
      { kind: "factory", address: "NORTH NORSHINGPUR, KASHIPUR, FATULLAH, NARAYANGANJ., FATULLAH, NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T06:47:40.327943+00:00" },
      { kind: "factory", address: "North Narshingpur, Kashipur, Fatullah, Narayanganj", source_code: "EPB", fetched_at: "2026-07-30T21:57:58.78113+00:00" },
      { kind: "mailing", address: "Unit # 502, Concord Tower, 113 Kazi Nazrul Islam Avenue, Banglamotor\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T07:56:56.676718+00:00" },
      { kind: "mailing", address: "NORTH NORSHINGPUR, KASHIPUR, FATULLAH, NARAYANGANJ., , NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T02:42:46.59435+00:00" },
      { kind: "mailing", address: "NORTH NORSHINGPUR, KASHIPUR, FATULLAH, NARAYANGANJ., , NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T06:47:40.327943+00:00" },
      { kind: "registered", address: "North Narshingpur, Kashipur, Fatullah, Narayanganj", source_code: "EPB", fetched_at: "2026-07-30T21:57:58.78113+00:00" },
    ],
  };
  return { profile, hscodes: PLUMMY_HS, workers: { value: 800, source: "RSC", fetched_at: "2026-07-24T06:51:47.037077+00:00" }, today: TODAY };
}

/** 39 principal products — the longest list on any record (`adventure-garments`, published). */
const ADVENTURE_PRODUCTS = [
  "All kind of Jackets", "All kind of Pans / Trousers", "All kind of Shirts /Tops", "All Kinds of Jackets",
  "All Kinds of Pants/Trousers", "All Kinds of Shirts / Tops", "All Types of Jackets", "All Types Of Jackets",
  "All Types of Pant / Trousers", "All Types of Pants / Trousers", "All Types Of Pants/Trouser",
  "All Types of Pants/Trousers", "All Types Of Pants/Trousers", "All Types of Shirts / Tops",
  "All types Of Shirts/Tops", "All Types of Shirts/Tops", "All Types Of Shirts/Tops", "AllTypes of Jackets",
  "AllTypes of Pants/Trousers", "AllTypes of Shirts/Tops", "Children Wears", "Hand Gloves", "Hand Sanitizer",
  "Jacket", "Jackets", "Ladies Shirts", "Mask", "Pant", "Pants", "Polo shirt", "Polo Shirt", "PPE",
  "SAll Types of Shirts/Tops", "Shirt", "Shirts", "T-Shirt", "Tops", "Trouser", "Trousers",
];

export function longestProductListInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "e96d742a-11b3-4533-9620-febb36eb6d69",
      slug: "adventure-garments",
      company_name: "Adventure Garments Ltd.",
      entity_type: "factory",
      city: "Gazipur",
      district: "Gazipur",
      address_raw: "Holding # 315, Beximco Industrial Park, Sarabo, Kashimpur\nGazipur\nGazipur",
      is_sanctioned: false,
      parent_group_name: null,
      established_date: "2020-01-04",
      factory_types: ["Knit", "Woven"],
      principal_products: ADVENTURE_PRODUCTS,
      employees_total: 610,
      machines_sewing: 197,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: 9750000,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGMEA"],
    },
    t13_source_count: 1,
    pills: [{ source_code: "BGMEA", label: "BGMEA General member #", value: "6637", source_url: "https://www.bgmea.com.bd/member/4395" }],
    certifications: [],
    rsc_remediation: null,
    brand_attributions: [],
    provenance: [
      { source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "general:6637", source_url: "https://www.bgmea.com.bd", last_seen_at: "2026-07-24T05:23:45.785433+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "Sarabo, Kashimpur\nGazipur\nGazipur", source_code: "BGMEA", fetched_at: "2026-07-24T05:23:45.785433+00:00" },
      { kind: "mailing", address: "Beximco Industrial Park, Sarabo, Kashimpur\nGazipur\nGazipur", source_code: "BGMEA", fetched_at: "2026-07-24T05:23:45.785433+00:00" },
    ],
  };
  return { profile, hscodes: [], workers: { value: 610, source: "registry", fetched_at: null }, today: TODAY };
}

// ---------------------------------------------------------------------------
// A mother with NO certificate of its own whose building holds one.
//
// MG Niche Flair Ltd. (published) carries a BGMEA registration and nothing
// else; its Unit-2 building holds the OEKO-TEX certificate and pill. The kit
// must not count the building's certificate as the record's — and must not
// print the bare "none on 4 registers" over a payload that carries one.
// It is also an `unknown` entity_type, the third company type spec §5 names.
// Read from production 19 Sep 2026.
// ---------------------------------------------------------------------------

export const MG_BUILDING = "MG Niche Flair Limited Unit-2";
const MG_OEKO = `${OEKO_PROFILE}/31314~1wdHDf~CFdJb5GRJsYGA349sl67B9wplwE/`;

export function buildingOnlyCertificateInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "f755f286-512a-48d8-b4d8-e95404e70c79",
      slug: "mg-niche-flair",
      company_name: "MG Niche Flair Ltd.",
      entity_type: "unknown",
      city: null,
      district: null,
      address_raw: "House # 240, Bhuyan Para, Godnail, Siddirgonj\nNarayanganj\nNarayangonj",
      is_sanctioned: false,
      parent_group_name: null,
      established_date: "2012-02-06",
      factory_types: ["Knit"],
      principal_products: ["Lingeries", "Under Wears"],
      employees_total: 2350,
      machines_sewing: 600,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: 300000,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGMEA"],
    },
    t13_source_count: 1,
    pills: [
      { source_code: "BGMEA", label: "BGMEA General member #", value: "5429", source_url: "https://www.bgmea.com.bd/member/2383" },
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "31314-100", source_url: MG_OEKO, building_name: MG_BUILDING },
    ],
    certifications: [
      { kind: "oeko_tex", certificate_no: "31314-100", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX STANDARD 100", document_url: MG_OEKO, building_name: MG_BUILDING },
    ],
    rsc_remediation: null,
    brand_attributions: [],
    provenance: [
      { source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "general:5429", source_url: "https://www.bgmea.com.bd", last_seen_at: "2026-07-24T07:27:20.837018+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "House # 240, Bhuyan Para, Godnail, Siddirgonj\nNarayanganj\nNarayangonj", source_code: "BGMEA", fetched_at: "2026-07-24T07:27:20.837018+00:00" },
      { kind: "mailing", address: "Lotus Kamal Tower (10th Fl), 57, Joarshahara, Nikunja\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T07:27:20.837018+00:00" },
    ],
  };
  return { profile, hscodes: [], workers: { value: 2350, source: "registry", fetched_at: null }, today: TODAY };
}

// ---------------------------------------------------------------------------
// Several registrations at ONE register.
//
// Mahir Label & Accessories holds five BGAPMEA numbers (999, 1935, 1936, 1938,
// 1954) and nothing else — one of 279 published records with one register code
// and more than one number (BGMEA 112 · BGAPMEA 105 · BTMA 62, SQL 19 Sep 2026).
// Every one of its pill URLs is the agency's front door, so no mark may link.
// ---------------------------------------------------------------------------

export function oneRegisterManyNumbersInput(): RecordInput {
  const bgapmea = (value: string) => ({ source_code: "BGAPMEA", label: "BGAPMEA #", value, source_url: "https://bgapmea.org/" });
  const provenance = (ref: string, at: string) => ({
    source_code: "BGAPMEA",
    display_name: "Bangladesh Garment Accessories & Packaging MEA",
    tier: "tier2_industry",
    source_ref: ref,
    source_url: "https://bgapmea.org",
    last_seen_at: at,
  });
  const profile: ProfilePayload = {
    supplier: {
      id: "9967d91c-d854-4e25-8dea-78331d326fb6",
      slug: "mahir-label-and-accessories",
      company_name: "Mahir Label & Accessories Ltd",
      entity_type: "factory",
      city: "Khilkhet",
      district: "Dhaka",
      address_raw: "Ka-32/C/1, Kuratoly, Uttarpara, Khilkhet-1229, Dhaka",
      is_sanctioned: false,
      parent_group_name: null,
      established_date: null,
      factory_types: ["Packaging"],
      principal_products: [
        "Auto Carton", "back Board", "Back Board", "Barcode Sticker", "Canvas Tape", "Carton",
        "Crochet Elastic & Jacquard Elastic", "Drawstring", "Elastic", "Gum Tape", "Gum Tape etc",
        "Hang Tag", "Hanger", "Jacquard & Crochet Elastic", "Jacquard Elastic", "Lamination Foil Print",
        "Metal Button", "Neck Board", "Offset Prinitng", "Photo Inlay", "Plastic Button", "Poly Bag",
        "Price Tag", "Printed Label", "Rip Tape", "Scotch Tape", "Sewing Thread", "Shoe Box",
        "Size Tag", "Tissue Paper", "Twill", "Twill Tape", "Woven Label", "Zipper",
      ],
      employees_total: null,
      machines_sewing: null,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: null,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGAPMEA"],
    },
    t13_source_count: 1,
    pills: [bgapmea("1935"), bgapmea("1936"), bgapmea("1938"), bgapmea("1954"), bgapmea("999")],
    certifications: [],
    rsc_remediation: null,
    brand_attributions: [],
    provenance: [
      provenance("1574", "2026-06-27T00:13:29.147461+00:00"),
      provenance("1586", "2026-06-26T23:56:34.908736+00:00"),
      provenance("1596", "2026-06-26T23:55:14.888114+00:00"),
      provenance("489", "2026-06-26T23:53:50.158951+00:00"),
      provenance("1573", "2026-06-26T23:48:28.343378+00:00"),
    ],
    addresses: [
      { kind: "factory", address: "Barotopa, South Barotopa, Sreepur, Gazipur", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:56:34.908736+00:00" },
      { kind: "factory", address: "Ka-32/C/1, Kuratoly, Uttarpara, Khilkhet-1229, Dhaka", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:48:28.343378+00:00" },
      { kind: "factory", address: "Kewa Purba Khanda, Kewa Bazar, Sreepur, Gazipur-1740.", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:53:50.158951+00:00" },
      { kind: "factory", address: "Kewa Purba Khanda, Kewa Bazar, Sreepur, Gazipur", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:55:14.888114+00:00" },
      { kind: "factory", address: "Kapatia Para, Mawna, Sreepur, Gazipur", source_code: "BGAPMEA", fetched_at: "2026-06-27T00:13:29.147461+00:00" },
      { kind: "registered", address: "House # 102, (1st & 2nd floor), Lane-Northern, DOHS, Baridhara, Dhaka", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:56:34.908736+00:00" },
      { kind: "registered", address: "House # 102, Lane-Northern, DOHS, Baridhara, Dhaka", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:48:28.343378+00:00" },
      { kind: "registered", address: "House# 287 (4th Floor), Road # 04, DOHS Baridhara, Dhaka-1206", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:53:50.158951+00:00" },
      { kind: "registered", address: "House # 102 (1st & 2nd floor), Lane # Northern, DOHS, Baridhara, Dhaka-1206", source_code: "BGAPMEA", fetched_at: "2026-06-26T23:55:14.888114+00:00" },
      { kind: "registered", address: "House # 102 (1st & 2nd floor), Lane # Northern, DOHS, Baridhara, Dhaka-1206", source_code: "BGAPMEA", fetched_at: "2026-06-27T00:13:29.147461+00:00" },
    ],
  };
  return { profile, hscodes: [], workers: null, today: TODAY };
}

// ---------------------------------------------------------------------------
// A mother whose brand-list memberships all belong to its buildings.
//
// SQ Celsius Limited is on no disclosure list of its own; Unit 04 is on H&M's
// and M&S's, Unit 3 on H&M's, and Unit 04's M&S row appears twice. Eight
// published mothers carry brand rows that are entirely a building's. Its M&S
// URL is the shared OpenSupplyHub API listing of up to 50 Bangladesh
// facilities, which is not a page about this record. It also carries an RSC
// row of its own and one for each of the two buildings.
// Read from production 19 Sep 2026.
// ---------------------------------------------------------------------------

export const SQ_UNIT_04 = "SQ Celsius Limited (Unit 04)";
export const SQ_UNIT_3 = "SQ Celsius Ltd. (Unit 3)";
export const MS_LIST_API = "https://opensupplyhub.org/api/facilities/?contributors=10061&countries=BD&pageSize=50&embed=1&sort_by=name_asc";
const SQ_OEKO = `${OEKO_PROFILE}/62645~1wdI6N~tWlH8jeoJrEFp0RmZFgCGKckEt8/`;

export function buildingBrandListsInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "f0b7bbab-e559-4423-a17a-045b75c2669c",
      slug: "sq-celsius",
      company_name: "SQ Celsius Limited",
      entity_type: "factory",
      city: "Gazipur",
      district: "Dhaka",
      address_raw: "Beraiderchala, Keowa, Maona, Sreepur\nGazipur\nGazipur",
      is_sanctioned: false,
      parent_group_name: "SQ Group",
      established_date: "2014-03-18",
      factory_types: ["Dyeing", "Knit", "Sweater", "Woven"],
      principal_products: [
        "Babies' apparel",
        "Bra",
        "Cardigans",
        "Children's apparel",
        "Dyed fabrics",
        "Dyed yarns",
        "Greige fabrics",
        "Ladies Jacket",
        "Leggings",
        "Men's apparel",
        "Packet Shirt",
        "Penty",
        "Pullovers",
        "Sweaters",
        "T-Shirt",
        "Underwear",
        "Women's apparel",
      ],
      employees_total: 13986,
      machines_sewing: 5122,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: 1164375,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGMEA", "EPB", "WRAP", "GOTS", "RSC", "OEKO_TEX"],
    },
    t13_source_count: 6,
    pills: [
      { label: "BGMEA General member #", value: "3263", source_url: "https://www.bgmea.com.bd/member/3665", source_code: "BGMEA", inherited_from: null, inherited_from_name: null },
      { label: "EPB Reg #", value: "BD05085", source_url: "https://edb.epb.gov.bd/exporter/3469/sq-celsius-limited", source_code: "EPB", inherited_from: null, inherited_from_name: null },
      { label: "GOTS Cert #", value: "GOTS-29354", source_url: "https://www.global-trace-base.org/SCO029932/certificate-document", source_code: "GOTS", inherited_from: null, inherited_from_name: null },
      { label: "OEKO_TEX Cert #", value: "62645-100", source_url: SQ_OEKO, source_code: "OEKO_TEX", inherited_from: null, inherited_from_name: null },
      { label: "RSC ID", value: "9523", source_url: "https://www.rsc-bd.org/", source_code: "RSC", inherited_from: null, inherited_from_name: null },
      { label: "WRAP Cert #", value: "131732", source_url: "https://wrapcompliance.org/certified-facility/131732/", source_code: "WRAP", inherited_from: null, inherited_from_name: null },
      { label: "RSC ID", value: "26660", source_url: "https://www.rsc-bd.org/", source_code: "RSC", building_name: SQ_UNIT_04, inherited_from: null, inherited_from_name: null },
      { label: "RSC ID", value: "24741", source_url: "https://www.rsc-bd.org/", source_code: "RSC", building_name: SQ_UNIT_3, inherited_from: null, inherited_from_name: null },
    ],
    certifications: [
      {
        kind: "gots",
        certificate_no: "GOTS-29354",
        issuer: "GSCS International Ltd.",
        issued_on: null,
        expires_on: "2027-06-09",
        scope:
          "Operations: Dyeing, Embroidery, embellishment, Finishing, Knitting, Manufacturing, No processing, Packing, Pre-treatment , Preparatory , Printing, Washing, laundering | Products: Babies' apparel, Children's apparel, Dyed fabrics, Dyed yarns, Greige fabrics, Men's apparel, Women's apparel",
        document_url: "https://www.global-trace-base.org/SCO029932/certificate-document",
      },
      { kind: "oeko_tex", certificate_no: "62645-100", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX STANDARD 100", document_url: SQ_OEKO },
      {
        kind: "wrap",
        certificate_no: "131732",
        issuer: "WRAP",
        issued_on: null,
        expires_on: "2026-09-19",
        scope: "Gold | Industries: Apparel | Products: Sweaters",
        document_url: "https://wrapcompliance.org/certified-facility/131732/",
      },
    ],
    rsc_remediation: [
      {
        progress_pct: 100,
        workers_count: 3235,
        remediation_status: "initialcompleted",
        training_status: "completed",
        fetched_at: "2026-07-24T07:13:43.130038+00:00",
        fire_inspection_url: `${ACCORD_FILE}/3649.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/3789.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/7279.pdf`,
        boiler_inspection_url: `${ACCORD_FILE}/364171.pdf`,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=9523",
      },
      {
        building_name: SQ_UNIT_04,
        progress_pct: 69,
        workers_count: 425,
        remediation_status: "behindschedule",
        training_status: "yet to start",
        fetched_at: "2026-09-04T05:43:52.272089+00:00",
        fire_inspection_url: `${ACCORD_FILE}/399745.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/398914.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/398915.pdf`,
        boiler_inspection_url: null,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=26660",
      },
      {
        building_name: SQ_UNIT_3,
        progress_pct: 58,
        workers_count: 30,
        remediation_status: "behindschedule",
        training_status: "yet to start",
        fetched_at: "2026-07-24T07:13:53.883512+00:00",
        fire_inspection_url: `${ACCORD_FILE}/312589.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/312597.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/312598.pdf`,
        boiler_inspection_url: null,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=24741",
      },
    ],
    brand_attributions: [
      { source_code: "BRAND_HM", display_name: "H&M Group supplier list", source_url: HM_LIST, last_seen_at: "2026-06-26T23:11:09.295617+00:00", building_name: SQ_UNIT_04 },
      { source_code: "BRAND_MS", display_name: "Marks & Spencer supplier list", source_url: MS_LIST_API, last_seen_at: "2026-06-26T23:09:21.896908+00:00", building_name: SQ_UNIT_04 },
      { source_code: "BRAND_MS", display_name: "Marks & Spencer supplier list", source_url: MS_LIST_API, last_seen_at: "2026-06-26T23:09:18.649783+00:00", building_name: SQ_UNIT_04 },
      { source_code: "BRAND_HM", display_name: "H&M Group supplier list", source_url: HM_LIST, last_seen_at: "2026-06-26T23:11:12.558429+00:00", building_name: SQ_UNIT_3 },
    ],
    provenance: [
      { tier: "tier1_gov", source_code: "EPB", display_name: "Export Promotion Bureau", source_url: "https://epb.gov.bd", source_ref: "3469", last_seen_at: "2026-08-14T21:58:33.681609+00:00" },
      { tier: "tier1_gov", source_code: "RSC", display_name: "RMG Sustainability Council", source_url: "https://rsc-bd.org", source_ref: "9523", last_seen_at: "2026-09-18T05:43:02.999839+00:00" },
      { tier: "tier2_industry", source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", source_url: "https://www.bgmea.com.bd", source_ref: "general:3263", last_seen_at: "2026-07-24T08:35:01.119823+00:00" },
      { tier: "tier3_cert", source_code: "GOTS", display_name: "Global Organic Textile Standard", source_url: "https://global-standard.org", source_ref: "gots-SCO029932", last_seen_at: "2026-06-26T23:45:26.079138+00:00" },
      { tier: "tier3_cert", source_code: "OEKO_TEX", display_name: "OEKO-TEX", source_url: "https://www.oeko-tex.com", source_ref: "oeko-tex-62645", last_seen_at: "2026-06-27T01:47:34.47791+00:00" },
      { tier: "tier3_cert", source_code: "WRAP", display_name: "Worldwide Responsible Accredited Production", source_url: "https://wrapcompliance.org", source_ref: "wrap-131732", last_seen_at: "2026-07-24T05:40:01.176085+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "Beraiderchala, Keowa, Maona, Sreepur\nGazipur\nGazipur", source_code: "BGMEA", fetched_at: "2026-07-24T08:35:01.119823+00:00" },
      { kind: "factory", address: "Beraider Chala, Keowa, Maona, Sreepur, Gazipur - 1740, Bangladesh", source_code: "OEKO_TEX", fetched_at: "2026-06-27T01:47:34.47791+00:00" },
      { kind: "mailing", address: "Concord I-K Tower (4th Floor), Plot # 2, Block - CEN, (A) North Avenue, Gulshan-2\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T08:35:01.119823+00:00" },
    ],
  };
  // The batch reconciles: 3,235 (the company) + 425 (Unit 04) + 30 (Unit 3).
  return { profile, hscodes: [], workers: { value: 3690, source: "RSC", fetched_at: "2026-09-04T05:43:52.272089+00:00" }, today: TODAY };
}

// ---------------------------------------------------------------------------
// A record whose own brand rows repeat a list.
//
// Aman Graphics & Designs is on M&S's list twice — two OpenSupplyHub facility
// ids for one company — and on Next's once. Thirteen published mothers carry a
// repeated `source_code` this way; this is the only one where the repeat is on
// the company itself rather than a building, so the mark row must dedupe
// without the building fallback doing it for free.
// Read from production 19 Sep 2026.
// ---------------------------------------------------------------------------

const AMAN_OEKO = `${OEKO_PROFILE}/37789~1wdFZo~98m29J24K5G8YUkR-nDBwkGrc4s/`;
export const AMAN_EXTENSION = "Aman Graphics & Designs Ltd. (Extension)";

export function duplicateBrandRowsInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "c60c3e6e-ac7d-42e3-9d2b-4eb6d931c976",
      slug: "aman-graphics-and-designs",
      company_name: "Aman Graphics & Designs Ltd.",
      entity_type: "factory",
      city: "Dhaka",
      district: "Dhaka",
      address_raw: "Nazim Nagar, Hemayetpur\nDhaka\nSavar",
      is_sanctioned: false,
      parent_group_name: "Unifill Group",
      established_date: "2011",
      factory_types: ["Woven"],
      principal_products: ["Jackets", "Pants", "Shirts"],
      employees_total: 560,
      machines_sewing: 290,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: 180000,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGMEA", "EPB", "BRAND_MS", "BRAND_NEXT", "RSC", "OEKO_TEX"],
    },
    t13_source_count: 4,
    pills: [
      { label: "BGMEA General member #", value: "5201", source_url: "https://www.bgmea.com.bd/member/194", source_code: "BGMEA", inherited_from: null, inherited_from_name: null },
      { label: "EPB Reg #", value: "BD01848", source_url: "https://edb.epb.gov.bd/exporter/1233/aman-graphics-designs-ltd", source_code: "EPB", inherited_from: null, inherited_from_name: null },
      { label: "OEKO_TEX Cert #", value: "37789-100", source_url: AMAN_OEKO, source_code: "OEKO_TEX", inherited_from: null, inherited_from_name: null },
      { label: "RSC ID", value: "10089", source_url: "https://www.rsc-bd.org/", source_code: "RSC", inherited_from: null, inherited_from_name: null },
      { label: "RSC ID", value: "24595", source_url: "https://www.rsc-bd.org/", source_code: "RSC", building_name: AMAN_EXTENSION, inherited_from: null, inherited_from_name: null },
    ],
    certifications: [
      { kind: "oeko_tex", certificate_no: "37789-100", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX STANDARD 100", document_url: AMAN_OEKO },
    ],
    rsc_remediation: [
      {
        progress_pct: 100,
        workers_count: 4709,
        remediation_status: "initialcompleted",
        training_status: "completed",
        fetched_at: "2026-07-30T22:20:11.351347+00:00",
        fire_inspection_url: `${ACCORD_FILE}/2474.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/10219.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/9636.pdf`,
        boiler_inspection_url: `${ACCORD_FILE}/391263.pdf`,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=10089",
      },
      {
        building_name: AMAN_EXTENSION,
        progress_pct: 100,
        workers_count: 4709,
        remediation_status: "ontrack",
        training_status: "yet to start",
        fetched_at: "2026-07-30T22:20:15.864955+00:00",
        fire_inspection_url: `${ACCORD_FILE}/304602.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/305831.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/304608.pdf`,
        boiler_inspection_url: `${ACCORD_FILE}/391265.pdf`,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=24595",
      },
    ],
    brand_attributions: [
      { source_code: "BRAND_MS", display_name: "Marks & Spencer supplier list", source_url: MS_LIST_API, last_seen_at: "2026-05-18T23:39:39.426435+00:00" },
      { source_code: "BRAND_MS", display_name: "Marks & Spencer supplier list", source_url: MS_LIST_API, last_seen_at: "2026-06-26T23:06:32.492825+00:00" },
      { source_code: "BRAND_NEXT", display_name: "Next plc supplier list", source_url: NEXT_LIST, last_seen_at: "2026-05-18T22:45:54.99168+00:00" },
    ],
    provenance: [
      { tier: "tier1_gov", source_code: "EPB", display_name: "Export Promotion Bureau", source_url: "https://epb.gov.bd", source_ref: "1233", last_seen_at: "2026-08-14T21:58:27.826834+00:00" },
      { tier: "tier1_gov", source_code: "RSC", display_name: "RMG Sustainability Council", source_url: "https://rsc-bd.org", source_ref: "10089", last_seen_at: "2026-09-18T05:18:48.933544+00:00" },
      { tier: "tier2_industry", source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", source_url: "https://www.bgmea.com.bd", source_ref: "general:5201", last_seen_at: "2026-07-24T05:29:06.90265+00:00" },
      { tier: "tier3_cert", source_code: "OEKO_TEX", display_name: "OEKO-TEX", source_url: "https://www.oeko-tex.com", source_ref: "oeko-tex-37789", last_seen_at: "2026-06-26T23:06:52.677011+00:00" },
      { tier: "tier4_brand", source_code: "BRAND_MS", display_name: "Marks & Spencer supplier list", source_url: MS_LIST_API, source_ref: "ms-osh-BD2020066CY505A", last_seen_at: "2026-06-26T23:06:32.492825+00:00" },
      { tier: "tier4_brand", source_code: "BRAND_MS", display_name: "Marks & Spencer supplier list", source_url: MS_LIST_API, source_ref: "ms-osh-BD2026083JDARPJ", last_seen_at: "2026-05-18T23:39:39.426435+00:00" },
      { tier: "tier4_brand", source_code: "BRAND_NEXT", display_name: "Next plc supplier list", source_url: NEXT_LIST, source_ref: "946c798d5e5eadd0", last_seen_at: "2026-05-18T22:45:54.99168+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "Nazim Nagar, Hemayetpur\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T05:29:06.90265+00:00" },
      { kind: "factory", address: "Nazimnagar, Hemayetpur, Savar, Dhaka - 1340, Bangladesh", source_code: "OEKO_TEX", fetched_at: "2026-06-26T23:06:52.677011+00:00" },
      { kind: "mailing", address: "House # 1248 (1st Floor), Road # 09, Avenue # 02, Mirpur DOHS, Mirpur\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T05:29:06.90265+00:00" },
    ],
  };
  // 4,709 on the company's row and 4,709 again on the Extension's: RSC files
  // the same headcount on both, and the batch adds them to 9,418.
  return { profile, hscodes: [], workers: { value: 9418, source: "RSC", fetched_at: "2026-07-30T22:20:15.864955+00:00" }, today: TODAY };
}

// ---------------------------------------------------------------------------
// Two RSC rows, both belonging to buildings, with the mother filing its own
// registry headcount.
//
// Aswad Composite Mills: U-2 at 100 % with 4,640 workers, U-2 (Extension) at
// 81 % behind schedule with 2,063, and the company itself files 924 and has no
// RSC row. `production_workers_display_batch` returns 6,703 — the two buildings
// — so the figure covers 2 of 3 sites and none of them is this record. The
// U-2 (Extension) row has no boiler report, which spec §3 says is normal
// (1,120 of the RSC rows on file are missing one).
// Read from production 19 Sep 2026.
// ---------------------------------------------------------------------------

export const ASWAD_U2 = "ASWAD COMPOSITE MILLS LTD. ( U-2)";
export const ASWAD_U2_EXT = "ASWAD COMPOSITE MILLS LTD. ( U-2) (EXTENSION)";
export const ASWAD_UNIT_1 = "Aswad Composite Mills Ltd.(unit-1)";
const ASWAD_ALLIANCE = "https://accord2.fairfactories.org/accord_v2_files/AllianceAuditReports/11095";
const ASWAD_OEKO = `${OEKO_PROFILE}/16072~1wdFle~OOoauhnbqnY-X2Jn5nfxryQ-_4Y/`;

export function buildingSafetyOnlyInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "50c0809d-fd67-45d6-989d-d3ef116c0528",
      slug: "aswad-composite-mills",
      company_name: "ASWAD COMPOSITE MILLS LTD.",
      entity_type: "factory",
      city: "Dhaka",
      district: "Gazipur",
      address_raw: "HOLDING NO #121, BLOCK NO #H,WORD NO-07, BERAIDER CHALLA, SREEPUR, GAZIPUR",
      is_sanctioned: false,
      // The "Palmal Group" on the U-2 RSC row is RSC's own field; the company
      // record itself files no parent group, and the two must not be confused.
      parent_group_name: null,
      established_date: "2008-03-31",
      factory_types: ["Dyeing", "Knit", "Woven"],
      principal_products: [
        "All Kind of Knit Item",
        "Babies' apparel",
        "Children's apparel",
        "Dyed fabrics",
        "Greige fabrics",
        "Hoodie",
        "Knitted Garments",
        "Men's apparel",
        "Polo Shirts",
        "Printed fabrics",
        "pyjama set",
        "T-Shirts",
        "Women Top",
        "Women's apparel",
        "Worn accessories",
        "Yarn",
      ],
      employees_total: 924,
      machines_sewing: 8000,
      production_capacity_pcs_day: 24,
      production_capacity_dozen_yearly: 25000000,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BGMEA", "EPB", "WRAP", "GOTS", "BKMEA", "OEKO_TEX"],
    },
    t13_source_count: 6,
    pills: [
      { label: "BGMEA General member #", value: "4640", source_url: "https://www.bgmea.com.bd/member/414", source_code: "BGMEA", inherited_from: null, inherited_from_name: null },
      { label: "BKMEA #", value: "1957 - ASSO/2014", source_url: "https://www.bkmea.com/", source_code: "BKMEA", inherited_from: null, inherited_from_name: null },
      { label: "EPB Reg #", value: "BD04903", source_url: "https://edb.epb.gov.bd/exporter/2068/aswad-composite-mills-ltd", source_code: "EPB", inherited_from: null, inherited_from_name: null },
      { label: "GOTS Cert #", value: "GOTS-11587", source_url: "https://www.global-trace-base.org/SCO001805/certificate-document", source_code: "GOTS", inherited_from: null, inherited_from_name: null },
      { label: "OEKO_TEX Cert #", value: "16072-100", source_url: ASWAD_OEKO, source_code: "OEKO_TEX", inherited_from: null, inherited_from_name: null },
      { label: "WRAP Cert #", value: "132050", source_url: "https://wrapcompliance.org/certified-facility/132050/", source_code: "WRAP", inherited_from: null, inherited_from_name: null },
      { label: "RSC ID", value: "11095", source_url: "https://www.rsc-bd.org/", source_code: "RSC", building_name: ASWAD_U2, inherited_from: null, inherited_from_name: null },
      { label: "RSC ID", value: "25868", source_url: "https://www.rsc-bd.org/", source_code: "RSC", building_name: ASWAD_U2_EXT, inherited_from: null, inherited_from_name: null },
    ],
    certifications: [
      {
        kind: "gots",
        certificate_no: "GOTS-11587",
        issuer: "CERES-CERT AG",
        issued_on: null,
        expires_on: "2026-06-27",
        scope:
          "Operations: Dyeing, Embroidery, embellishment, Finishing, Knitting, Manufacturing, Pre-treatment , Printing, Washing, laundering | Products: Babies' apparel, Children's apparel, Dyed fabrics, Greige fabrics, Men's apparel, Printed fabrics, Women's apparel, Worn accessories",
        document_url: "https://www.global-trace-base.org/SCO001805/certificate-document",
      },
      { kind: "oeko_tex", certificate_no: "16072-100", issuer: "OEKO-TEX", issued_on: null, expires_on: null, scope: "OEKO-TEX STANDARD 100", document_url: ASWAD_OEKO },
      {
        kind: "wrap",
        certificate_no: "132050",
        issuer: "WRAP",
        issued_on: null,
        expires_on: "2026-12-05",
        scope: "Gold | Industries: Apparel | Products: Knitted Garments, T-Shirts",
        document_url: "https://wrapcompliance.org/certified-facility/132050/",
      },
    ],
    rsc_remediation: [
      {
        building_name: ASWAD_U2,
        progress_pct: 100,
        workers_count: 4640,
        remediation_status: "initialcompleted",
        training_status: "completed",
        fetched_at: "2026-07-30T22:29:42.813949+00:00",
        fire_inspection_url: `${ASWAD_ALLIANCE}/5155.pdf`,
        structural_inspection_url: `${ASWAD_ALLIANCE}/4119.pdf`,
        electrical_inspection_url: `${ASWAD_ALLIANCE}/5156.pdf`,
        boiler_inspection_url: `${ACCORD_FILE}/344312.pdf`,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=11095",
      },
      {
        building_name: ASWAD_U2_EXT,
        progress_pct: 81,
        workers_count: 2063,
        remediation_status: "behindschedule",
        training_status: "yet to start",
        fetched_at: "2026-07-30T22:29:47.319621+00:00",
        fire_inspection_url: `${ACCORD_FILE}/347873.pdf`,
        structural_inspection_url: `${ACCORD_FILE}/348385.pdf`,
        electrical_inspection_url: `${ACCORD_FILE}/345171.pdf`,
        boiler_inspection_url: null,
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=25868",
      },
    ],
    brand_attributions: [
      { source_code: "BRAND_HM", display_name: "H&M Group supplier list", source_url: HM_LIST, last_seen_at: "2026-06-26T23:03:47.960065+00:00", building_name: ASWAD_U2 },
      { source_code: "BRAND_HM", display_name: "H&M Group supplier list", source_url: HM_LIST, last_seen_at: "2026-06-26T23:03:51.222376+00:00", building_name: ASWAD_UNIT_1 },
    ],
    provenance: [
      { tier: "tier1_gov", source_code: "EPB", display_name: "Export Promotion Bureau", source_url: "https://epb.gov.bd", source_ref: "2068", last_seen_at: "2026-08-14T21:58:30.904319+00:00" },
      { tier: "tier2_industry", source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", source_url: "https://www.bgmea.com.bd", source_ref: "general:4640", last_seen_at: "2026-07-24T05:40:20.74018+00:00" },
      { tier: "tier2_industry", source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", source_url: "https://member.bkmea.com", source_ref: "2326:detail", last_seen_at: "2026-08-02T06:07:25.532255+00:00" },
      { tier: "tier2_industry", source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", source_url: "https://member.bkmea.com", source_ref: "2735:detail", last_seen_at: "2026-08-02T05:12:00.563013+00:00" },
      { tier: "tier2_industry", source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", source_url: "https://member.bkmea.com", source_ref: "1957", last_seen_at: "2026-08-02T02:35:27.967078+00:00" },
      { tier: "tier2_industry", source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", source_url: "https://member.bkmea.com", source_ref: "2526", last_seen_at: "2026-08-02T02:28:29.006688+00:00" },
      { tier: "tier3_cert", source_code: "GOTS", display_name: "Global Organic Textile Standard", source_url: "https://global-standard.org", source_ref: "gots-SCO001805", last_seen_at: "2026-06-26T23:02:07.65372+00:00" },
      { tier: "tier3_cert", source_code: "OEKO_TEX", display_name: "OEKO-TEX", source_url: "https://www.oeko-tex.com", source_ref: "oeko-tex-16072", last_seen_at: "2026-06-26T23:17:10.432376+00:00" },
      { tier: "tier3_cert", source_code: "WRAP", display_name: "Worldwide Responsible Accredited Production", source_url: "https://wrapcompliance.org", source_ref: "wrap-132050", last_seen_at: "2026-07-24T05:40:51.680245+00:00" },
    ],
    addresses: [
      { kind: "factory", address: "26, Malibagh Chowdhury Para, Malibagh\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T05:40:20.74018+00:00" },
      { kind: "factory", address: "HOLDING NO #121, BLOCK NO #H,WORD NO-07, BERAIDER CHALLA, SREEPUR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T02:28:29.006688+00:00" },
      { kind: "factory", address: "HOLDING NO #121, BLOCK NO #H,WORD NO-07, BERAIDER CHALLA, SREEPUR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T05:12:00.563013+00:00" },
      { kind: "factory", address: "MULAID, MAONA, SREEPUR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T06:07:25.532255+00:00" },
      { kind: "factory", address: "Holding - 121, Block - H, Beraiderchala, Ward No - 07, Sreepur Municipality, Sreepur, Gazipur - 1740, Bangladesh", source_code: "OEKO_TEX", fetched_at: "2026-06-26T23:17:10.432376+00:00" },
      { kind: "mailing", address: "9/Kha, Confidence Center, Shahazadpur, Gulsan\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T05:40:20.74018+00:00" },
      { kind: "mailing", address: "CONFIDENCE CENTER, 9/KHA, SHAHAZADPUR, GULSHAN, DHAKA-1212, GULSHAN, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T02:28:29.006688+00:00" },
      { kind: "mailing", address: "CONFIDENCE CENTER, 9/KHA, SHAHAZADPUR, GULSHAN, DHAKA-1212, GULSHAN, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T05:12:00.563013+00:00" },
      { kind: "mailing", address: "MULAID, MAONA, SREEPUR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T06:07:25.532255+00:00" },
    ],
  };
  return { profile, hscodes: [], workers: { value: 6703, source: "RSC", fetched_at: "2026-07-30T22:29:47.319621+00:00" }, today: TODAY };
}

/**
 * The 125-character record, as an admin list receives it.
 *
 * `buyer_supplier_profile` serves published records only, so a buyer surface
 * cannot reach this name — but spec §6 asks for it "on every card type they
 * can reach", and the kit's card, table row and sheet are what admin lists
 * will use. The fields below are the row's own, read from `suppliers` and
 * `source_records` on 19 Sep 2026: one brand row, no register number, no
 * certificate. Nothing here is filled in to make the card look complete.
 */
export function longestNameInput(): RecordInput {
  const profile: ProfilePayload = {
    supplier: {
      id: "57f470a2-71c3-4a82-b1f6-f700aa93341f",
      slug: "indochine-apparel-bangladesh-limited-plot-54-56-previously-baxter-brenton-bd-clothing-manufacturing-co-ltd-extension",
      company_name: LONG_NAME_125,
      entity_type: "factory",
      city: "Ashulia",
      district: "Dhaka",
      address_raw: "Plot-54-56, DEPZ (Old Zone), Ganakbari, Ashulia, Savar, Dhaka",
      is_sanctioned: false,
      parent_group_name: null,
      established_date: null,
      factory_types: [],
      principal_products: [],
      employees_total: null,
      machines_sewing: null,
      production_capacity_pcs_day: null,
      production_capacity_dozen_yearly: null,
      supplier_moq: null,
      supplier_lead_time_days: null,
      source_tags: ["BRAND_MS"],
    },
    t13_source_count: 0,
    pills: [],
    certifications: [],
    rsc_remediation: null,
    brand_attributions: [{ source_code: "BRAND_MS", display_name: "Marks & Spencer supplier list", source_url: MS_LIST_API, last_seen_at: "2026-06-26T23:07:48.785712+00:00" }],
    provenance: [],
    addresses: [],
  };
  return { profile, hscodes: [], workers: null, today: TODAY };
}
