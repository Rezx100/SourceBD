import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { classifyRoute, LIMIT_API_EXPORT, RATE_LIMITS, type RateLimitClass } from "./limits";

const MIG = path.join(process.cwd(), "supabase/migrations");

/** SQL with `--` and block comments removed, so prose cannot satisfy a check. */
function stripSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (l.includes("--") ? l.slice(0, l.indexOf("--")) : l))
    .join("\n");
}

/** rl_check's body in one migration file, comments stripped, whitespace folded. */
function rlCheckBody(file: string): string {
  const m = stripSql(readFileSync(path.join(MIG, file), "utf8")).match(/create or replace function public\.rl_check\([\s\S]*?\$\$([\s\S]*?)\$\$;/i);
  assert.ok(m, `${file} defines no rl_check`);
  return (m[1] ?? "").replace(/\s+/g, " ").trim();
}

/** The rl_check definition production ends up with: replay order is filename,
 * except the newest `NNNN_` migration goes last (supabase/ci/apply-migrations.sh). */
function effectiveRlCheck(): { file: string; sql: string } {
  const files = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
  const last = files.filter((f) => /^\d{4}_/.test(f)).pop()!;
  const ordered = [...files.filter((f) => f !== last), last];
  let found: { file: string; sql: string } | null = null;
  for (const f of ordered) {
    const sql = stripSql(readFileSync(path.join(MIG, f), "utf8"));
    const m = sql.match(/create or replace function public\.rl_check\([\s\S]*?\$\$([\s\S]*?)\$\$;/i);
    if (m) found = { file: f, sql: m[1] ?? "" };
  }
  assert.ok(found, "no migration defines public.rl_check");
  return found;
}

describe("rate-limit classes", () => {
  it("every class the app uses is a bucket rl_check accepts — an unlisted one fails OPEN", () => {
    const { file, sql } = effectiveRlCheck();
    const allow = sql.match(/v_bucket\s*<>\s*all\s*\(\s*array\[([\s\S]*?)\]/i);
    assert.ok(allow, `${file}: rl_check has no bucket allow-list`);
    const listed = new Set([...(allow[1] ?? "").matchAll(/'([a-z_:]+)'/g)].map((m) => m[1]));
    for (const klass of Object.keys(RATE_LIMITS) as RateLimitClass[]) {
      assert.ok(listed.has(klass), `bucket "${klass}" is not in rl_check's allow-list (${file}), so it is never limited`);
    }
  });

  it("no migration outside the known list redefines rl_check — production applies files by date, not by this replay's order", () => {
    // The allow-list check above follows the CI replay, which applies the
    // newest NNNN_ file last. Production applies migrations when they are
    // run, so a later date-named redefinition without every bucket would win
    // there and pass here. Any new definer must be added below deliberately,
    // after checking its allow-list carries every class.
    const known = new Set([
      "0044_rate_limit_buckets.sql",
      "20260724202039_rez_medium_security_batch.sql",
      "20260725_rez_security_hardening_2.sql",
      "0104_discover_v32.sql",
    ]);
    const definers = readdirSync(MIG)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => /create or replace function public\.rl_check\(/i.test(readFileSync(path.join(MIG, f), "utf8")));
    assert.deepEqual(definers.filter((f) => !known.has(f)), []);
  });

  it("0104's rl_check is the live 20260725 body plus the one api_export entry — nothing else moved", () => {
    // 0104 replaces a SECURITY DEFINER limiter wholesale. `'ok', true`, a
    // dropped anon guard or a changed window would all pass the allow-list
    // check above; this pins the rest of the body to the version production
    // runs (checked against pg_proc.prosrc, 23 Sep 2026).
    const live = rlCheckBody("20260725_rez_security_hardening_2.sql");
    const ours = rlCheckBody("0104_discover_v32.sql");
    assert.notEqual(ours, live, "0104 no longer adds api_export");
    assert.equal(ours.replace("'api_write', 'api_export',", "'api_write',"), live);
  });

  it("the export limit CI exercises is the one the app enforces", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/ci/assert-0104.sql"), "utf8");
    const m = sql.match(/public\.rl_check\('api_export', 'ci-export', (\d+)\)/);
    assert.ok(m, "assert-0104.sql does not exercise the api_export bucket");
    assert.equal(Number(m[1]), LIMIT_API_EXPORT);
  });

  it("the CSV export has its own tighter bucket, and the Discover page is no longer unlimited", () => {
    assert.equal(classifyRoute("/api/v1/discover/export", "GET"), "api_export");
    assert.ok(RATE_LIMITS.api_export.perMin < RATE_LIMITS.api_read.perMin);
    assert.equal(RATE_LIMITS.api_export.identifier, "user");
    assert.equal(classifyRoute("/app/discover", "GET"), "api_read");
    assert.equal(classifyRoute("/api/v1/saved", "POST"), "api_write");
  });
});
