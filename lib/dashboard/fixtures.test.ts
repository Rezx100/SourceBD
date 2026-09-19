// Reconciles `lib/dashboard/fixtures.ts` against production.
//
// The fixtures are the only thing the kit renders, so "nothing fake"
// (ds-rebuild-must-stay §2) is a claim about this file and nothing else. The
// table below is what production returned on 19 Sep 2026, read through the
// Supabase MCP `execute_sql` on project `stnrfxrxfonwexzcvvpv`, read-only. To
// re-check any row:
//
//     select jsonb_pretty(buyer_supplier_profile('<slug>'));
//     select (supplier_epb_hscodes('<slug>'))::text;
//     select (production_workers_display_batch(array['<uuid>']::uuid[]))::text;
//
// A fixture that drifts from those payloads fails here instead of passing
// quietly and being screenshotted as evidence.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProfilePayload, RecordInput } from "./build-models";
import { sourceMark } from "./source-tiers";
import {
  aboniInput,
  arFashionInput,
  ASWAD_U2,
  ASWAD_U2_EXT,
  ASWAD_UNIT_1,
  ABONI_NEW_SHED,
  AMAN_EXTENSION,
  buildingBrandListsInput,
  buildingOnlyCertificateInput,
  buildingRegistrationsInput,
  buildingSafetyOnlyInput,
  duplicateBrandRowsInput,
  HOSSAIN_BUILDING,
  inheritedPillsInput,
  longestHsListInput,
  longestNameInput,
  longestProductListInput,
  LONG_NAME_125,
  MG_BUILDING,
  oneRegisterManyNumbersInput,
  sanctionedInput,
  smKnitwearInput,
  SM_EXTENSION,
  SQ_UNIT_04,
  SQ_UNIT_3,
  zaheenSampleInput,
  ZAHEEN_NAME,
} from "./fixtures";

/** One row of what `buyer_supplier_profile` (or, for an unpublished record, the tables behind it) returned. */
type ProductionRow = {
  id: string;
  published: boolean;
  entityType: string;
  city: string | null;
  district: string | null;
  parentGroup: string | null;
  established: string | null;
  employees: number | null;
  sewing: number | null;
  pcsDay: number | null;
  dozenYearly: number | null;
  products: number;
  /** -1 means `rsc_remediation` came back null, which is not the same as an empty list. */
  rsc: number;
  pills: number;
  certs: number;
  brands: number;
  provenance: number;
  addresses: number;
  t13: number;
  hsLines: number;
  /** `production_workers_display_batch`, or null when the record is not in it. */
  workers: { value: number; source: string } | null;
};

