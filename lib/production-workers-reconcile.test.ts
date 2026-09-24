/**
 * Durable guard: SQL batch must implement the same site set + RSC-prefer rule
 * as lib/profile-metrics groupWorkers (REZ-114 cross-path).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { applyDiscoverWorkersSelection } from "./enrich-discover-workers";
import { groupWorkers } from "./profile-metrics";

const MIG = join(
  process.cwd(),
  "supabase/migrations/20260810071000_production_workers_display_batch.sql",
);

describe("production_workers_display_batch SQL invariants", () => {
  const sql = readFileSync(MIG, "utf8");

  it("includes mother + facility_of buildings in the site set", () => {
    assert.match(sql, /facility_of\s*=\s*r\.root_id/);
    assert.match(sql, /union all/i);
  });

  it("prefers RSC single-source (never mixes registry into RSC sum)", () => {
    assert.match(sql, /prefer_rsc/);
    assert.match(
      sql,
      /where s\.source = case when f\.prefer_rsc then 'RSC' else 'registry' end/,
    );
  });
});

describe("0104's redefinition changes nothing but the two keys it adds", () => {
  // 0104 re-creates this function so it can say which sites it summed. Any
  // other drift would change the headline every profile and list shows.
  const fn = (file: string) => {
    const sql = readFileSync(join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");
    const start = sql.indexOf("create or replace function public.production_workers_display_batch");
    const end = sql.indexOf("  from agg;\n$$;", start);
    assert.ok(start >= 0 && end > start, `no production_workers_display_batch in ${file}`);
    return sql.slice(start, end);
  };
  const live = fn("supabase/migrations/20260810071000_production_workers_display_batch.sql");
  const next = fn("supabase/migrations/0104_discover_v32.sql");

  it("adds `sites` and `includes_root`, computed over the summed sites", () => {
    assert.match(next, /count\(\*\)::int as sites,\s*bool_or\(s\.site_id = s\.root_id\) as includes_root/);
    assert.match(next, /'sites', sites,\s*'includes_root', includes_root/);
  });

  it("is otherwise the live body, byte for byte", () => {
    const back = next
      .replace("max(s.fetched_at) as fetched_at,\n      count(*)::int as sites,\n      bool_or(s.site_id = s.root_id) as includes_root\n", "max(s.fetched_at) as fetched_at\n")
      .replace("'fetched_at', fetched_at,\n        'sites', sites,\n        'includes_root', includes_root\n", "'fetched_at', fetched_at\n");
    assert.equal(back, live);
  });

  it("keeps the grant the public Discover page needs", () => {
    const sql = readFileSync(join(process.cwd(), "supabase/migrations/0104_discover_v32.sql"), "utf8");
    assert.match(sql, /grant execute on function public\.production_workers_display_batch\(uuid\[\]\) to anon, authenticated;/);
    // Nor taken back later in the file; CI asserts the live privilege too.
    const after = sql.slice(sql.indexOf("grant execute on function public.production_workers_display_batch"));
    assert.doesNotMatch(after, /revoke[^;]*production_workers_display_batch[^;]*;/i, "the grant is revoked again later in 0104");
  });
});

describe("list card vs profile headline reconciliation (shared fixtures)", () => {
  it("Esquire-like: groupWorkers 6369 equals discover apply of batch 6369", () => {
    const group = groupWorkers([
      {
        label: "mother",
        employees_total: 7539,
        rsc_workers_count: 5801,
        rsc_fetched_at: null,
      },
      {
        label: "unit",
        employees_total: 568,
        rsc_workers_count: 568,
        rsc_fetched_at: null,
      },
    ]);
    assert.equal(group.value, 6369);
    const card = applyDiscoverWorkersSelection(
      [{ id: "e", employees_total: 7539 }],
      { e: { value: group.value as number, source: "RSC", fetched_at: null } },
    );
    assert.equal(card[0]?.employees_total, group.value);
  });

  it("Alliance-like: site 3046 equals discover apply of batch 3046", () => {
    const card = applyDiscoverWorkersSelection(
      [{ id: "a", employees_total: 144 }],
      { a: { value: 3046, source: "RSC", fetched_at: null } },
    );
    assert.equal(card[0]?.employees_total, 3046);
  });
});
