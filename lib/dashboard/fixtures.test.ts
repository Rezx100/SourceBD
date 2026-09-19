// Reconciles `lib/dashboard/fixtures.ts` against production.
//
// The fixtures are the only thing the kit renders, so "nothing fake"
// (ds-rebuild-must-stay §2) is a claim about that file and nothing else.
//
// `lib/dashboard/fixtures.production.json` is the read, not a restatement of
// the fixtures: it is written straight out of `buyer_supplier_profile`,
// `supplier_epb_hscodes` and `rfq_list` on project `stnrfxrxfonwexzcvvpv`
// (read-only, 20 Sep 2026) by the queries in the evidence bundle's
// `sql/README.md`, with only the keys the kit never reads dropped. This file
// compares **every field the kit reads, in every row** against it.
//
// The cycle-7 version compared row *counts*, and three fixtures were carrying
// `hscodes: []` over records whose EPB page holds 14, 34 and 18 lines — with
// `hsLines: 0` recorded in its own table as production's number. A count is
// not a reconciliation, and a guard that restates the fixture certifies
// whatever the fixture says.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { ProfilePayload, RecordInput } from "./build-models";
import { sourceMark } from "./source-tiers";
import {
  aboniInput,
  ABONI_NEW_SHED,
  AMAN_EXTENSION,
  arFashionInput,
  ASWAD_U2,
  ASWAD_U2_EXT,
  ASWAD_UNIT_1,
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
  RFQ_ROWS,
  RFQ_TARGETS,
  sanctionedInput,
  smKnitwearInput,
  SM_EXTENSION,
  SQ_UNIT_04,
  SQ_UNIT_3,
  zaheenSampleInput,
  ZAHEEN_NAME,
} from "./fixtures";

type Json = Record<string, unknown>;

const PRODUCTION = JSON.parse(
  readFileSync(path.join(process.cwd(), "lib/dashboard/fixtures.production.json"), "utf8"),
) as Record<string, Json>;

/**
 * Every field of the payload the kit reads. A field missing from this list is
 * a field the reconciliation does not cover, so the list is the contract — it
 * mirrors `ProfilePayload`, `ProfilePill`, `ProfileCert`, `ProfileBrand`,
 * `HsLine` and `RfqListRow` in `build-models.ts`.
 */
const FIELDS = {
  supplier: [
    "id", "slug", "company_name", "entity_type", "city", "district", "address_raw",
    "is_sanctioned", "parent_group_name", "established_date", "factory_types",
    "principal_products", "employees_total", "machines_sewing",
    "production_capacity_pcs_day", "production_capacity_dozen_yearly",
    "supplier_moq", "supplier_lead_time_days", "source_tags",
  ],
  pills: ["source_code", "label", "value", "source_url", "building_name", "inherited_from", "inherited_from_name"],
  certifications: ["kind", "certificate_no", "issuer", "issued_on", "expires_on", "scope", "document_url", "building_name"],
  brand_attributions: ["source_code", "display_name", "source_url", "last_seen_at", "building_name"],
  provenance: ["tier", "source_code", "display_name", "source_url", "source_ref", "last_seen_at"],
  addresses: ["kind", "address", "source_code", "fetched_at"],
  rsc_remediation: [
    "building_name", "progress_pct", "workers_count", "remediation_status", "training_status",
    "fetched_at", "fire_inspection_url", "structural_inspection_url", "electrical_inspection_url",
    "boiler_inspection_url", "cap_url",
  ],
  hscodes: ["code", "description", "source_url"],
  rfq: ["id", "product_title", "quantity", "quantity_unit", "ship_by", "status", "target_supplier_count", "quote_count", "created_at"],
} as const;

/** `undefined`, a missing key and JSON `null` all mean "the RPC returned nothing here". */
function pick(row: unknown, fields: readonly string[]): Json {
  const r = (row ?? {}) as Json;
  const out: Json = {};
  for (const f of fields) out[f] = r[f] ?? null;
  return out;
}

function pickAll(rows: unknown, fields: readonly string[]): Json[] {
  return (Array.isArray(rows) ? rows : []).map((r) => pick(r, fields));
}

/**
 * Where a fixture cannot be reconciled, and why.
 *
 * §2 allows a state the screens must render to be composed from real rows when
 * production holds no record in that state, and requires it to say so. Both
 * entries here are records `buyer_supplier_profile` serves nothing for,
 * because it serves published records only.
 */
