import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SCRAPER_BY_CODE,
  SCRAPER_CATALOG,
  SCRAPER_TRANSPORT,
  isMaintenanceCode,
  scraperTransport,
} from "./etl-scrapers";
import {
  citationHref,
  claimAdvice,
  consecutiveFailures,
  formatCredits,
  isTransientlyUnreachable,
  transientReason,
  verifiedShare,
  type EvidenceSummary,
  type ProblemClaim,
} from "./evidence";

function claim(over: Partial<ProblemClaim> = {}): ProblemClaim {
  const evidence = {
    id: "d1",
    scraper_code: "bgmea_web",
    url: "https://www.bgmea.com.bd/member/1234",
    final_url: "https://www.bgmea.com.bd/member/1234",
    http_status: 200,
    fetch_status: "ok" as const,
    verify_status: "changed" as const,
    last_verified_at: "2026-07-28T00:00:00Z",
    fetched_at: "2026-06-01T00:00:00Z",
    raw_html_mirror_url: "https://cdn.sourcebd.com/evidence/d1.html",
    screenshot_mirror_url: null,
    file_mirror_url: null,
    verify_detail: null as Record<string, unknown> | null,
    ...(over.evidence ?? {}),
  };
  return {
    claim_id: "c1",
    status: "stale",
    field_key: "employees.total",
    field_value: "1240",
    locator: "table tr:nth-child(4) td:nth-child(2)",
    excerpt: "Total Employees 1,240",
    subject_table: "suppliers",
    subject_id: "s1",
    source_tier: 2,
    first_seen_at: "2026-06-01T00:00:00Z",
    last_confirmed_at: "2026-07-01T00:00:00Z",
    reviewed_at: null,
    review_note: null,
    supplier: { id: "s1", slug: "alpha-apparels", company_name: "Alpha Apparels" },
    ...over,
    evidence,
  };
}

describe("transport metadata", () => {
  it("declares a transport for every runnable code", () => {
    // A blank badge would leave an operator unable to tell a vendor outage from
    // a publisher block, which is the whole reason the badge exists.
    for (const item of SCRAPER_CATALOG) {
      assert.ok(
        SCRAPER_TRANSPORT[item.code],
        `${item.code} has no declared transport`,
      );
    }
  });

  it("does not declare transports for codes that are not in the catalog", () => {
    for (const code of Object.keys(SCRAPER_TRANSPORT)) {
      assert.ok(SCRAPER_BY_CODE.has(code), `${code} is not a catalog entry`);
    }
  });

  it("marks the file-backed sources as file, not direct", () => {
    // These read from disk, so "failed" means nobody staged a fresh extract —
    // a different action from a network failure.
    assert.equal(scraperTransport("bgmea_pdf"), "file");
    assert.equal(scraperTransport("btma_spinning"), "file");
  });

  it("keeps the maintenance jobs out of the source transports", () => {
    assert.equal(scraperTransport("verify_evidence"), "job");
    assert.ok(isMaintenanceCode("verify_evidence"));
    assert.ok(isMaintenanceCode("refresh_monitors"));
    assert.ok(!isMaintenanceCode("bgmea_web"));
  });

  it("returns null rather than guessing for an unknown code", () => {
    assert.equal(scraperTransport("not_a_scraper"), null);
  });
});

describe("citationHref", () => {
  it("points at the live page while the page is still live", () => {
    assert.equal(
      citationHref(claim()),
      "https://www.bgmea.com.bd/member/1234",
    );
  });

  it("falls back to the archived snapshot once the page is dead", () => {
    // Sending an operator to a 404 would tell them nothing; the dated mirror is
    // what still shows the value we cited.
    const dead = claim({
      status: "orphaned",
      evidence: { verify_status: "dead", http_status: 404 } as never,
    });
    assert.equal(citationHref(dead), "https://cdn.sourcebd.com/evidence/d1.html");
  });

  it("returns null when a dead page has no archived copy at all", () => {
    const dead = claim({
      status: "orphaned",
      evidence: {
        verify_status: "dead",
        raw_html_mirror_url: null,
        file_mirror_url: null,
        screenshot_mirror_url: null,
      } as never,
    });
    assert.equal(citationHref(dead), null);
  });
});

describe("transient detection", () => {
  it("separates a page we could not reach from a fact that moved", () => {
    // The REZ-30 distinction, carried into the UI: an outage is an operations
    // problem and must not be presented as a retracted fact.
    const unreachable = claim({
      evidence: {
        verify_detail: {
          last_transient: "timeout",
          consecutive_transient_failures: 3,
          needs_attention: true,
        },
      } as never,
    });
    assert.ok(isTransientlyUnreachable(unreachable));
    assert.equal(transientReason(unreachable), "timeout");
    assert.equal(consecutiveFailures(unreachable), 3);

    const drifted = claim({
      evidence: {
        verify_detail: { content_changed: true, claims_missing: 1 },
      } as never,
    });
    assert.ok(!isTransientlyUnreachable(drifted));
    assert.equal(transientReason(drifted), null);
    assert.equal(consecutiveFailures(drifted), 0);
  });

  it("treats a claim with no verify detail as checked, not unreachable", () => {
    assert.ok(!isTransientlyUnreachable(claim()));
  });
});

describe("claimAdvice", () => {
  it("tells the operator to re-run the source that produced the claim", () => {
    const advice = claimAdvice(claim({ status: "stale" }));
    assert.ok(advice.includes("bgmea_web"));
    assert.ok(advice.includes("still live"));
  });

  it("mentions the archived snapshot when the link is gone", () => {
    const advice = claimAdvice(
      claim({ status: "orphaned", evidence: { http_status: 404 } as never }),
    );
    assert.ok(advice.includes("archived snapshot"));
    assert.ok(advice.includes("404"));
  });

  it("defers to the source trust hierarchy on a contradiction", () => {
    const advice = claimAdvice(claim({ status: "contradicted" }));
    assert.ok(advice.includes("higher tier"));
  });
});

describe("summary helpers", () => {
  function summary(over: Partial<EvidenceSummary["documents"]> = {}): EvidenceSummary {
    return {
      documents: {
        total: 200,
        live: 180,
        changed: 10,
        dead: 5,
        unverified: 5,
        oldest_unverified_at: null,
        verified_last_7d: 150,
        ...over,
      },
      claims: {
        total: 0,
        active: 0,
        stale: 0,
        contradicted: 0,
        orphaned: 0,
        needs_review: 0,
        confirmed_last_7d: 0,
      },
      credits: { last_24h: 0, last_30d: 0, month_to_date: 0, all_time: 0 },
      monitors: {
        total: 0,
        enabled: 0,
        erroring: 0,
        last_check_at: null,
        pending_webhook_events: 0,
      },
      generated_at: "2026-07-29T00:00:00Z",
    };
  }

  it("reports the share of documents checked recently", () => {
    assert.equal(verifiedShare(summary()), 75);
  });

  it("does not divide by zero before anything has been recorded", () => {
    assert.equal(verifiedShare(summary({ total: 0, verified_last_7d: 0 })), 0);
  });

  it("abbreviates credit counts without losing the order of magnitude", () => {
    assert.equal(formatCredits(940), "940");
    assert.equal(formatCredits(9_200), "9.2k");
    assert.equal(formatCredits(45_000), "45k");
  });
});
