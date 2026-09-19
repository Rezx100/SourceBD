// Test fixtures for the dashboard kit: the shape `buyer_supplier_profile`,
// `supplier_epb_hscodes` and `production_workers_display_batch` return, with
// the values of the named test records copied verbatim from production on
// 19 Sep 2026 (rebuild spec §3 "Real records to test with"). Nothing here is
// invented: if a column is null on production it is null here, and the payloads
// are trimmed only by dropping keys the kit never reads (`documents`,
// `partner_factories`, `sanctions`, `supplier_about`, …). `lib/dashboard/fixtures.test.ts`
// re-checks a sample of these values against the shapes the builders expect.
//
// Contact fields are deliberately added to one fixture — marked `leaked`, and
// never returned by the RPC — so the boundary test can prove they never reach
// the HTML. Used only by tests and the /dev/ds screenshot harness, never by a page.

import type { HsLine, ProfilePayload, RecordInput } from "./build-models";

export const TODAY = new Date("2026-09-18T10:00:00Z");

export const ZAHEEN_NAME =
  "Zaheen Knitwears Limited (Shed - 3, 4, 5, 10, 11, 12, 13) & (Building - Security, ETP and Fire Pump)";

/** A 125-character name, the longest the spec asks the screens to carry (§3, §6). Real record. */
export const LONG_NAME_125 =
  "Ananta Huaxiang Ltd. (Unit-2) & Ananta Apparels Limited (Shed 1, 2, 3, 4 and the Security, ETP, Boiler and Fire Pump Buildings)";

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
      { source_code: "RSC", label: "RSC ID", value: "23602", source_url: "https://www.rsc-bd.org/", building_name: "Aboni Knitwear (New Shed)" },
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
        building_name: "Aboni Knitwear (New Shed)",
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
      {
        source_code: "BRAND_ASOS",
        display_name: "ASOS supplier list",
        source_url: "https://www.asosplc.com/media/cmzk3m5n/factory-list-april-2026.pdf",
        last_seen_at: "2026-07-30T21:27:35.655595+00:00",
      },
      {
        source_code: "BRAND_HM",
        display_name: "H&M Group supplier list",
        source_url: "https://hmgroup.com/wp-content/uploads/spur/HM-Group-Supplier-List-May-2026 .xlsx",
        last_seen_at: "2026-06-26T23:02:29.477664+00:00",
      },
      {
        source_code: "BRAND_NEXT",
        display_name: "Next plc supplier list",
        source_url: "https://www.nextplc.co.uk/~/media/Files/N/next-plc-v4/Tier 1 -2 - 3 lists/T1 2025.pdf",
        last_seen_at: "2026-05-18T22:44:33.591105+00:00",
      },
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
      {
        source_code: "BRAND_ASOS",
        display_name: "ASOS supplier list",
        tier: "tier4_brand",
        source_ref: "b376ef6e0404ae78",
        source_url: "https://www.asosplc.com/media/cmzk3m5n/factory-list-april-2026.pdf",
        last_seen_at: "2026-07-30T21:27:35.655595+00:00",
      },
      {
        source_code: "BRAND_HM",
        display_name: "H&M Group supplier list",
        tier: "tier4_brand",
        source_ref: "aae431e7c9e0b1c9",
        source_url: "https://hmgroup.com/wp-content/uploads/spur/HM-Group-Supplier-List-May-2026 .xlsx",
        last_seen_at: "2026-06-26T23:02:29.477664+00:00",
      },
      {
        source_code: "BRAND_NEXT",
        display_name: "Next plc supplier list",
        tier: "tier4_brand",
        source_ref: "0c3207180f592be8",
        source_url: "https://www.nextplc.co.uk/~/media/Files/N/next-plc-v4/Tier 1 -2 - 3 lists/T1 2025.pdf",
        last_seen_at: "2026-05-18T22:44:33.591105+00:00",
      },
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
  return { profile: aboniProfile(), hscodes: ABONI_HS, workers: { value: 3166, source: "RSC" }, today: TODAY };
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
    workers: { value: 1634, source: "RSC" },
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
// S M Knitwears — two EPB registrations, 24 HS lines across chapters 61 and 62,
// and an RSC row that belongs to a building, not to the company itself.
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