const PRODUCTION: Record<string, ProductionRow> = {
  "aboni-knitwear": {
    id: "8ce50581-2d84-4cc2-93de-506394eade5d", published: true, entityType: "factory",
    city: "Dhaka", district: "Dhaka", parentGroup: "Babylon Group", established: "1985",
    employees: 3314, sewing: 850, pcsDay: 1000000, dozenYearly: null, products: 27,
    rsc: 2, pills: 10, certs: 4, brands: 3, provenance: 13, addresses: 9, t13: 8,
    // The fixture carries the twelve 4-digit headings the 27 EPB lines roll up to.
    hsLines: 12, workers: { value: 3166, source: "RSC" },
  },
  "ar-fashion": {
    id: "61508d5d-845f-4638-aca2-63057d38236a", published: true, entityType: "buying_house",
    city: null, district: null, parentGroup: null, established: null,
    employees: null, sewing: null, pcsDay: null, dozenYearly: null, products: 0,
    rsc: -1, pills: 1, certs: 0, brands: 0, provenance: 1, addresses: 1, t13: 1,
    hsLines: 0, workers: null,
  },
  "zaheen-knitwear-limited-shed-3-4-5-10-11-12-13-and-building-security-etp-and-fire-pump": {
    id: "e4669f72-a97a-40e4-9e6e-11df37d2e96e", published: true, entityType: "factory",
    city: "Narayanganj", district: "Narayanganj", parentGroup: null, established: null,
    employees: 1634, sewing: null, pcsDay: null, dozenYearly: null, products: 0,
    rsc: 1, pills: 1, certs: 0, brands: 0, provenance: 1, addresses: 0, t13: 1,
    hsLines: 0, workers: { value: 1634, source: "RSC" },
  },
  "sm-knitwear": {
    id: "c07aca81-045c-4f7e-8812-2c19e512b5df", published: true, entityType: "factory",
    city: "Gazipur", district: "Gazipur", parentGroup: "SM Group", established: "2001-01-01",
    employees: 300, sewing: 97, pcsDay: 11000, dozenYearly: 4000000, products: 37,
    rsc: 1, pills: 13, certs: 6, brands: 2, provenance: 17, addresses: 15, t13: 8,
    hsLines: 24, workers: { value: 907, source: "RSC" },
  },
  "ab-apparels-ltd-extension": {
    id: "3d64d325-29a1-4352-8675-5619a277dcaa", published: false, entityType: "factory",
    city: "Dhaka", district: "Dhaka", parentGroup: null, established: null,
    employees: 651, sewing: null, pcsDay: null, dozenYearly: null, products: 0,
    rsc: -1, pills: 1, certs: 0, brands: 0, provenance: 1, addresses: 0, t13: 1,
    hsLines: 0, workers: { value: 651, source: "registry" },
  },
  "hossain-dyeing-and-printing-mills": {
    id: "4543927f-de94-47b1-a6be-9009302737ef", published: true, entityType: "factory",
    city: "Gazipur", district: "Gazipur", parentGroup: null, established: null,
    employees: null, sewing: null, pcsDay: null, dozenYearly: null, products: 0,
    rsc: -1, pills: 3, certs: 2, brands: 0, provenance: 1, addresses: 1, t13: 1,
    hsLines: 0, workers: { value: 1784, source: "registry" },
  },
  "plummy-fashions": {
    id: "7f5d2dcd-118a-4d29-ad6b-76d59ab674b9", published: true, entityType: "factory",
    city: "Narayanganj", district: "Narayanganj", parentGroup: null, established: "2021-12-08",
    employees: 350, sewing: 794, pcsDay: 8000, dozenYearly: 1260000, products: 4,
    rsc: 1, pills: 4, certs: 0, brands: 0, provenance: 5, addresses: 8, t13: 4,
    hsLines: 54, workers: { value: 800, source: "RSC" },
  },
  "adventure-garments": {
    id: "e96d742a-11b3-4533-9620-febb36eb6d69", published: true, entityType: "factory",
    city: "Gazipur", district: "Gazipur", parentGroup: null, established: "2020-01-04",
    employees: 610, sewing: 197, pcsDay: null, dozenYearly: 9750000, products: 39,
    rsc: -1, pills: 1, certs: 0, brands: 0, provenance: 1, addresses: 2, t13: 1,
    hsLines: 0, workers: { value: 610, source: "registry" },
  },
  "mg-niche-flair": {
    id: "f755f286-512a-48d8-b4d8-e95404e70c79", published: true, entityType: "unknown",
    city: null, district: null, parentGroup: null, established: "2012-02-06",
    employees: 2350, sewing: 600, pcsDay: null, dozenYearly: 300000, products: 2,
    rsc: -1, pills: 2, certs: 1, brands: 0, provenance: 1, addresses: 2, t13: 1,
    hsLines: 0, workers: { value: 2350, source: "registry" },
  },
  "mahir-label-and-accessories": {
    id: "9967d91c-d854-4e25-8dea-78331d326fb6", published: true, entityType: "factory",
    city: "Khilkhet", district: "Dhaka", parentGroup: null, established: null,
    employees: null, sewing: null, pcsDay: null, dozenYearly: null, products: 34,
    rsc: -1, pills: 5, certs: 0, brands: 0, provenance: 5, addresses: 10, t13: 1,
    hsLines: 0, workers: null,
  },
  "sq-celsius": {
    id: "f0b7bbab-e559-4423-a17a-045b75c2669c", published: true, entityType: "factory",
    city: "Gazipur", district: "Dhaka", parentGroup: "SQ Group", established: "2014-03-18",
    employees: 13986, sewing: 5122, pcsDay: null, dozenYearly: 1164375, products: 17,
    rsc: 3, pills: 8, certs: 3, brands: 4, provenance: 6, addresses: 3, t13: 6,
    hsLines: 0, workers: { value: 3690, source: "RSC" },
  },
  "aman-graphics-and-designs": {
    id: "c60c3e6e-ac7d-42e3-9d2b-4eb6d931c976", published: true, entityType: "factory",
    city: "Dhaka", district: "Dhaka", parentGroup: "Unifill Group", established: "2011",
    employees: 560, sewing: 290, pcsDay: null, dozenYearly: 180000, products: 3,
    rsc: 2, pills: 5, certs: 1, brands: 3, provenance: 7, addresses: 3, t13: 4,
    hsLines: 0, workers: { value: 9418, source: "RSC" },
  },
  "aswad-composite-mills": {
    id: "50c0809d-fd67-45d6-989d-d3ef116c0528", published: true, entityType: "factory",
    city: "Dhaka", district: "Gazipur", parentGroup: null, established: "2008-03-31",
    employees: 924, sewing: 8000, pcsDay: 24, dozenYearly: 25000000, products: 16,
    rsc: 2, pills: 8, certs: 3, brands: 2, provenance: 9, addresses: 9, t13: 6,
    hsLines: 0, workers: { value: 6703, source: "RSC" },
  },
  "indochine-apparel-bangladesh-limited-plot-54-56-previously-baxter-brenton-bd-clothing-manufacturing-co-ltd-extension": {
    id: "57f470a2-71c3-4a82-b1f6-f700aa93341f", published: false, entityType: "factory",
    city: "Ashulia", district: "Dhaka", parentGroup: null, established: null,
    employees: null, sewing: null, pcsDay: null, dozenYearly: null, products: 0,
    rsc: -1, pills: 0, certs: 0, brands: 1, provenance: 0, addresses: 0, t13: 0,
    hsLines: 0, workers: null,
  },
};

