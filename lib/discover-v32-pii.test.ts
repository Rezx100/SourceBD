import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const SQL = readFileSync(
  path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"),
  "utf8",
);

/**
 * Every column `discover_suppliers` is allowed to return. This is an
 * allowlist, deliberately, and it is the whole point of the guard: a denylist
 * of four contact-column names only catches those four names. Adding
 * `primary_contact`, `contact_email` or `mobile` to the return type sailed
 * straight past the old check. Under an allowlist, ANY new column fails this
 * test until a person adds it here — which is the moment to ask whether it is
 * contact data.
 */
const ALLOWED_RETURN_COLUMNS = new Set([
  "id",
  "slug",
  "company_name",
  "entity_type",
  "city",
  "district",
  "source_tags",
  "t13_source_count",
  "completeness_pct",
  "employees_total",
  "established_date",
  "principal_products",
  "factory_types",
  "rsc_progress_pct",
  "parent_group_name",
  // A factory's street address is public register data and already renders on
  // the Locations tab. It is not contact data in the sense this guard protects
  // (a way to reach a named person and bypass the platform).
  "primary_address",
  "total_count",
  "is_sanctioned",
  "cert_summary",
  "hs_codes",
  "brand_codes",
  "registries",
  "top_tier",
]);

/** Column-name shapes that must never appear, whatever the allowlist says. */
const CONTACT_SHAPE = /(email|phone|mobile|contact|whatsapp|telephone|msisdn)/i;

function returnColumnsOf(fn: string): string[] {
  const match = SQL.match(
    new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?returns table \\(([\\s\\S]*?)\\)\\s*language`),
  );
  assert.ok(match && match[1], `${fn} returns table not found`);
  return match[1]!
    .split(/,\s*\n/)
    .map((line) => line.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

describe("0104 discover_suppliers PII guard", () => {
  it("returns only allowlisted columns, and none shaped like contact data", () => {
    const cols = returnColumnsOf("discover_suppliers");
    assert.ok(cols.length > 5, `parsed too few columns: ${JSON.stringify(cols)}`);
    for (const col of cols) {
      assert.doesNotMatch(col, CONTACT_SHAPE, `${col} looks like contact data`);
      assert.ok(
        ALLOWED_RETURN_COLUMNS.has(col),
        `${col} is not on the allowlist — if it is not contact data, add it deliberately`,
      );
    }
    for (const required of ["is_sanctioned", "cert_summary", "hs_codes"]) {
      assert.ok(cols.includes(required), `${required} missing from the return type`);
    }
  });

  it("the explain variant leaks nothing either", () => {
    for (const col of returnColumnsOf("discover_suppliers_explain")) {
      assert.doesNotMatch(col, CONTACT_SHAPE, `${col} looks like contact data`);
    }
  });

  it("an admin-rejected certificate reaches neither the summary nor the filter", () => {
    // 0039 rejects a certificate by soft-deleting it (`rejected_at` set, with
    // a reason) and keeps the row. Neither the cert summary nor the cert
    // filter excluded those rows, so a forged certificate an admin had
    // rejected still rendered to buyers as a green "valid to <date>" chip,
    // and `?cert=gots:valid` still returned that supplier. Both readers of
    // `public.certifications` in this migration must exclude them.
    const readers = SQL.split(/from public\.certifications\b/).slice(1);
    assert.equal(readers.length, 3, `expected 3 readers of certifications, found ${readers.length}`);
    for (const [i, body] of readers.entries()) {
      // The predicate must appear before the statement's own terminator.
      const clause = body.split(/;\s*$/m)[0] ?? body;
      assert.match(
        clause,
        /rejected_at is null/,
        `certifications reader #${i + 1} does not exclude admin-rejected rows`,
      );
    }
  });

  it("HS helpers reuse the 0103 EPB source_records pattern, not a table", () => {
    assert.match(SQL, /supplier_epb_hscodes_batch/);
    assert.match(SQL, /hs_catalogue\(\)/);
    assert.match(SQL, /discover_suppliers_explain/);
    assert.match(SQL, /epb_record_is_foreign_to_host/);
    assert.match(SQL, /fields->'epb_hscodes'/);
    assert.match(SQL, /left\(btrim\(hs\.elem->>'code'\), 4\)/);
    assert.doesNotMatch(SQL, /create table\s+.*hscode/i);
  });

  it("the /app/match redirect is issued by middleware, not by the page alone", () => {
    // This test used to grep the page source for `redirect("/app/discover?ask=1")`
    // and passed — while the route served HTTP 200 and no Location header,
    // because the async `(app)` layout had already begun streaming by the time
    // the page ran. Source text is not behaviour. The status itself is asserted
    // in scripts/test-profile-http-boundary.mjs ("rez-b: /app/match redirects");
    // what this pins is that the redirect lives where it can still set a status.
    const mw = readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");
    assert.match(mw, /pathname === "\/app\/match"/);
    assert.match(mw, /redirectOnSite\("\/app\/discover",\s*"\?ask=1",\s*307\)/);
  });
});
