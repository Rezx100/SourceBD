// "Send feedback" (launch follow-up 4): what the note must be, what is posted and the words for each refusal;
// and that the buyer frame mounts the one entry point on a desktop and a phone while no public, sign-in or portal
// page does.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { FEEDBACK_THANKS, feedbackProblem, feedbackRefusal, sendFeedback } from "./feedback-model";

const res = (status: number, json: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => json });
const src = (f: string) => readFileSync(join(process.cwd(), f), "utf8");

describe("the note", () => {
  it("needs 10 characters that are not spaces, and at most 4,000", () => {
    assert.match(feedbackProblem("") ?? "", /at least 10 characters/);
    assert.match(feedbackProblem("   short   ") ?? "", /at least 10 characters/);
    assert.equal(feedbackProblem("0123456789"), null);
    assert.equal(feedbackProblem("x".repeat(4000)), null);
    assert.match(feedbackProblem("x".repeat(4001)) ?? "", /under 4,000/);
  });
});

describe("sending it", () => {
  it("posts the trimmed note and the page to the one route", async () => {
    const seen: { url: string; init: { method: string; body?: unknown } }[] = [];
    const r = await sendFeedback("/app/saved", "  It lost my filter.  ", { fetch: async (url, init) => (seen.push({ url, init: init as never }), res(201, { id: "f-1" })) });
    assert.equal(r.ok, true);
    assert.equal(seen[0]!.url, "/api/v1/feedback");
    assert.equal(seen[0]!.init.method, "POST");
    assert.deepEqual(JSON.parse(String(seen[0]!.init.body)), { page_path: "/app/saved", message: "It lost my filter." });
  });

  it("says a limit, a lapsed session, the route's own sentence and an unreachable server in words, never a key", async () => {
    const words = async (status: number, json: unknown) => feedbackRefusal(await sendFeedback("/app", "A note long enough.", { fetch: async () => res(status, json) }));
    assert.match(await words(429, { error: "rate_limited" }), /Too many requests in a minute/);
    assert.match(await words(401, { error: "Sign in to send feedback." }), /session ended/);
    assert.equal(await words(400, { error: "Write at least 10 characters so we can act on it." }), "Write at least 10 characters so we can act on it.");
    assert.match(await words(500, { error: "internal" }), /Could not send your feedback\. Nothing was sent/);
    const offline = feedbackRefusal(await sendFeedback("/app", "A note long enough.", { fetch: async () => Promise.reject(new Error("offline")) }));
    assert.match(offline, /Could not reach SourceBD/);
  });

  it("thanks the buyer in the founder's words", () => {
    assert.equal(FEEDBACK_THANKS, "Thanks, we read every one.");
  });
});

describe("where the entry point is", () => {
  it("the desktop account menu and the phone account sheet each open it, and Send is 48 tall on a phone", () => {
    assert.match(src("components/frame/topbar.tsx"), /<MenuItem onSelect=\{\(\) => setFeedback\(true\)\}>Send feedback<\/MenuItem>/);
    assert.match(src("components/frame/phone.tsx"), /Send feedback\s*<\/button>/);
    const dialog = src("components/frame/feedback.tsx");
    assert.match(dialog, /phone \? "touch" : "md"/);
    assert.match(src("components/kit/button-class.ts"), /touch: "h-input-touch/);
  });

  it("no floating button: the dialog is only drawn when the menu asks, and nothing is positioned over the page", () => {
    const dialog = src("components/frame/feedback.tsx");
    assert.doesNotMatch(dialog, /\bfixed\b|\bsticky\b|localStorage/);
  });

  it("only the buyer frame mounts it: no public, sign-in, invite or portal page draws it", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(join(process.cwd(), dir))) {
        const rel = `${dir}/${name}`;
        if (statSync(join(process.cwd(), rel)).isDirectory()) walk(rel);
        else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && /FeedbackDialog|frame\/feedback/.test(src(rel))) hits.push(rel);
      }
    };
    for (const d of ["app", "components"]) walk(d);
    assert.deepEqual(hits.sort(), ["components/frame/feedback.tsx", "components/frame/phone.tsx", "components/frame/topbar.tsx"]);
  });
});
