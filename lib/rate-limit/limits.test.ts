import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { classifyRoute, RATE_LIMITS, type RateLimitClass } from "./limits";

const MIG = path.join(process.cwd(), "supabase/migrations");

/** The rl_check definition production ends up with: replay order is filename,
 * except the newest `NNNN_` migration goes last (supabase/ci/apply-migrations.sh). */
function effectiveRlCheck(): { file: string; sql: string } {
  const files = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
  const last = files.filter((f) => /^\d{4}_/.test(f)).pop()!;
  const ordered = [...files.filter((f) => f !== last), last];
  let found: { file: string; sql: string } | null = null;
  for (const f of ordered) {
    const sql = readFileSync(path.join(MIG, f), "utf8")
      .split("\n")
      .map((l) => (l.includes("--") ? l.slice(0, l.indexOf("--")) : l))
      .join("\n");
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

  it("the CSV export has its own tighter bucket, and the Discover page is no longer unlimited", () => {
    assert.equal(classifyRoute("/api/v1/discover/export", "GET"), "api_export");
    assert.ok(RATE_LIMITS.api_export.perMin < RATE_LIMITS.api_read.perMin);
    assert.equal(RATE_LIMITS.api_export.identifier, "user");
    assert.equal(classifyRoute("/app/discover", "GET"), "api_read");
    assert.equal(classifyRoute("/api/v1/saved", "POST"), "api_write");
  });
});
