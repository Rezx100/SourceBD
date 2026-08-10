import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runSmartMatch } from "./smart-match-response";

describe("runSmartMatch observable boundary", () => {
  it("401 when role is not buyer/admin", async () => {
    const res = await runSmartMatch({
      role: null,
      supabase: { rpc: async () => ({ data: null, error: null }) },
      raw: {},
    });
    assert.equal(res.status, 401);
  });

  it("400 when body is not an object", async () => {
    const res = await runSmartMatch({
      role: "buyer",
      supabase: { rpc: async () => ({ data: null, error: null }) },
      raw: [],
    });
    assert.equal(res.status, 400);
  });

  it("200 returns RSC-selected workers (Alliance 144 → 3046)", async () => {
    const res = await runSmartMatch({
      role: "buyer",
      supabase: {
        rpc: async (fn: string) => {
          if (fn === "buyer_smart_match") {
            return {
              data: {
                criteria_count: 1,
                total: 1,
                results: [
                  {
                    id: "a",
                    slug: "alliance-knit-composite",
                    employees_total: 144,
                  },
                ],
              },
              error: null,
            };
          }
          if (fn === "production_workers_display_batch") {
            return {
              data: {
                a: { value: 3046, source: "RSC", fetched_at: null },
              },
              error: null,
            };
          }
          return { data: null, error: { message: `unexpected ${fn}` } };
        },
      },
      raw: { product: "knit" },
    });
    assert.equal(res.status, 200);
    const body = res.body as {
      results: Array<{ employees_total: number | null }>;
    };
    assert.equal(body.results[0]?.employees_total, 3046);
  });

  it("200 Esquire group headline 6369 never 8107", async () => {
    const res = await runSmartMatch({
      role: "admin",
      supabase: {
        rpc: async (fn: string) => {
          if (fn === "buyer_smart_match") {
            return {
              data: {
                total: 1,
                results: [{ id: "e", employees_total: 7539 }],
              },
              error: null,
            };
          }
          if (fn === "production_workers_display_batch") {
            return {
              data: {
                e: { value: 6369, source: "RSC", fetched_at: null },
              },
              error: null,
            };
          }
          return { data: null, error: { message: `unexpected ${fn}` } };
        },
      },
      raw: {},
    });
    assert.equal(res.status, 200);
    const body = res.body as {
      results: Array<{ employees_total: number | null }>;
    };
    assert.equal(body.results[0]?.employees_total, 6369);
  });
});
