import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  STALE_RUNNING_JOB_MS,
  isStaleRunningJob,
  type JobStatus,
} from "./etl-monitoring";

const NOW = new Date("2026-08-02T12:00:00Z").getTime();

function isoAgo(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

function job(over: {
  status?: JobStatus;
  heartbeat_at?: string | null;
  started_at?: string | null;
  requested_at?: string;
}) {
  return {
    status: over.status ?? "running",
    heartbeat_at: over.heartbeat_at ?? null,
    started_at: over.started_at ?? null,
    requested_at: over.requested_at ?? isoAgo(10 * 60 * 1000),
  };
}

describe("isStaleRunningJob", () => {
  it("is never stale for non-running statuses", () => {
    const ancient = isoAgo(30 * 24 * 60 * 60 * 1000);
    for (const status of ["pending", "success", "failed", "cancelled"] as JobStatus[]) {
      assert.equal(
        isStaleRunningJob(job({ status, heartbeat_at: ancient, started_at: ancient, requested_at: ancient }), NOW),
        false,
        `status ${status} must never be stale`,
      );
    }
  });

  it("is false for a live running job with a fresh heartbeat", () => {
    assert.equal(
      isStaleRunningJob(job({ heartbeat_at: isoAgo(5 * 60 * 1000) }), NOW),
      false,
    );
  });

  it("is true once the heartbeat is strictly older than 3 hours", () => {
    assert.equal(
      isStaleRunningJob(job({ heartbeat_at: isoAgo(STALE_RUNNING_JOB_MS + 1) }), NOW),
      true,
    );
    assert.equal(
      isStaleRunningJob(job({ heartbeat_at: isoAgo(STALE_RUNNING_JOB_MS) }), NOW),
      false,
      "exactly 3 hours old is not yet stale",
    );
    assert.equal(
      isStaleRunningJob(job({ heartbeat_at: isoAgo(STALE_RUNNING_JOB_MS - 1) }), NOW),
      false,
    );
  });

  it("falls back to started_at when heartbeat_at is null", () => {
    assert.equal(
      isStaleRunningJob(job({ started_at: isoAgo(STALE_RUNNING_JOB_MS + 60_000) }), NOW),
      true,
    );
    assert.equal(
      isStaleRunningJob(job({ started_at: isoAgo(60 * 60 * 1000) }), NOW),
      false,
    );
  });

  it("falls back to requested_at when heartbeat_at and started_at are null", () => {
    assert.equal(
      isStaleRunningJob(job({ requested_at: isoAgo(STALE_RUNNING_JOB_MS + 60_000) }), NOW),
      true,
    );
    assert.equal(isStaleRunningJob(job({}), NOW), false);
  });

  it("honours the coalesce order: heartbeat_at wins over the older fallbacks", () => {
    assert.equal(
      isStaleRunningJob(
        job({
          heartbeat_at: isoAgo(5 * 60 * 1000),
          started_at: isoAgo(48 * 60 * 60 * 1000),
          requested_at: isoAgo(49 * 60 * 60 * 1000),
        }),
        NOW,
      ),
      false,
      "a fresh heartbeat proves the job is alive regardless of start age",
    );
    assert.equal(
      isStaleRunningJob(
        job({
          heartbeat_at: isoAgo(STALE_RUNNING_JOB_MS + 60_000),
          started_at: isoAgo(5 * 60 * 1000),
        }),
        NOW,
      ),
      true,
      "a stale heartbeat is decisive even when started_at looks fresh",
    );
  });

  it("treats an unparseable timestamp as not stale (fails closed)", () => {
    assert.equal(
      isStaleRunningJob(job({ heartbeat_at: "not-a-date", started_at: null, requested_at: "also-not-a-date" }), NOW),
      false,
    );
  });
});