export function smKnitwearInput(): RecordInput {
  const profile = {
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
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "9741-100", source_url: "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/9741~1wdI2V~x/" },
      { source_code: "OEKO_TEX", label: "OEKO_TEX Cert #", value: "9741-mig", source_url: "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/9741~1wdJ30~x/" },
      { source_code: "RSC", label: "RSC ID", value: "10902", source_url: "https://www.rsc-bd.org/" },
      { source_code: "WRAP", label: "WRAP Cert #", value: "124992", source_url: "https://wrapcompliance.org/certified-facility/124992/" },
      { source_code: "RSC", label: "RSC ID", value: "24545", source_url: "https://www.rsc-bd.org/", building_name: "S M Knitwears Limited. (Extension)" },
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
      {
        kind: "oeko_tex",
        certificate_no: "9741-100",
        issuer: "OEKO-TEX",
        issued_on: null,
        expires_on: null,
        scope: "OEKO-TEX STANDARD 100",
        document_url: "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/9741~1wdI2V~x/",
      },
      {
        kind: "oeko_tex",
        certificate_no: "9741-mig",
        issuer: "OEKO-TEX",
        issued_on: null,
        expires_on: null,
        scope: "OEKO-TEX MADE IN GREEN",
        document_url: "https://services.oeko-tex.com/newoekotex/portal/for-new-website/customer_profile/9741~1wdJ30~x/",
      },
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
        building_name: "S M Knitwears Limited. (Extension)",
        progress_pct: 53,
        workers_count: 907,
        remediation_status: "behindschedule",
        training_status: "yet to start",
        fetched_at: "2026-09-11T05:42:11.689462+00:00",
        fire_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/318263.pdf",
        structural_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/319770.pdf",
        electrical_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/320253.pdf",
        boiler_inspection_url: "https://accord2.fairfactories.org/accord_v2_files/1/Audit_Files/394192.pdf",
        cap_url: "https://accord2.fairfactories.org/web/Audits/Audits/DownloadCAPFile?id=24545",
      },
    ],
    brand_attributions: [
      {
        source_code: "BRAND_ASOS",
        display_name: "ASOS supplier list",
        source_url: "https://www.asosplc.com/media/cmzk3m5n/factory-list-april-2026.pdf",
        last_seen_at: "2026-07-30T21:30:12.583394+00:00",
      },
      {
        source_code: "BRAND_NEXT",
        display_name: "Next plc supplier list",
        source_url: "https://www.nextplc.co.uk/~/media/Files/N/next-plc-v4/Tier 1 -2 - 3 lists/T1 2025.pdf",
        last_seen_at: "2026-05-18T22:47:25.686932+00:00",
      },
    ],
    provenance: [
      { source_code: "EPB", display_name: "Export Promotion Bureau", tier: "tier1_gov", source_ref: "3660", source_url: "https://epb.gov.bd", last_seen_at: "2026-08-14T21:58:34.196427+00:00" },
      { source_code: "EPB", display_name: "Export Promotion Bureau", tier: "tier1_gov", source_ref: "1000", source_url: "https://epb.gov.bd", last_seen_at: "2026-08-14T21:58:27.826834+00:00" },
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "10902", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:42:11.108084+00:00" },
      { source_code: "RSC", display_name: "RMG Sustainability Council", tier: "tier1_gov", source_ref: "11557", source_url: "https://rsc-bd.org", last_seen_at: "2026-09-18T05:40:11.988984+00:00" },
      { source_code: "BGAPMEA", display_name: "Bangladesh Garment Accessories & Packaging MEA", tier: "tier2_industry", source_ref: "1475", source_url: "https://bgapmea.org", last_seen_at: "2026-06-27T00:08:50.965602+00:00" },
      { source_code: "BGMEA", display_name: "Bangladesh Garment Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "general:3532", source_url: "https://www.bgmea.com.bd", last_seen_at: "2026-07-24T08:31:15.197346+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "1088:detail", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T07:30:59.695104+00:00" },
      { source_code: "BKMEA", display_name: "Bangladesh Knitwear Manufacturers & Exporters Assoc.", tier: "tier2_industry", source_ref: "1092", source_url: "https://member.bkmea.com", last_seen_at: "2026-08-02T02:52:03.913142+00:00" },
      { source_code: "GOTS", display_name: "Global Organic Textile Standard", tier: "tier3_cert", source_ref: "gots-SCO031435", source_url: "https://global-standard.org", last_seen_at: "2026-06-26T23:43:58.851503+00:00" },
      { source_code: "OEKO_TEX", display_name: "OEKO-TEX", tier: "tier3_cert", source_ref: "oeko-tex-9741", source_url: "https://www.oeko-tex.com", last_seen_at: "2026-06-27T02:52:22.993559+00:00" },
      { source_code: "WRAP", display_name: "Worldwide Responsible Accredited Production", tier: "tier3_cert", source_ref: "wrap-124992", source_url: "https://wrapcompliance.org", last_seen_at: "2026-07-24T05:27:53.080573+00:00" },
      {
        source_code: "BRAND_ASOS",
        display_name: "ASOS supplier list",
        tier: "tier4_brand",
        source_ref: "288cf7788eeaacbc",
        source_url: "https://www.asosplc.com/media/cmzk3m5n/factory-list-april-2026.pdf",
        last_seen_at: "2026-07-30T21:30:12.583394+00:00",
      },
      {
        source_code: "BRAND_NEXT",
        display_name: "Next plc supplier list",
        tier: "tier4_brand",
        source_ref: "e79d762bb0cd7386",
        source_url: "https://www.nextplc.co.uk/~/media/Files/N/next-plc-v4/Tier 1 -2 - 3 lists/T1 2025.pdf",
        last_seen_at: "2026-05-18T22:47:25.686932+00:00",
      },
    ],
    addresses: [
      { kind: "factory", address: "7 No. Kewa, Shreepur, Gazipur", source_code: "BGAPMEA", fetched_at: "2026-06-27T00:08:50.965602+00:00" },
      { kind: "factory", address: "Shirirchala, Bhabanipur\nGazipur\nGazipur", source_code: "BGMEA", fetched_at: "2026-07-24T08:31:15.197346+00:00" },
      { kind: "factory", address: "SHIRIRCHALA, BHABANIPUR, GAZIPUR SADAR, SADAR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T03:03:44.843323+00:00" },
      { kind: "factory", address: "PLOT-A/107, BSCIC HOSIERY I/E, SHASONGAON, FATULLAH, NARAYANGANJ", source_code: "BKMEA", fetched_at: "2026-08-02T02:37:15.992235+00:00" },
      { kind: "factory", address: "SHIRIRCHALA, BHABANIPUR, GAZIPUR SADAR, SADAR, GAZIPUR", source_code: "BKMEA", fetched_at: "2026-08-02T04:24:23.083491+00:00" },
      { kind: "mailing", address: "House-SE-04, Road-137, Gulshan-1\nDhaka\nDhaka", source_code: "BGMEA", fetched_at: "2026-07-24T08:31:15.197346+00:00" },
      { kind: "mailing", address: "HOUSE-SE-4, ROAD-137, GULSHAN, DHAKA", source_code: "BKMEA", fetched_at: "2026-08-02T04:24:23.083491+00:00" },
      { kind: "registered", address: "House # SE-04, Road # 137, Gulshan-01, Dhaka-1212", source_code: "BGAPMEA", fetched_at: "2026-06-27T00:08:50.965602+00:00" },
    ],
  } as ProfilePayload;
  return { profile, hscodes: SM_HS, workers: { value: 907, source: "RSC" }, today: TODAY };
}