/**
 * Where a fixture deliberately differs from the payload, with the reason.
 *
 * §2 allows a state the screens must render to be composed from real rows when
 * production holds no record in that state — and requires it to say so. This
 * map is that saying-so, in a form the suite can hold the fixtures to: a
 * difference listed here is allowed, and a difference that is not listed fails.
 */
const COMPOSED: Record<string, { field: keyof ProductionRow; to: number; why: string }[]> = {
  // `v_supplier_registry_ids` unions a published parent factory's rows onto a
  // satellite. The satellite is unpublished (0 rows carry `inherited_from` on
  // 19 Sep 2026), so the five non-RSC rows are the parent's own, verbatim,
  // with the view's own " (parent factory)" label and `inherited_from` set.
  "ab-apparels-ltd-extension": [
    { field: "pills", to: 6, why: "the record's own RSC row plus the five the view would lend it from AB APPARELS LTD" },
  ],
};

type Fixture = { name: string; input: RecordInput };

const FIXTURES: Fixture[] = [
  { name: "aboniInput", input: aboniInput() },
  { name: "arFashionInput", input: arFashionInput() },
  { name: "zaheenSampleInput", input: zaheenSampleInput() },
  { name: "smKnitwearInput", input: smKnitwearInput() },
  { name: "inheritedPillsInput", input: inheritedPillsInput() },
  { name: "buildingRegistrationsInput", input: buildingRegistrationsInput() },
  { name: "longestHsListInput", input: longestHsListInput() },
  { name: "longestProductListInput", input: longestProductListInput() },
  { name: "buildingOnlyCertificateInput", input: buildingOnlyCertificateInput() },
  { name: "oneRegisterManyNumbersInput", input: oneRegisterManyNumbersInput() },
  { name: "buildingBrandListsInput", input: buildingBrandListsInput() },
  { name: "duplicateBrandRowsInput", input: duplicateBrandRowsInput() },
  { name: "buildingSafetyOnlyInput", input: buildingSafetyOnlyInput() },
  { name: "longestNameInput", input: longestNameInput() },
];

