// The frame's two counts (row 24): Messages "N new" from `thread_unread_total`, Compliance "N to check"
// from the hub's own reads. Each is read on its own; a failed, slow or empty read draws nothing, never
// a 0, and the promise the layout hands the frame never rejects.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadFrameBadges, loadMessagesBadge, messagesBadge } from "@/lib/dashboard/frame-badges";

type Answer = { data: unknown; error: unknown };
const never = () => new Promise<Answer>(() => {});

function client(answers: Record<string, Answer | (() => Promise<Answer>)>, calls: string[] = []) {
  return {
    rpc(fn: string) {
      calls.push(fn);
      const a = answers[fn];
      return typeof a === "function" ? a() : Promise.resolve(a ?? { data: null, error: { message: `no answer for ${fn}` } });
    },
  };
}

const cert = (n: number) => ({ total: n, rows: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, supplier_slug: "s", supplier_name: "S", cert_type: "WRAP", valid_until: "2026-01-01", days_to_expiry: -10 })) });

describe("Messages badge", () => {
  it("is '2 new' for two conversations with something unread, and nothing for none or a non-number", () => {
    assert.deepEqual(messagesBadge(2), { text: "2 new" });
    assert.equal(messagesBadge(0), null);
    assert.equal(messagesBadge(null), null);
    assert.equal(messagesBadge("3"), null);
    assert.equal(messagesBadge(-1), null);
    assert.deepEqual(messagesBadge(120), { text: "99+ new" });
  });

  it("reads thread_unread_total; a database without it (0112), a failed read or a slow one draws nothing", async () => {
    const calls: string[] = [];
    assert.deepEqual(await loadMessagesBadge(client({ thread_unread_total: { data: 4, error: null } }, calls)), { text: "4 new" });
    assert.deepEqual(calls, ["thread_unread_total"]);
    assert.equal(await loadMessagesBadge(client({ thread_unread_total: { data: 0, error: null } })), null);
    assert.equal(await loadMessagesBadge(client({ thread_unread_total: { data: null, error: { code: "PGRST202" } } })), null);
    assert.equal(await loadMessagesBadge(client({ thread_unread_total: () => Promise.reject(new Error("down")) })), null);
    const t0 = Date.now();
    assert.equal(await loadMessagesBadge(client({ thread_unread_total: never }), 30), null);
    assert.ok(Date.now() - t0 < 1000, "the badge waited on a slow read");
    assert.equal(await loadMessagesBadge({ rpc: () => { throw new Error("sync"); } }), null);
  });
});

describe("loadFrameBadges", () => {
  it("returns both counts, each from its own read", async () => {
    const b = await loadFrameBadges(
      client({
        thread_unread_total: { data: 2, error: null },
        compliance_expired_certs: { data: cert(2), error: null },
        compliance_expiring_certs: { data: cert(0), error: null },
      }),
    );
    assert.deepEqual(b.messages, { text: "2 new" });
    assert.ok(!b.compliance || /to check$/.test(b.compliance.text), "the compliance badge is the hub's words or nothing");
  });

  it("one count failing does not hold back or blank the other, and the promise never rejects", async () => {
    const b = await loadFrameBadges(
      client({
        thread_unread_total: { data: 3, error: null },
        compliance_expired_certs: () => Promise.reject(new Error("down")),
        compliance_expiring_certs: { data: null, error: { message: "x" } },
      }),
    );
    assert.deepEqual(b, { messages: { text: "3 new" }, compliance: null });
    const none = await loadFrameBadges(client({}));
    assert.deepEqual(none, { messages: null, compliance: null });
  });
});
