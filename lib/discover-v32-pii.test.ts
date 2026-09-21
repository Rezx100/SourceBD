import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { savedSearchRedirectHref } from "./saved-searches";
import { urlOnSiteFromHref } from "./site-origin";

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

  it("the Registers tile reports the supplier's own registrations, not a parent's", () => {
    // `v_supplier_registry_ids` unions a PARENT factory's memberships onto RSC
    // sibling satellites (0021), marking them `inherited_from` so consumers do
    // not print them as the record's own. Reading it here made a satellite that
    // holds no BGMEA membership show "BGMEA" and match `?reg=BGMEA`. It also
    // unions `certifications` with no rejected filter, re-admitting certificates
    // an admin rejected as forged. The `_direct` view plus a register-code
    // restriction closes both.
    const readers = SQL.split(/from public\.v_supplier_registry_ids/).slice(1);
    assert.ok(readers.length >= 2, `expected the registries function and the filter, found ${readers.length}`);
    for (const [i, body] of readers.entries()) {
      assert.ok(
        body.startsWith("_direct"),
        `registry reader #${i + 1} reads the inherited view, so a parent's registrations print as the record's own`,
      );
      const clause = body.split(/;\s*$/m)[0] ?? body;
      assert.match(
        clause,
        /source_code in \('BGMEA', 'BKMEA', 'BGAPMEA', 'BTMA', 'EPB', 'RSC'\)/,
        `registry reader #${i + 1} is not restricted to registers, so certificate rows leak in as "registers"`,
      );
    }
  });

  it("the workers filter and sort stay on the register's own figure", () => {
    // Filtering and sorting on the group roll-up was tried and reverted: it
    // meant one `production_workers_display_batch` call per row, and
    // `discover_suppliers` is granted to `anon` and served by PostgREST
    // outside the app's rate limiter — an unauthenticated caller could force a
    // full-table roll-up per request. The display/filter difference is carried
    // by the labels instead ("workers on the register" vs a card figure that
    // names its own coverage), so the query must stay cheap.
    assert.doesNotMatch(
      SQL,
      /discover_v32_workers/,
      "the per-row roll-up helper is back; it is an anon-reachable full-table scan",
    );
    for (const rx of [
      /p_workers_min is null or s\.employees_total >= p_workers_min/,
      /p_workers_max is null or s\.employees_total <= p_workers_max/,
    ]) {
      assert.match(SQL, rx, `the workers filter changed basis: ${rx}`);
    }
    assert.equal(
      (SQL.match(/case when p_sort = 'workers' then [a-z]+\.employees_total end/g) ?? []).length,
      2,
      "both the browse and the keyword branch must sort on the same column",
    );
  });

  it("every paged sort has a unique final key", () => {
    // The CSV export issues ten separate RPC calls at increasing offsets. With
    // no unique tiebreaker Postgres may order tied rows differently per call,
    // so a supplier can appear twice in a sourcing file while another vanishes.
    const orderBys = SQL.match(/order by[\s\S]*?limit v_lim offset v_off/g) ?? [];
    assert.equal(orderBys.length, 2, `expected two paged ORDER BYs, found ${orderBys.length}`);
    for (const [i, ob] of orderBys.entries()) {
      assert.match(ob, /\.id asc/, `ORDER BY #${i + 1} has no unique final key`);
    }
  });

  it("the sanctioned predicate lets a sanctioned row through only when asked", () => {
    // The previous version of this test matched an alternation so loose that
    // `coalesce(p_exclude_sanctioned` alone satisfied it — inverting the
    // comparison to `= true` returned every sanctioned supplier to every buyer
    // under a heading reading "except sanctioned", with the whole suite green.
    // Pin the predicate's actual shape: the exclusion is bypassed only when the
    // parameter is explicitly false, and `is_sanctioned = false` is what a row
    // must satisfy otherwise.
    const block = SQL.match(
      /p_skip = 'sanction'([\s\S]{0,200}?)\n\s*\)/,
    );
    assert.ok(block && block[1], "the sanction predicate block was not found");
    const clause = block[1]!;
    assert.match(
      clause,
      /coalesce\(p_exclude_sanctioned,\s*true\)\s*=\s*false/,
      "the exclusion must be bypassed only when the caller explicitly passes false",
    );
    assert.match(
      clause,
      /s\.is_sanctioned\s*=\s*false/,
      "otherwise a row must be unsanctioned to pass",
    );
    assert.doesNotMatch(
      clause,
      /coalesce\(p_exclude_sanctioned,\s*true\)\s*=\s*true/,
      "inverted: this returns sanctioned suppliers whenever the exclusion is ON",
    );
  });

  it("the saved-search redirect keeps its query string", () => {
    // `urlOnSite` assigns its first argument to URL.pathname, which
    // percent-encodes "?" — passing a whole href through it turned
    // /app/discover?q=knit into /app/discover%3Fq=knit and 404'd every saved
    // search that carried a filter. A text guard cannot see that, so this
    // exercises the real thing.
    const href = savedSearchRedirectHref({ search: "q=knit&hs=6105" });
    assert.match(href, /^\/app\/discover\?/, `unexpected href: ${href}`);

    // Exercise the primitive the route actually calls, not a re-derivation of
    // it here — the first version of this test split the href itself and so
    // passed while the route was still handing the whole thing to `urlOnSite`.
    const built = urlOnSiteFromHref(href);
    assert.equal(built.pathname, "/app/discover");
    assert.equal(built.search, "?q=knit&hs=6105");
    assert.doesNotMatch(built.toString(), /%3F/i, "the query was encoded into the path");

    // And pin that the route uses it, since the encoding bug lived in the
    // route's own helper rather than in either function.
    const routeSrc = readFileSync(
      path.join(process.cwd(), "app/(app)/app/searches/[id]/route.ts"),
      "utf8",
    );
    assert.match(routeSrc, /urlOnSiteFromHref\(/, "the route builds its redirect the unsafe way");
    assert.doesNotMatch(routeSrc, /urlOnSite\(href\)/, "passing a whole href to urlOnSite encodes the query");
  });

  it("opening a saved search is a route handler, so its redirect has a status", () => {
    // As a page under the async (app) layout it hit the same streaming soft-200
    // as /app/match: redirect() ran after Next had already committed 200, so a
    // buyer opening any saved search got a blank shell. A route handler renders
    // no layout and returns a real Response.
    const dir = path.join(process.cwd(), "app/(app)/app/searches/[id]");
    assert.ok(
      existsSync(path.join(dir, "route.ts")),
      "saved-search opening must be a route handler, not a page",
    );
    assert.ok(
      !existsSync(path.join(dir, "page.tsx")),
      "a page at this path would take precedence and reintroduce the soft-200",
    );
    const src = readFileSync(path.join(dir, "route.ts"), "utf8");
    assert.match(src, /NextResponse\.redirect\(/);
    assert.match(src, /307/);
    assert.match(src, /\.eq\("owner_id", user\.id\)/, "must filter on the owner, not lean on RLS alone");
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