function shapeOf(input: RecordInput): Omit<ProductionRow, "published"> {
  const p: ProfilePayload = input.profile;
  const s = p.supplier;
  const rsc = p.rsc_remediation as unknown[] | null;
  return {
    id: s.id,
    entityType: s.entity_type,
    city: s.city ?? null,
    district: s.district ?? null,
    parentGroup: s.parent_group_name ?? null,
    established: s.established_date ?? null,
    employees: s.employees_total ?? null,
    sewing: s.machines_sewing ?? null,
    pcsDay: s.production_capacity_pcs_day ?? null,
    dozenYearly: s.production_capacity_dozen_yearly ?? null,
    products: (s.principal_products ?? []).length,
    rsc: rsc === null ? -1 : rsc.length,
    pills: p.pills.length,
    certs: p.certifications.length,
    brands: (p.brand_attributions ?? []).length,
    provenance: (p.provenance ?? []).length,
    addresses: (p.addresses ?? []).length,
    t13: p.t13_source_count,
    hsLines: input.hscodes.length,
    workers: input.workers === null ? null : { value: input.workers.value, source: input.workers.source },
  };
}

describe("every fixture is the record production holds", () => {
  for (const { name, input } of FIXTURES) {
    it(`${name} matches the 19 Sep 2026 payload`, () => {
      const slug = input.profile.supplier.slug;
      const expected = PRODUCTION[slug];
      assert.ok(expected, `${name} renders "${slug}", which no recorded production read covers`);
      const allowed = COMPOSED[slug] ?? [];
      const want: Omit<ProductionRow, "published"> = { ...expected };
      delete (want as Partial<ProductionRow>).published;
      for (const c of allowed) (want as Record<string, unknown>)[c.field] = c.to;
      assert.deepEqual(shapeOf(input), want, allowed.length ? `allowed compositions: ${allowed.map((c) => c.why).join("; ")}` : undefined);
    });
  }

  it("the two records a buyer cannot reach are the two production has not published", () => {
    const unreachable = FIXTURES.filter((f) => PRODUCTION[f.input.profile.supplier.slug]?.published === false).map((f) => f.name);
    assert.deepEqual(unreachable.sort(), ["inheritedPillsInput", "longestNameInput"]);
  });
});

