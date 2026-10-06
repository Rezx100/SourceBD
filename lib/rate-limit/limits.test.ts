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

/** A definition of rl_check however it is spelled: with or without
 * `or replace`, schema-qualified or not (search_path decides), quoted
 * identifiers, spaces before the parenthesis, any casing. */
const RL_CHECK_DEF = /create\s+(?:or\s+replace\s+)?function\s+(?:"?public"?\s*\.\s*)?"?rl_check"?\s*\(/i;
const RL_CHECK_DEF_ALL = new RegExp(RL_CHECK_DEF.source, "gi");

/** rl_check's whole definition in one file — header (security definer,
 * search_path) AND body — comments stripped, whitespace folded. */
function rlCheckDef(file: string): { header: string; body: string } {
  const sql = stripSql(readFileSync(path.join(MIG, file), "utf8"));
  const at = sql.search(RL_CHECK_DEF);
  assert.ok(at >= 0, `${file} defines no rl_check`);
  const m = sql.slice(at).match(/^([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$;/i);
  assert.ok(m, `${file}: rl_check has no $$ body`);
  const fold = (x: string | undefined) => (x ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  return { header: fold(m[1]), body: fold(m[2]) };
}

/** The rl_check definition production ends up with: replay order is filename,
 * except every `NNNN_` migration from 0104 on goes last, in number order
 * (supabase/ci/apply-migrations.sh). */
function effectiveRlCheck(): { file: string; sql: string } {
  const files = readdirSync(MIG).filter((f) => f.endsWith(".sql")).sort();
  const tail = files.filter((f) => /^\d{4}_/.test(f) && f.slice(0, 4) >= "0104");
  const ordered = [...files.filter((f) => !tail.includes(f)), ...tail];
  let found: { file: string; sql: string } | null = null;
  for (const f of ordered) {
    const sql = stripSql(readFileSync(path.join(MIG, f), "utf8"));
    if (RL_CHECK_DEF.test(sql)) found = { file: f, sql: rlCheckDef(f).body };
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
      .filter((f) => RL_CHECK_DEF.test(readFileSync(path.join(MIG, f), "utf8")));
    assert.deepEqual(definers.filter((f) => !known.has(f)), []);
    // Nor may any other migration ALTER or DROP it. The CI replay applies
    // the newest NNNN_ file (0104) LAST, so a later date-named
    // `alter function rl_check(...) security invoker` would be overwritten in
    // CI and live in production — where the limiter would then fail open.
    const ddl = /\b(?:alter|drop)\s+function\s+(?:if\s+exists\s+)?(?:"?public"?\s*\.\s*)?"?rl_check"?\b/i;
    const touchers = readdirSync(MIG)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => ddl.test(stripSql(readFileSync(path.join(MIG, f), "utf8"))));
    assert.deepEqual(touchers.filter((f) => !known.has(f)), [], "a migration outside the known list alters or drops rl_check");
    // And each known file defines it once: rlCheckDef reads only the first,
    // so a second definition later in 0104 would win unseen.
    for (const f of known) {
      const n = (stripSql(readFileSync(path.join(MIG, f), "utf8")).match(RL_CHECK_DEF_ALL) ?? []).length;
      assert.equal(n, 1, `${f} defines rl_check ${n} times`);
    }
  });

  it("0104's rl_check is the live 20260725 body plus the one api_export entry — nothing else moved", () => {
    // 0104 replaces a SECURITY DEFINER limiter wholesale. `'ok', true`, a
    // dropped anon guard or a changed window would all pass the allow-list
    // check above; this pins the rest of the body to the version production
    // runs (checked against pg_proc.prosrc, 23 Sep 2026).
    const live = rlCheckDef("20260725_rez_security_hardening_2.sql");
    const ours = rlCheckDef("0104_discover_v32.sql");
    // The header too: SECURITY INVOKER would hit rate_limit_buckets' RLS (no
    // policies), error, and the limiter fails open — every limit gone.
    assert.equal(ours.header, live.header);
    assert.match(ours.header, /security definer/);
    assert.match(ours.header, /set search_path = public/);
    assert.notEqual(ours.body, live.body, "0104 no longer adds api_export");
    assert.equal(ours.body.replace("'api_write', 'api_export',", "'api_write',"), live.body);
  });

  it("every email template has a bucket rl_check accepts — sendEmail limits per recipient and fails open on an unlisted one", () => {
    const tpl = readFileSync(path.join(process.cwd(), "lib/email/templates/index.tsx"), "utf8");
    const map = tpl.match(/export type TemplateMap = \{([\s\S]*?)\n\};/);
    assert.ok(map, "TemplateMap not found");
    const templates = [...(map[1] ?? "").matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
    assert.ok(templates.length >= 8, "TemplateMap lost entries");
    // The email list live since 20260725, plus what 0119 patches in.
    const live = rlCheckDef("20260725_rez_security_hardening_2.sql").body;
    const base = [...live.matchAll(/'email:([a-z_]+)'/g)].map((m) => m[1]);
    const patch = stripSql(readFileSync(path.join(MIG, "0119_rl_check_email_buckets.sql"), "utf8"));
    const added = [...(patch.match(/foreach v_name in array array\[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/'email:([a-z_]+)'/g)].map((m) => m[1]);
    assert.deepEqual([...new Set([...base, ...added])].sort(), [...templates].sort());
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

  it("Contact sales, which emails the founder, is bounded per address like a sign-in", () => {
    assert.equal(classifyRoute("/contact", "POST"), "auth");
    assert.equal(RATE_LIMITS.auth.identifier, "ip");
  });
});
