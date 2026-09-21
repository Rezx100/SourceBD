import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const SQL = readFileSync(
  path.join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"),
  "utf8",
);

describe("0104 discover_suppliers PII guard", () => {
  it("the function's RETURNS TABLE lists no contact columns", () => {
    const match = SQL.match(/create or replace function public\.discover_suppliers\([\s\S]*?returns table \(([\s\S]*?)\)\s*language plpgsql/);
    assert.ok(match && match[1], "discover_suppliers returns table not found");
    const returns = match[1]!;
    for (const col of ["email_primary", "phones", "contact_name", "contact_role"]) {
      assert.doesNotMatch(returns, new RegExp(`\\b${col}\\b`));
    }
    assert.match(returns, /\bis_sanctioned\b/);
    assert.match(returns, /\bcert_summary\b/);
    assert.match(returns, /\bhs_codes\b/);
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

  it("the match page redirects to Discover with Ask on", () => {
    const src = readFileSync(path.join(process.cwd(), "app/(app)/app/match/page.tsx"), "utf8");
    assert.match(src, /redirect\("\/app\/discover\?ask=1"\)/);
  });
});