describe("no fixture invents a fact about a named company", () => {
  /** Every URL any fixture carries, with where it came from. */
  function urls(input: RecordInput): { where: string; url: string }[] {
    const p = input.profile;
    const out: { where: string; url: string }[] = [];
    const push = (where: string, url: string | null | undefined) => {
      if (typeof url === "string" && url !== "") out.push({ where, url });
    };
    p.pills.forEach((x, i) => push(`pills[${i}]`, x.source_url));
    p.certifications.forEach((x, i) => push(`certifications[${i}]`, x.document_url));
    (p.brand_attributions ?? []).forEach((x, i) => push(`brand_attributions[${i}]`, x.source_url));
    (p.provenance ?? []).forEach((x, i) => push(`provenance[${i}]`, x.source_url));
    for (const row of (p.rsc_remediation as Record<string, unknown>[] | null) ?? []) {
      for (const key of ["fire_inspection_url", "structural_inspection_url", "electrical_inspection_url", "boiler_inspection_url", "cap_url"]) {
        push(`rsc.${key}`, row[key] as string | null);
      }
    }
    input.hscodes.forEach((x, i) => push(`hscodes[${i}]`, x.source_url));
    return out;
  }

  /** The hosts production's own rows use. A URL on any other host was typed, not read. */
  const HOSTS = new Set([
    "www.bgmea.com.bd",
    "www.bkmea.com",
    "member.bkmea.com",
    "bgapmea.org",
    "www.bgapmea.org",
    "edb.epb.gov.bd",
    "epb.gov.bd",
    "www.rsc-bd.org",
    "rsc-bd.org",
    "accord2.fairfactories.org",
    "www.global-trace-base.org",
    "global-standard.org",
    "services.oeko-tex.com",
    "www.oeko-tex.com",
    "wrapcompliance.org",
    "opensupplyhub.org",
    "hmgroup.com",
    "www.asosplc.com",
    "www.nextplc.co.uk",
  ]);

  for (const { name, input } of FIXTURES) {
    it(`${name} links only to hosts production's rows use`, () => {
      for (const { where, url } of urls(input)) {
        assert.match(url, /^https:\/\//, `${name} ${where} is not an https URL: ${url}`);
        const host = new URL(url).host;
        assert.ok(HOSTS.has(host), `${name} ${where} points at ${host}, which no production row uses: ${url}`);
      }
    });
  }

  it("no fixture id is shared by two different companies, and every id is a real uuid", () => {
    const byId = new Map<string, Set<string>>();
    for (const { input } of FIXTURES) {
      const s = input.profile.supplier;
      assert.match(s.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, `${s.slug} has a made-up id: ${s.id}`);
      (byId.get(s.id) ?? byId.set(s.id, new Set()).get(s.id)!).add(s.slug);
    }
    for (const [id, slugs] of byId) assert.equal(slugs.size, 1, `${id} is used for ${[...slugs].join(" and ")}`);
  });

  it("no fixture claims a company is sanctioned; production holds none, so the one sanctioned screen is flagged as a sample", () => {
    for (const { name, input } of FIXTURES) {
      assert.equal(input.profile.supplier.is_sanctioned, false, `${name} marks a real company sanctioned`);
    }
    // `select count(*) from suppliers where is_sanctioned` was 0 on 19 Sep 2026.
    const sample = zaheenSampleInput();
    assert.equal(sample.sanctionSample, true, "the gallery's sanctioned screen must say it is a sample");
    assert.equal(sample.profile.supplier.is_sanctioned, false);
    // `sanctionedInput` is the other half of the pair: the flag as production
    // would set it, used to prove the kit reads the column and not the flag.
    const real = sanctionedInput();
    assert.equal(real.profile.supplier.is_sanctioned, true);
    assert.equal(real.sanctionSample, undefined);
  });

  it("every building a fixture names is exported, so a test cannot misspell one into passing", () => {
    const named = new Set<string>();
    for (const { input } of FIXTURES) {
      for (const pill of input.profile.pills) if (pill.building_name) named.add(pill.building_name);
      for (const cert of input.profile.certifications) if (cert.building_name) named.add(cert.building_name);
      for (const b of input.profile.brand_attributions ?? []) if (b.building_name) named.add(b.building_name);
      for (const row of (input.profile.rsc_remediation as { building_name?: string | null }[] | null) ?? []) {
        if (row.building_name) named.add(row.building_name);
      }
    }
    const exported = new Set([
      HOSSAIN_BUILDING,
      MG_BUILDING,
      SQ_UNIT_04,
      SQ_UNIT_3,
      ASWAD_U2,
      ASWAD_U2_EXT,
      ASWAD_UNIT_1,
      AMAN_EXTENSION,
      ABONI_NEW_SHED,
      SM_EXTENSION,
    ]);
    for (const n of named) assert.ok(exported.has(n), `the building "${n}" is named in a payload but not exported for the tests to reference`);
  });

  it("every source code a fixture carries is one the mark registry ranks", () => {
    for (const { name, input } of FIXTURES) {
      const codes = [
        ...input.profile.pills.map((p) => p.source_code),
        ...(input.profile.brand_attributions ?? []).map((b) => b.source_code),
        ...(input.profile.provenance ?? []).map((p) => p.source_code),
        ...(input.profile.addresses ?? []).map((a) => a.source_code),
      ];
      for (const code of codes) {
        const m = sourceMark(code);
        assert.notEqual(m.mark, "??", `${name} carries the source code "${code}", which the registry does not rank`);
      }
    }
  });
});

describe("the two longest names are production's, at their real lengths", () => {
  it("100 characters published, 125 unpublished", () => {
    assert.equal(ZAHEEN_NAME.length, 100);
    assert.equal(LONG_NAME_125.length, 125);
    assert.equal(zaheenSampleInput().profile.supplier.company_name, ZAHEEN_NAME);
    assert.equal(longestNameInput().profile.supplier.company_name, LONG_NAME_125);
  });
});
