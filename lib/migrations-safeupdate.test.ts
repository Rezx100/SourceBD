// Production runs pg_safeupdate for API callers: an UPDATE or DELETE without a WHERE clause is refused there
// ("UPDATE requires a WHERE clause"), even inside a security-definer function. CI's Postgres does not load it, so
// the replay cannot see the failure; 0141's spend log broke the first live shipment reveal that way (0143).
// This reads every migration from 0143 on and fails on a statement that would be refused.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const MIG = path.join(process.cwd(), "supabase/migrations");

/** SQL with `--` and block comments removed, so prose cannot satisfy or trip a check. */
function stripSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (l.includes("--") ? l.slice(0, l.indexOf("--")) : l))
    .join("\n");
}

/** The UPDATE … SET and DELETE FROM statements in a migration that carry no WHERE. */
export function unfiltered(sql: string): string[] {
  const statements = stripSql(sql).match(/\b(?:update\s+[\w."]+(?:\s+(?:as\s+)?\w+)?\s+set|delete\s+from)\b[\s\S]*?(?:;|\$\$)/gi) ?? [];
  return statements.filter((s) => !/\bwhere\b/i.test(s)).map((s) => s.replace(/\s+/g, " ").slice(0, 80));
}

describe("migrations and pg_safeupdate", () => {
  it("sees an unfiltered update or delete, and a filtered one passes", () => {
    assert.equal(unfiltered("update public.t set a = 1;").length, 1);
    assert.equal(unfiltered("as $$ update public.t\n set a = 1 $$;").length, 1);
    assert.equal(unfiltered("delete from public.t;").length, 1);
    assert.equal(unfiltered("update public.t set a = 1 where id;").length, 0);
    assert.equal(unfiltered("insert into t values (1) on conflict (id) do update set a = 2;").length, 0);
    assert.equal(unfiltered("-- update public.t set a = 1;").length, 0);
  });

  it("no migration from 0143 on updates or deletes without a WHERE", () => {
    const files = readdirSync(MIG).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f.slice(0, 4) >= "0143");
    assert.ok(files.length > 0, "no migration from 0143 on was found");
    for (const f of files) {
      assert.deepEqual(unfiltered(readFileSync(path.join(MIG, f), "utf8")), [], `${f} has a statement production refuses`);
    }
  });
});