const COMPOSED: Record<string, string> = {
  // `v_supplier_registry_ids` lends a published parent factory's rows to a
  // satellite. The pills are the parent's own rows from
  // `v_supplier_registry_ids_direct`, verbatim, with the view's own
  // " (parent factory)" suffix and `inherited_from` set.
  "ab-apparels-ltd-extension": "unpublished: the parent's five non-RSC rows, lent as the view would lend them",
  "indochine-apparel-bangladesh-limited-plot-54-56-previously-baxter-brenton-bd-clothing-manufacturing-co-ltd-extension":
    "unpublished: the fields are the `suppliers` row's own, plus its one BRAND_MS `source_record`",
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

describe("every fixture is the payload production returns, field by field", () => {
  for (const { name, input } of FIXTURES) {
    const slug = input.profile.supplier.slug;
    const composed = COMPOSED[slug];

    if (composed) {
      it(`${name} is composed, and says so: ${composed}`, () => {
        assert.equal(PRODUCTION[slug], undefined, `${slug} is in the production read, so reconcile it rather than declaring it composed`);
      });
      continue;
    }

    it(`${name} matches production's payload for ${slug}`, () => {
      const real = PRODUCTION[slug];
      assert.ok(real, `${name} renders "${slug}", which the production read does not cover`);
      const p: ProfilePayload = input.profile;
      assert.deepEqual(pick(p.supplier, FIELDS.supplier), pick(real.supplier, FIELDS.supplier), "supplier");
      for (const section of ["pills", "certifications", "brand_attributions", "provenance", "addresses"] as const) {
        const mine = pickAll((p as unknown as Json)[section], FIELDS[section]);
        const theirs = pickAll(real[section], FIELDS[section]);
        assert.equal(mine.length, theirs.length, `${section}: ${mine.length} rows in the fixture, ${theirs.length} in production`);
        assert.deepEqual(mine, theirs, section);
      }
      // A null `rsc_remediation` is not the same fact as an empty list.
      assert.equal(p.rsc_remediation === null, real.rsc_remediation === null, "rsc_remediation: null vs a list");
      assert.deepEqual(pickAll(p.rsc_remediation, FIELDS.rsc_remediation), pickAll(real.rsc_remediation, FIELDS.rsc_remediation), "rsc_remediation");
      assert.equal(p.t13_source_count, real.t13_source_count, "t13_source_count");
      // The three fixtures that carried `hscodes: []` over 14, 34 and 18 real
      // EPB lines are why this compares the lines and not their number.
      assert.deepEqual(pickAll(input.hscodes, FIELDS.hscodes), pickAll(real.hscodes, FIELDS.hscodes), "hscodes");
    });
  }

  it("the composed fixtures are the two records production has not published", () => {
    const composed = FIXTURES.filter((f) => COMPOSED[f.input.profile.supplier.slug]).map((f) => f.name);
    assert.deepEqual(composed.sort(), ["inheritedPillsInput", "longestNameInput"]);
    assert.equal(Object.keys(COMPOSED).length, 2, "a third composed fixture needs its reason written down here");
  });

  it("every record in the production read is reconciled by a fixture", () => {
    const rendered = new Set(FIXTURES.map((f) => f.input.profile.supplier.slug));
    for (const slug of Object.keys(PRODUCTION)) {
      if (slug.startsWith("__")) continue;
      assert.ok(rendered.has(slug), `the read covers ${slug}, which no fixture uses — delete it or use it`);
    }
  });

  it("the read says when and where it was taken", () => {
    const read = PRODUCTION.__read as Json;
    assert.equal(read.project, "stnrfxrxfonwexzcvvpv");
    assert.match(String(read.date), /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("the RFQ rows are the ones rfq_list returns", () => {
  it("all seven, field by field, newest first", () => {
    assert.deepEqual(pickAll(RFQ_ROWS, FIELDS.rfq), pickAll(PRODUCTION.__rfq_list, FIELDS.rfq));
    const dates = RFQ_ROWS.map((r) => Date.parse(r.created_at));
    assert.deepEqual([...dates].sort((a, b) => b - a), dates, "rfq_list orders by created_at desc");
  });

  it("every row's target is named, and every named target belongs to a row", () => {
    assert.deepEqual(Object.keys(RFQ_TARGETS).sort(), RFQ_ROWS.map((r) => r.id).sort());
    for (const [id, t] of Object.entries(RFQ_TARGETS)) {
      assert.ok(t.name.trim().length > 0, `${id} has an empty target name`);
      assert.ok(t.tier >= 1 && t.tier <= 5, `${id} has no rank`);
    }
    // Every row targets exactly one supplier today, so one name per row is the
    // whole truth; when a row targets more, the count is what the screen says.
    for (const r of RFQ_ROWS) {
      assert.equal(r.target_supplier_count, 1, `${r.id} targets ${r.target_supplier_count}, so naming one is not the whole truth`);
    }
  });
});

describe("no fixture invents a fact about a named company", () => {
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
    "www.bgmea.com.bd", "www.bkmea.com", "member.bkmea.com", "bgapmea.org", "www.bgapmea.org",
    "edb.epb.gov.bd", "epb.gov.bd", "www.rsc-bd.org", "rsc-bd.org", "accord2.fairfactories.org",
    "www.global-trace-base.org", "global-standard.org", "services.oeko-tex.com", "www.oeko-tex.com",
    "wrapcompliance.org", "opensupplyhub.org", "hmgroup.com", "www.asosplc.com", "www.nextplc.co.uk",
  ]);

  for (const { name, input } of FIXTURES) {
    it(`${name} links only to hosts production's rows use`, () => {
      for (const { where, url } of urls(input)) {
        assert.match(url, /^https:\/\//, `${name} ${where} is not an https URL: ${url}`);
        assert.ok(HOSTS.has(new URL(url).host), `${name} ${where} points at ${new URL(url).host}, which no production row uses: ${url}`);
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
    // `select count(*) from suppliers where is_sanctioned` was 0 on 20 Sep 2026.
    const sample = zaheenSampleInput();
    assert.equal(sample.sanctionSample, true, "the gallery's sanctioned screen must say it is a sample");
    assert.equal(sample.profile.supplier.is_sanctioned, false);
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
    const exported = new Set([HOSSAIN_BUILDING, MG_BUILDING, SQ_UNIT_04, SQ_UNIT_3, ASWAD_U2, ASWAD_U2_EXT, ASWAD_UNIT_1, AMAN_EXTENSION, ABONI_NEW_SHED, SM_EXTENSION]);
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
        assert.notEqual(sourceMark(code).mark, "??", `${name} carries the source code "${code}", which the registry does not rank`);
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
