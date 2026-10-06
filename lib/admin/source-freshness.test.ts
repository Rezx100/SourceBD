import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { creditsWords, freshnessLines, type FreshnessRow } from "./source-freshness";

const row = (over: Partial<FreshnessRow>): FreshnessRow => ({
  scraper_code: "x",
  enabled: true,
  interval_minutes: 1440,
  max_age_hours: 48,
  next_run_at: null,
  last_complete_at: "2026-10-06T02:00:00Z",
  age_hours: 3,
  over_sla: false,
  failures_in_row: 0,
  last_breaker_trip: null,
  credits_month: 0,
  no_longer_listed: 0,
  last_runs: [],
  ...over,
});

describe("Sources page freshness (spec-etl-freshness S3)", () => {
  const doc = {
    credits_month: 312,
    credits_ceiling: 1500,
    rows: [
      row({ scraper_code: "wrap", max_age_hours: 72, age_hours: 2472, over_sla: true, last_runs: [{ started_at: "", status: "success", seen: 1, upserted: 0, skipped: 1 }] }),
      row({ scraper_code: "ofac_sdn", last_runs: [{ started_at: "", status: "held", seen: 1, upserted: 0, skipped: 0 }, { started_at: "", status: "failed", seen: 0, upserted: 0, skipped: 0 }] }),
      row({ scraper_code: "bkmea_web", enabled: false, interval_minutes: null, max_age_hours: null, over_sla: null, age_hours: null, failures_in_row: 2 }),
    ],
  };

  it("says each source's age against its limit, the stalest problem first", () => {
    const lines = freshnessLines(doc);
    assert.deepEqual(lines.map((l) => l.code), ["wrap", "bkmea_web", "ofac_sdn"]);
    assert.equal(lines[0]!.age, "103 days old · limit 72 h");
    assert.equal(lines[0]!.tone, "danger");
    assert.equal(lines[1]!.age, "never read in full");
    assert.equal(lines[1]!.cadence, "off");
    assert.equal(lines[1]!.failures, "2 failed in a row");
    assert.equal(lines[2]!.age, "3 h old · limit 48 h");
    assert.equal(lines[2]!.runs, "held ✗");
  });

  it("states credits against the founder's ceiling", () => {
    assert.equal(creditsWords(doc), "312 of 1,500 Firecrawl credits used this month");
  });
});
