/**
 * REZ-73 — facility group roll-up for the mother profile (widened scope:
 * separate labelled figures, never one combined total).
 *
 * Mirrors the six acceptance cases of etl/tests/test_facility_rollup.py
 * (REZ-92) against the live web-side computation, plus the migration
 * containment pins for the 20260808_rez73 facilities payload. No database.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  FACILITIES_PROFILE_MIGRATION,
  assertFacilitiesContainment,
  describeGroupMetric,
  hasDynamicExecuteOfPinnedObject,
  projectFacilityGroup,
  type FacilityRollupBuilding,
  type FacilityRollupOwn,
} from "./facility-rollup";

function own(overrides: Partial<FacilityRollupOwn> = {}): FacilityRollupOwn {
  return {
    employees_total: 2000,
    machines_sewing: 100,
    production_capacity_pcs_day: 10_000,
    production_capacity_dozen_yearly: 50_000,
    ...overrides,
  };
}

function facility(
  name: string,
  overrides: Partial<FacilityRollupBuilding> = {},
): FacilityRollupBuilding {
  return {
    name,
    employees_total: 1000,
    machines_sewing: 50,
    production_capacity_pcs_day: 5_000,
    production_capacity_dozen_yearly: 20_000,
    ...overrides,
  };
}

describe("projectFacilityGroup", () => {
  it("with no facilities the group figure equals the mother's own (py #1)", () => {
    const proj = projectFacilityGroup(own({ employees_total: 2000 }), []);
    assert.equal(proj.facilityCount, 0);
    const m = proj.metrics.employees_total;
    assert.equal(m.own, 2000);
    assert.equal(m.knownSum, 2000);
    assert.equal(m.unknownCount, 0);
    assert.equal(m.isLowerBound, false);
    assert.equal(describeGroupMetric(m), "2,000");
  });

  it("sums the mother and two facilities arithmetically (py #2)", () => {
    const proj = projectFacilityGroup(own(), [
      facility("A (Extension)", { employees_total: 1500, machines_sewing: 40 }),
      facility("B (Unit-2)", { employees_total: 1700, machines_sewing: 60 }),
    ]);
    assert.equal(proj.facilityCount, 2);
    assert.equal(proj.metrics.employees_total.knownSum, 2000 + 1500 + 1700);
    assert.equal(proj.metrics.machines_sewing.knownSum, 100 + 40 + 60);
    // The headline own figure is never the sum.
    assert.equal(proj.metrics.employees_total.own, 2000);
    assert.equal(proj.metrics.employees_total.isLowerBound, false);
    assert.equal(
      describeGroupMetric(proj.metrics.employees_total),
      "5,200 across 3 buildings",
    );
  });

  it("treats a null facility figure as unknown, never zero (py #3)", () => {
    const proj = projectFacilityGroup(own(), [
      facility("Known (Extension)", { employees_total: 1500 }),
      facility("Unknown (Extension)", { employees_total: null }),
    ]);
    const m = proj.metrics.employees_total;
    assert.equal(m.knownSum, 3500);
    assert.equal(m.unknownCount, 1);
    assert.equal(m.knownCount, 2);
    assert.equal(m.isLowerBound, true);
    assert.equal(
      describeGroupMetric(m),
      "at least 3,500 across 3 buildings, 1 unknown",
    );
  });

  it("keeps the mother's own columns byte-identical (py #5)", () => {
    const before = own();
    const snapshot = { ...before };
    const proj = projectFacilityGroup(before, [
      facility("A (Extension)", { employees_total: 500 }),
    ]);
    assert.deepEqual(before, snapshot);
    for (const column of Object.keys(snapshot) as (keyof FacilityRollupOwn)[]) {
      assert.equal(proj.metrics[column].own, snapshot[column]);
    }
  });

  it("reports every building unknown without inventing a total (py all-unknown)", () => {
    const proj = projectFacilityGroup(own({ employees_total: null }), [
      facility("A (Extension)", { employees_total: null }),
      facility("B (Extension)", { employees_total: null }),
    ]);
    const m = proj.metrics.employees_total;
    assert.equal(m.knownSum, null);
    assert.equal(m.unknownCount, 3);
    assert.equal(m.isLowerBound, false);
    assert.equal(
      describeGroupMetric(m),
      "unknown across 3 buildings, 3 unknown",
    );
  });

  it("handles a null own figure with known facility figures", () => {
    const proj = projectFacilityGroup(own({ machines_sewing: null }), [
      facility("A (Extension)", { machines_sewing: 40 }),
    ]);
    const m = proj.metrics.machines_sewing;
    assert.equal(m.own, null);
    assert.equal(m.knownSum, 40);
    assert.equal(m.isLowerBound, true);
    assert.equal(
      describeGroupMetric(m),
      "at least 40 across 2 buildings, 1 unknown",
    );
  });

  it("describes a single-building group without plural drift", () => {
    // buildingCount is always 1 + facilityCount; with one facility the
    // wording stays "across 2 buildings" — the mother counts as a building.
    const proj = projectFacilityGroup(own(), [facility("A (Extension)")]);
    assert.equal(proj.metrics.employees_total.buildingCount, 2);
    assert.equal(
      describeGroupMetric(proj.metrics.employees_total),
      "3,000 across 2 buildings",
    );
  });
});

describe("20260808_rez73 migration containment", () => {
  it("pins the facilities CTE shape, PII keys, and REZ-93 invariants", () => {
    // npm test runs from the repo root; compiled __dirname is a cache dir.
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), FACILITIES_PROFILE_MIGRATION),
      "utf8",
    );
    assert.doesNotThrow(() => assertFacilitiesContainment({ migrationSql }));
  });

  it("rejects concat / dollar-quote / mixed-case / value-side / string-paren leak vectors", () => {
    const base = fs.readFileSync(
      path.join(process.cwd(), FACILITIES_PROFILE_MIGRATION),
      "utf8",
    );
    const rscAnchor = /'rsc',\s*fr\.obj/;
    assert.match(base, rscAnchor, "migration must contain the rsc key anchor");
    const inject = (keyExpr: string) => {
      const out = base.replace(rscAnchor, `'rsc', fr.obj, ${keyExpr}, f.slug`);
      assert.notEqual(out, base, `inject of ${keyExpr} must modify the SQL`);
      return out;
    };
    for (const [label, expr] of [
      ["concat", "('slu' || 'g')"],
      ["dollar", "$k$slug$k$"],
      ["mixed-case", "'Slug'"],
      ["source_ref literal", "'source_ref'"],
      ["sbi_total literal", "'sbi_total'"],
      ["display_name after string paren", "'display_name'"],
    ] as const) {
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: inject(expr) }),
        /forbidden key|lowercase snake literal|sbi_|exactly|value for/i,
        `${label} key expression must fail containment`,
      );
    }
    // `)` inside a string value must not truncate the extract.
    const stringParen = base.replace(rscAnchor, `'rsc', 'x)', 'display_name', f.slug`);
    assert.notEqual(stringParen, base);
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: stringParen }),
      /forbidden key|exactly|value for|lowercase snake literal/i,
      "')' inside a string value must not truncate containment",
    );
    // Value-side identity under an allowed key.
    const nameSlug = base.replace(
      /'name',\s*f\.company_name/,
      "'name', f.company_name || f.slug",
    );
    assert.notEqual(nameSlug, base);
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: nameSlug }),
      /value for 'name'|exactly/i,
      "name || slug must fail the exact-value pin",
    );
    const idAsEmployees = base.replace(
      /'employees_total',\s*f\.employees_total/,
      "'employees_total', f.id",
    );
    assert.notEqual(idAsEmployees, base);
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: idAsEmployees }),
      /value for 'employees_total'|exactly/i,
      "f.id as employees_total must fail the exact-value pin",
    );
    // Block-comment forged ORDER BY must not satisfy the pin.
    const fakeOrder = base.replace(
      /jsonb_agg\(fac\.obj order by fac\.facility_name, fac\.facility_id\)/,
      "jsonb_agg(fac.obj order by fac.facility_id) /* jsonb_agg(fac.obj order by fac.facility_name, fac.facility_id) */",
    );
    assert.notEqual(fakeOrder, base);
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: fakeOrder }),
      /jsonb_agg must order by fac\.facility_name|clause missing/i,
      "block-comment ORDER BY must not satisfy the pin",
    );
    // Quote-split decoy: `/* ' */ ... /* ' */` must not resurrect a stripped order.
    const quoteDecoy = base.replace(
      /jsonb_agg\(fac\.obj order by fac\.facility_name, fac\.facility_id\)/,
      "jsonb_agg(fac.obj order by fac.facility_id) /* ' */ jsonb_agg(fac.obj order by fac.facility_name, fac.facility_id) /* ' */",
    );
    assert.notEqual(quoteDecoy, base);
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: quoteDecoy }),
      /jsonb_agg must order by fac\.facility_name|clause missing/i,
      "quote-split ORDER BY decoy must not satisfy the pin",
    );
    // Inner value-side identity under allowed keys (facilities CTE only —
    // the mother addresses CTE also has 'address', va.address).
    const facSlice = (sql: string) => {
      const a = sql.indexOf("facilities as (");
      const b = sql.indexOf("partner_factories as (");
      return { a, b, mid: sql.slice(a, b) };
    };
    for (const [label, from, to] of [
      ["address||slug", /'address',\s*va\.address/, "'address', va.address || f.slug"],
      ["label=slug", /'label',\s*p\.label/, "'label', f.slug"],
      ["value=id", /'value',\s*p\.value/, "'value', f.id::text"],
      ["source_url||slug", /'source_url',\s*p\.source_url/, "'source_url', p.source_url || f.slug"],
      ["workers_count=id", /'workers_count',\s*rr\.workers_count/, "'workers_count', f.id"],
    ] as const) {
      const { a, b, mid } = facSlice(base);
      assert.ok(from.test(mid), `${label} must exist in facilities CTE`);
      const poisoned =
        base.slice(0, a) + mid.replace(from, to) + base.slice(b);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: poisoned }),
        /inner|value for/i,
        `${label} must fail inner exact-value pin`,
      );
    }
  });

  it("pins the full definer set of every object 20260808 recreates", () => {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const normalize = (sql: string) =>
      sql
        .replace(/"public"/gi, "public")
        .replace(/"(buyer_supplier_profile)"/gi, "$1")
        .replace(/"(v_supplier_addresses_direct)"/gi, "$1")
        .replace(/"(v_supplier_addresses)"/gi, "$1");
    const definersOf = (pattern: RegExp) =>
      files.filter((f) =>
        pattern.test(
          normalize(fs.readFileSync(path.join(migrationsDir, f), "utf8")),
        ),
      );
    const LIVE = "20260808_rez73_buyer_supplier_profile_facilities.sql";
    const expected: Record<string, string[]> = {
      "public.buyer_supplier_profile": [
        "0024_buyer_supplier_profile_rpc.sql",
        "0034_supplier_profile_editor.sql",
        "0036_supplier_relationships.sql",
        "0079_buyer_supplier_profile_strip_address_pii.sql",
        "0095_buyer_supplier_profile_facility_documents.sql",
        "20260725_rez_security_hardening_2.sql",
        LIVE,
      ],
      "public.v_supplier_addresses_direct": [
        "0014_rsc_inherited_addresses.sql",
        "0015_btma_address_branches.sql",
        "0016_bgapmea_address_branches.sql",
        "0017_epb_address_branches.sql",
        "0018_oeko_profile_address_branch.sql",
        "0082_supplier_pii_hardening.sql",
        LIVE,
      ],
      "public.v_supplier_addresses": [
        "0004_supplier_address_views.sql",
        "0014_rsc_inherited_addresses.sql",
        "0015_btma_address_branches.sql",
        "0016_bgapmea_address_branches.sql",
        "0017_epb_address_branches.sql",
        "0018_oeko_profile_address_branch.sql",
        "0057_perf_hotfix_inheritance_views_rewrite.sql",
        "0058_revert_inheritance_views_to_lateral.sql",
        "0082_supplier_pii_hardening.sql",
        LIVE,
      ],
    };
    const patterns: [string, RegExp][] = [
      [
        "public.buyer_supplier_profile",
        /create(?:\s+or\s+replace)?\s+function\s+public\.buyer_supplier_profile/i,
      ],
      [
        "public.v_supplier_addresses_direct",
        /create(?:\s+or\s+replace)?\s+view\s+public\.v_supplier_addresses_direct/i,
      ],
      [
        "public.v_supplier_addresses",
        /create(?:\s+or\s+replace)?\s+view\s+public\.v_supplier_addresses\b/i,
      ],
    ];
    for (const [objectName, pattern] of patterns) {
      const got = definersOf(pattern);
      assert.deepEqual(
        got,
        [...(expected[objectName] ?? [])].sort(),
        `${objectName} definers changed — if you added a migration recreating ` +
          `it, state which body is live and update this pin`,
      );
    }
    // Fail closed on dynamic EXECUTE of pinned objects (format / $ / ' / var).
    // GRANT EXECUTE and trigger EXECUTE FUNCTION are not dynamic.
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), "utf8");
      assert.ok(
        !hasDynamicExecuteOfPinnedObject(sql),
        `${f} dynamically EXECUTEs a pinned object — add an explicit CREATE ` +
          `and update the definer-set pin`,
      );
    }
    // Probes for the vectors the old format()-only pin missed.
    for (const [label, snippet] of [
      ["dollar", "EXECUTE $$CREATE OR REPLACE FUNCTION public.buyer_supplier_profile()$$"],
      ["E-string", "EXECUTE E'CREATE OR REPLACE FUNCTION public.buyer_supplier_profile()'"],
      ["concat", "EXECUTE 'CREATE OR REPLACE FUNCTION public.' || 'buyer_supplier_profile()'"],
      ["var-name", "EXECUTE dyn_buyer_supplier_profile_stmt;"],
      [
        "opaque-assign",
        "stmt := 'CREATE OR REPLACE FUNCTION public.buyer_supplier_profile()'; EXECUTE stmt;",
      ],
      [
        "select-into",
        "select format('CREATE OR REPLACE FUNCTION public.buyer_supplier_profile()') into stmt; execute stmt;",
      ],
      [
        "perform-format",
        "PERFORM format('CREATE OR REPLACE FUNCTION public.buyer_supplier_profile()');",
      ],
      [
        "digit-dollar",
        "EXECUTE $e1$CREATE OR REPLACE FUNCTION public.buyer_supplier_profile()$e1$;",
      ],
      [
        "convert-from",
        "EXECUTE convert_from(decode('Ym95ZXI=', 'base64'), 'utf8');",
      ],
      [
        "format-fragments",
        "EXECUTE format('%s%s%s', 'buyer_', 'supplier_', 'profile');",
      ],
      [
        "concat-fragments",
        "EXECUTE concat('buyer_', 'supplier_', 'profile');",
      ],
      [
        "replace-assemble",
        "EXECUTE replace('buyerXsupplier_profile', 'X', '_');",
      ],
      [
        "quote-ident-assemble",
        "EXECUTE 'ALTER FUNCTION ' || quote_ident('buyer_supplier_profile') || '()';",
      ],
      [
        "current-setting",
        "EXECUTE current_setting('app.ddl');",
      ],
      [
        "convert-from-assign",
        "stmt := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); EXECUTE stmt;",
      ],
      [
        "convert-from-format-pct",
        "stmt := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); EXECUTE format('%s', stmt);",
      ],
      [
        "convert-from-format-var",
        "stmt := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); EXECUTE format(stmt);",
      ],
      [
        "convert-from-concat",
        "stmt := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); EXECUTE stmt || '';",
      ],
      [
        "convert-from-concat-fn",
        "stmt := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); EXECUTE concat(stmt, '');",
      ],
      [
        "convert-from-lower",
        "stmt := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); EXECUTE lower(stmt);",
      ],
      [
        "convert-from-alias-chain",
        "a := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); b := a; EXECUTE b;",
      ],
      [
        "convert-from-using",
        "stmt := convert_from(decode('Q1JFQVRF', 'base64'), 'utf8'); EXECUTE stmt USING 1;",
      ],
      [
        "convert-from-into-paren",
        "select convert_from(decode('Q1JFQVRF', 'base64'), 'utf8') into strict stmt; EXECUTE (stmt);",
      ],
      [
        "registry-view",
        "EXECUTE format('CREATE OR REPLACE VIEW public.v_supplier_registry_ids_direct AS SELECT 1');",
      ],
    ] as const) {
      assert.ok(
        hasDynamicExecuteOfPinnedObject(snippet),
        `${label} EXECUTE vector must be detected`,
      );
    }
    assert.ok(
      !hasDynamicExecuteOfPinnedObject(
        "grant execute on function public.buyer_supplier_profile(text) to anon",
      ),
      "GRANT EXECUTE must not trip the dynamic pin",
    );
    assert.ok(
      !hasDynamicExecuteOfPinnedObject(
        "for each row execute function public.enforce_facility_parent_is_company()",
      ),
      "trigger EXECUTE FUNCTION must not trip the dynamic pin",
    );
  });

  it("rejects decoy-first poisoned facilities objects and ORDER BY", () => {
    const base = fs.readFileSync(
      path.join(process.cwd(), FACILITIES_PROFILE_MIGRATION),
      "utf8",
    );
    const facSlice = (sql: string) => {
      const a = sql.indexOf("facilities as (");
      const b = sql.indexOf("partner_factories as (");
      return { a, b, mid: sql.slice(a, b) };
    };
    // Correct inner address object decoy, then poison the live value.
    {
      const { a, b, mid } = facSlice(base);
      const decoy =
        "jsonb_build_object('kind', va.address_kind, 'address', va.address, " +
        "'source_code', va.source_code, 'fetched_at', va.fetched_at), ";
      const poisonedLive = mid.replace(
        /'address',\s*va\.address/,
        "'address', va.address || f.slug",
      );
      const withDecoy = poisonedLive.replace(
        /jsonb_build_object\(\s*'kind'/i,
        decoy + "jsonb_build_object('kind'",
      );
      const poisoned = base.slice(0, a) + withDecoy + base.slice(b);
      assert.notEqual(poisoned, base);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: poisoned }),
        /shape|inner|value for 'address'|exactly/i,
        "decoy-first poisoned address must fail",
      );
    }
    // Correct name-object decoy, then live object with different first key + slug.
    {
      const { a, b, mid } = facSlice(base);
      const nameObj =
        /jsonb_build_object\(\s*'name',\s*f\.company_name[\s\S]*?fr\.obj\s*\)/i.exec(
          mid,
        );
      assert.ok(nameObj, "must find facilities name object");
      const liveAlt =
        "jsonb_build_object('display_name', f.company_name || f.slug, " +
        "'employees_total', f.employees_total, 'machines_sewing', f.machines_sewing, " +
        "'production_capacity_pcs_day', f.production_capacity_pcs_day, " +
        "'production_capacity_dozen_yearly', f.production_capacity_dozen_yearly, " +
        "'is_sanctioned', f.is_sanctioned, " +
        "'addresses', coalesce(fa.items, '[]'::jsonb), " +
        "'pills', coalesce(fp.items, '[]'::jsonb), 'rsc', fr.obj)";
      const poisoned =
        base.slice(0, a) +
        mid.replace(nameObj[0]!, nameObj[0]! + ", " + liveAlt) +
        base.slice(b);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: poisoned }),
        /first key must be name\|kind|display_name/i,
        "decoy name + live display_name||slug must fail",
      );
    }
    // Correct name-object decoy, then reordered live object with poisoned name.
    {
      const { a, b, mid } = facSlice(base);
      const nameObj =
        /jsonb_build_object\(\s*'name',\s*f\.company_name[\s\S]*?fr\.obj\s*\)/i.exec(
          mid,
        );
      assert.ok(nameObj);
      const liveAlt =
        "jsonb_build_object('is_sanctioned', f.is_sanctioned, " +
        "'name', f.company_name || f.slug, " +
        "'employees_total', f.employees_total, 'machines_sewing', f.machines_sewing, " +
        "'production_capacity_pcs_day', f.production_capacity_pcs_day, " +
        "'production_capacity_dozen_yearly', f.production_capacity_dozen_yearly, " +
        "'addresses', coalesce(fa.items, '[]'::jsonb), " +
        "'pills', coalesce(fp.items, '[]'::jsonb), 'rsc', fr.obj)";
      const poisoned =
        base.slice(0, a) +
        mid.replace(nameObj![0]!, nameObj![0]! + ", " + liveAlt) +
        base.slice(b);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: poisoned }),
        /first key must be name\|kind|is_sanctioned/i,
        "decoy name + reordered live object must fail",
      );
    }
    // Correct ORDER BY decoy in a string, live agg wrong.
    {
      const fakeOrder = base.replace(
        /jsonb_agg\(fac\.obj order by fac\.facility_name, fac\.facility_id\)/,
        "jsonb_agg(fac.obj order by fac.facility_id) /* keep */, " +
          "'decoy', $ord$jsonb_agg(fac.obj order by fac.facility_name, fac.facility_id)$ord$",
      );
      assert.notEqual(fakeOrder, base);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: fakeOrder }),
        /jsonb_agg must order by fac\.facility_name|clause missing|forbidden key|exactly|first key/i,
        "string-literal ORDER BY decoy must not satisfy the pin",
      );
    }
    // Correct ORDER BY clause first, then a live wrong agg also matching fac.obj.
    {
      const dual = base.replace(
        /jsonb_agg\(fac\.obj order by fac\.facility_name, fac\.facility_id\)/,
        "jsonb_agg(fac.obj order by fac.facility_name, fac.facility_id), " +
          "jsonb_agg(fac.obj order by fac.facility_id)",
      );
      assert.notEqual(dual, base);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: dual }),
        /jsonb_agg must order by fac\.facility_name/i,
        "decoy-correct then poisoned ORDER BY must fail",
      );
    }
    // Donor/recipient gates: exact conjuncts on blanked code — OR-widen and
    // string decoys must fail.
    {
      const a = base.indexOf("create or replace view public.v_supplier_addresses as");
      const b = base.indexOf("v_supplier_registry_ids_direct as");
      assert.ok(a >= 0 && b > a);
      const mid = base.slice(a, b);
      for (const [label, from, to, pat] of [
        [
          "parent or-true",
          /^(\s*)and parent\.is_published = true\s*$/m,
          "$1and parent.is_published = true or true",
          /donor|parent\.is_published|OR/i,
        ],
        [
          "parent true-or",
          /^(\s*)and parent\.is_published = true\s*$/m,
          "$1and true or parent.is_published = false and parent.is_published = true",
          /donor|parent\.is_published|OR/i,
        ],
        [
          "child or-true",
          /^(\s*)and child\.is_published = true\b.*$/m,
          "$1and child.is_published = true or true",
          /recipient|child\.is_published|OR/i,
        ],
        [
          "parent comment-out",
          /^(\s*)and parent\.is_published = true\s*$/m,
          "$1-- and parent.is_published = true",
          /donor|parent\.is_published/i,
        ],
        [
          "parent string-decoy",
          /^(\s*)and parent\.is_published = true\s*$/m,
          "$1-- removed\n   , 'and parent.is_published = true join public.v_supplier_addresses_direct' as decoy",
          /donor|parent\.is_published|join parent/i,
        ],
      ] as const) {
        const poisoned =
          base.slice(0, a) + mid.replace(from, to) + base.slice(b);
        assert.throws(
          () => assertFacilitiesContainment({ migrationSql: poisoned }),
          pat,
          `${label} must fail`,
        );
      }
    }
  });

  it("pins the facility→facility parent refusal trigger body", () => {
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), FACILITIES_PROFILE_MIGRATION),
      "utf8",
    );
    assert.doesNotThrow(() => assertFacilitiesContainment({ migrationSql }));

    const swapTrigger = (body: string) =>
      migrationSql.replace(
        /create or replace function public\.enforce_facility_parent_is_company\(\)[\s\S]*?\$\$;/,
        () =>
          "create or replace function public.enforce_facility_parent_is_company()\n" +
          "returns trigger language plpgsql set search_path = public as $$\n" +
          body +
          "\n$$;",
      );

    const goodLocks =
      "  perform 1 from public.suppliers p where p.id = new.facility_of for update;\n" +
      "  perform 1 from public.suppliers c where c.facility_of = new.id for update;\n";
    const goodExists =
      "  if exists (\n" +
      "    select 1 from public.suppliers p\n" +
      "     where p.id = new.facility_of and p.facility_of is not null\n" +
      "  ) then\n" +
      "    raise exception 'x' using errcode = 'check_violation';\n" +
      "  end if;\n" +
      "  if exists (\n" +
      "    select 1 from public.suppliers c where c.facility_of = new.id\n" +
      "  ) then\n" +
      "    raise exception 'y' using errcode = 'check_violation';\n" +
      "  end if;\n";

    const hollow = swapTrigger(
      "begin\n" +
        "  -- p.facility_of is not null\n" +
        "  -- c.facility_of = new.id\n" +
        "  -- for update\n" +
        "  return new;\n" +
        "end;",
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: hollow }),
      /PERFORM|EXISTS|RAISE|FOR UPDATE|constant-false|ERRCODE|wrap each refusal|exactly two/i,
      "comment-only trigger must fail",
    );

    const stringOnly = swapTrigger(
      "begin\n" +
        "  raise exception 'for update p.facility_of is not null c.facility_of = new.id';\n" +
        "  return new;\n" +
        "end;",
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: stringOnly }),
      /PERFORM|EXISTS|RAISE|FOR UPDATE|ERRCODE|wrap each refusal|exactly two/i,
      "string-literal-only trigger tokens must fail",
    );

    for (const [label, wrapper] of [
      ["if false", "if false then\n%s\n  end if;\n"],
      ["if true and false", "if true and false then\n%s\n  end if;\n"],
      [
        "if facility_of and false",
        "if new.facility_of is not null and false then\n%s\n  end if;\n",
      ],
      [
        "if facility_of or true",
        "if new.facility_of is not null or true then\n%s\n  end if;\n",
      ],
      [
        "if exists where false",
        "if exists (select 1 where false) then\n%s\n  end if;\n",
      ],
      ["if 0 <> 0", "if 0 <> 0 then\n%s\n  end if;\n"],
      ["elseif false", "if new.facility_of is not null then null; elseif false then\n%s\n  end if;\n"],
      ["case when false", "case when false then\n%s\n  else null; end case;\n"],
      ["while not true", "while not true loop\n%s\n  end loop;\n"],
      ["for 1..0", "for i in 1..0 loop\n%s\n  end loop;\n"],
    ] as const) {
      const body =
        "begin\n" +
        wrapper.replace("%s", goodLocks + goodExists) +
        "  return new;\nend;";
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: swapTrigger(body) }),
        /IF predicates|exactly|LOOP|WHILE|CASE|EXCEPTION|ELSEIF|ELSIF|ELSE|PERFORM|FOR UPDATE|wrap each refusal/i,
        `${label} dead-path PERFORM must fail`,
      );
    }

    {
      const start = migrationSql.indexOf(
        "create or replace function public.buyer_supplier_profile",
      );
      const asAt = migrationSql.indexOf("as $$", start);
      const widened =
        migrationSql.slice(0, start) +
        migrationSql
          .slice(start, asAt)
          .replace(
            /set\s+search_path\s*=\s*public/i,
            "set search_path = public, pg_temp",
          ) +
        migrationSql.slice(asAt);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: widened }),
        /search_path = public exactly/i,
        "widened search_path must fail",
      );
    }

    {
      const start = migrationSql.indexOf(
        "create or replace function public.buyer_supplier_profile",
      );
      const asMarker = "as $$";
      const asAt = migrationSql.indexOf(asMarker, start);
      assert.ok(start >= 0 && asAt > start);
      const bodyMut =
        migrationSql.slice(0, asAt + asMarker.length) +
        "\n  set local search_path = pg_temp, public;\n" +
        migrationSql.slice(asAt + asMarker.length);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: bodyMut }),
        /body must not SET search_path/i,
        "profile body SET search_path must fail",
      );
    }

    {
      const a = migrationSql.indexOf(
        "create or replace view public.v_supplier_addresses as",
      );
      const b = migrationSql.indexOf("v_supplier_registry_ids_direct as");
      assert.ok(a >= 0 && b > a);
      const mid = migrationSql.slice(a, b);
      const plainUnion = mid.replace(/\bunion all\b/i, "union");
      assert.notEqual(plainUnion, mid);
      assert.throws(
        () =>
          assertFacilitiesContainment({
            migrationSql: migrationSql.slice(0, a) + plainUnion + migrationSql.slice(b),
          }),
        /plain UNION|UNION ALL/i,
        "plain UNION inheritance branch must fail",
      );
      const donorAlias = mid.replace(
        /join public\.suppliers parent/i,
        "join public.suppliers donor",
      ).replace(/\bparent\./g, "donor.");
      assert.throws(
        () =>
          assertFacilitiesContainment({
            migrationSql:
              migrationSql.slice(0, a) + donorAlias + migrationSql.slice(b),
          }),
        /non-parent|parent→addresses_direct|parent\.is_published/i,
        "non-parent donor alias must fail",
      );
    }

    const injectedExecute = migrationSql +
      "\nEXECUTE format('CREATE OR REPLACE FUNCTION public.buyer_supplier_profile() RETURNS void AS $x$ SELECT 1 $x$');\n";
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: injectedExecute }),
      /dynamically EXECUTE|pinned object/i,
      "injected dynamic EXECUTE must fail containment",
    );

    const fragmentDo =
      migrationSql +
      "\nDO $$ BEGIN EXECUTE format('%s%s%s', 'buyer_', 'supplier_', 'profile'); END $$;\n";
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: fragmentDo }),
      /dynamically EXECUTE|pinned object/i,
      "DO format-fragment EXECUTE must fail containment",
    );

    {
      const start = migrationSql.indexOf(
        "create or replace function public.buyer_supplier_profile",
      );
      const asAt = migrationSql.indexOf("as $$", start);
      assert.ok(start >= 0 && asAt > start);
      const secDefComment =
        migrationSql.slice(0, start) +
        migrationSql
          .slice(start, asAt)
          .replace(/security\s+definer/i, "/* security definer */") +
        migrationSql.slice(asAt);
      assert.throws(
        () => assertFacilitiesContainment({ migrationSql: secDefComment }),
        /SECURITY DEFINER/i,
        "comment-only SECURITY DEFINER must fail",
      );
    }

    const ifFalseElseReturn = swapTrigger(
      "begin\n" +
        "  if false then\n" +
        "    null;\n" +
        "  else\n" +
        "    return new;\n" +
        "  end if;\n" +
        goodLocks +
        goodExists +
        "end;",
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: ifFalseElseReturn }),
      /ELSE|IF predicates|exactly|LOOP|WHILE|before any RETURN|PERFORM|wrap each refusal/i,
      "IF FALSE ELSE RETURN NEW then PERFORM must fail",
    );

    const missingOuters = swapTrigger(
      "begin\n" + goodLocks + goodExists + "  return new;\nend;",
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: missingOuters }),
      /wrap each refusal|exactly two/i,
      "trigger without outer facility_of IFs must fail",
    );

    const goodLive =
      "begin\n" +
      "  if new.facility_of is not null then\n" +
      "    perform 1 from public.suppliers p where p.id = new.facility_of for update;\n" +
      "    if exists (\n" +
      "      select 1 from public.suppliers p\n" +
      "       where p.id = new.facility_of and p.facility_of is not null\n" +
      "    ) then\n" +
      "      raise exception 'x' using errcode = 'check_violation';\n" +
      "    end if;\n" +
      "  end if;\n" +
      "  if new.facility_of is not null then\n" +
      "    perform 1 from public.suppliers c where c.facility_of = new.id for update;\n" +
      "    if exists (\n" +
      "      select 1 from public.suppliers c where c.facility_of = new.id\n" +
      "    ) then\n" +
      "      raise exception 'y' using errcode = 'check_violation';\n" +
      "    end if;\n" +
      "  end if;\n" +
      "  return new;\nend;";

    const aliasDo =
      migrationSql +
      "\nDO $$ BEGIN a := convert_from(decode('Q1JFQVRF','base64'),'utf8'); b := a; EXECUTE b; END $$;\n";
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: aliasDo }),
      /dynamically EXECUTE|pinned object/i,
      "DO alias-chain EXECUTE must fail containment",
    );

    const noRaise = swapTrigger(
      goodLive.replace(/raise exception[\s\S]*?;/gi, "null;"),
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: noRaise }),
      /RAISE|ERRCODE|EXISTS-check/i,
      "EXISTS without RAISE must fail",
    );

    const messageOnly = swapTrigger(
      goodLive
        .replace(
          /raise exception 'x' using errcode = 'check_violation';/g,
          "raise exception 'check_violation';",
        )
        .replace(
          /raise exception 'y' using errcode = 'check_violation';/g,
          "raise exception 'check_violation';",
        ),
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: messageOnly }),
      /USING ERRCODE|ERRCODE = 'check_violation'/i,
      "raise exception 'check_violation' message-only must fail",
    );

    const swallowed = swapTrigger(
      "begin\n" +
        "  begin\n" +
        goodLive.replace(/^begin\n/, "").replace(/\nend;$/, "") +
        "  exception when others then\n" +
        "    return new;\n" +
        "  end;\n" +
        "  return new;\nend;",
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: swallowed }),
      /catch exceptions|EXCEPTION|ELSE/i,
      "EXCEPTION WHEN OTHERS swallow must fail",
    );

    const earlyReturn = swapTrigger(
      "begin\n" +
        "  return null;\n" +
        goodLive.replace(/^begin\n/, "").replace(/\nend;$/, ""),
    );
    assert.throws(
      () => assertFacilitiesContainment({ migrationSql: earlyReturn }),
      /before any RETURN|PERFORM/i,
      "RETURN NULL before PERFORM must fail",
    );
  });
});
