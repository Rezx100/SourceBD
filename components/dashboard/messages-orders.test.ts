// Boundary tests for Messages: the HTML a buyer's browser receives for the
// states they see — the empty inbox that says how it fills, a failed read that
// never pretends to be empty, the open thread marked current, the record that
// opens beside the conversation, the day separators and the sent times, and
// the composer's announcements and counter.
//
// The Orders half of this file moved with the orders rebuild (27 Sep 2026):
// the engineer who owns `orders.tsx` tests it in its own file. The route-level
// Messages cases (`?record=` on the thread page) are in
// `app/(app)/app/buyer-pages-routes.test.ts`.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "node:test";

import * as inboxModule from "./inbox";
import { ConversationHeader, INBOX_EMPTY_COPY, INBOX_ERROR_COPY, Inbox, threadHref, type InboxThread } from "./inbox";
import {
  COUNTER_FROM,
  MessageList,
  ThreadRealtime,
  arrivalText,
  counterText,
  dayGroups,
  type ThreadMessage,
} from "@/app/(app)/app/messages/[thread]/thread-realtime";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** What a reader sees: the markup with its tags removed. */
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const thread = (over: Partial<InboxThread> = {}): InboxThread => ({
  id: "11111111-1111-4111-8111-111111111111",
  supplier_id: "s1",
  supplier_slug: "aboni-knitwear",
  supplier_name: "Aboni Knitwear Limited",
  supplier_entity_type: "factory",
  rfq_id: "22222222-2222-4222-8222-222222222222",
  subject: "Knitted polo shirts",
  last_message_at: null,
  created_at: "2026-09-01T10:00:00Z",
  message_count: 3,
  ...over,
});

const message = (id: string, created_at: string, over: Partial<ThreadMessage> = {}): ThreadMessage => ({
  id,
  thread_id: thread().id,
  sender_id: "u1",
  created_at,
  body: `Body ${id}`,
  is_self: false,
  ...over,
});

describe("Messages — the inbox", () => {
  it("an empty inbox teaches how it fills and offers a new RFQ", () => {
    const out = html(createElement(Inbox, { threads: [], error: false }));
    assert.match(out, /No conversations yet/);
    assert.ok(out.includes(INBOX_EMPTY_COPY.replace(/'/g, "&#x27;")), out);
    assert.match(out, /href="\/app\/rfqs\/new"/);
  });

  it("a failed read says so and never draws the empty state", () => {
    const out = html(createElement(Inbox, { threads: [], error: true }));
    assert.match(out, /role="alert"/);
    assert.ok(out.includes(INBOX_ERROR_COPY));
    assert.doesNotMatch(out, /No conversations yet/);
  });

  it("the list page offers 'Pick a conversation' and marks no thread current", () => {
    const out = html(createElement(Inbox, { threads: [thread()], error: false }));
    assert.match(out, /Pick a conversation/);
    assert.match(out, /href="\/app\/messages\/11111111-1111-4111-8111-111111111111"/);
    assert.doesNotMatch(out, /aria-current/);
    assert.match(out, /3 messages/);
  });

  it("every row's time is one format: relative inside 30 days, the day itself after — never 'Sept' or a slashed date", () => {
    const hour = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const days = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const out = html(
      createElement(Inbox, {
        threads: [
          thread({ id: "a", last_message_at: hour }),
          thread({ id: "b", last_message_at: days }),
          thread({ id: "c", last_message_at: "2026-04-10T09:30:00Z" }),
        ],
        error: false,
      }),
    );
    assert.match(out, />3h ago</);
    assert.match(out, />5d ago</);
    assert.match(out, />10 Apr 2026</);
    assert.doesNotMatch(out, /Sept|\d+\/\d+\/\d{4}/);
  });

  it("the inbox no longer exports its own date formatter", () => {
    assert.equal("fmtRelative" in inboxModule, false, "dates go through lib/dashboard/facts.ts");
  });

  it("the thread page marks the open thread current and hides the list on a phone", () => {
    const other = thread({ id: "33333333-3333-4333-8333-333333333333", supplier_name: "Zaheen Knitwear" });
    const out = html(
      createElement(Inbox, { threads: [thread(), other], error: false, currentId: thread().id }, "CONVERSATION"),
    );
    assert.equal(out.match(/aria-current="page"/g)?.length, 1);
    assert.match(out, /href="\/app\/messages\/11111111-1111-4111-8111-111111111111" aria-current="page"|aria-current="page"[^>]*href="\/app\/messages\/11111111/);
    assert.match(out, /<nav aria-label="Conversations" class="[^"]*hidden lg:block/);
    assert.match(out, /CONVERSATION/);
    assert.doesNotMatch(out, /Pick a conversation/);
  });

  it("with the record open the list steps aside at every width, and the conversation yields the region below lg", () => {
    const out = html(createElement(Inbox, { threads: [thread()], error: false, currentId: thread().id, recordOpen: true }, "CONVERSATION"));
    const nav = out.match(/<nav aria-label="Conversations" class="([^"]*)"/)?.[1] ?? "";
    assert.ok(nav.split(" ").includes("hidden"), nav);
    assert.ok(!nav.includes("lg:block"), `the list comes back from lg: ${nav}`);
    assert.match(out, /^<div class="[^"]*hidden lg:flex/, "below lg the record takes the region");
    assert.doesNotMatch(out, /lg:grid-cols-\[300px/, "the list's column is still reserved");
  });

  it("the conversation header opens the record beside the conversation and the RFQ in the RFQs pane, and has a Back link", () => {
    const out = html(createElement(ConversationHeader, { thread: thread() }));
    assert.match(out, /href="\/app\/messages\/11111111-1111-4111-8111-111111111111\?record=aboni-knitwear"[^>]*>Supplier record/);
    assert.match(out, /href="\/app\/rfqs\?open=22222222-2222-4222-8222-222222222222"[^>]*>View RFQ/);
    assert.doesNotMatch(out, /href="\/app\/suppliers\//, "the record link leaves the conversation");
    assert.match(out, /href="\/app\/messages"[^>]*>.*Back to messages/);
    const noRfq = html(createElement(ConversationHeader, { thread: thread({ rfq_id: null }) }));
    assert.doesNotMatch(noRfq, /View RFQ/);
    const open = html(createElement(ConversationHeader, { thread: thread(), recordOpen: true }));
    assert.match(open, /aria-current="true"[^>]*>Supplier record|href="[^"]*\?record=[^"]*"[^>]*aria-current="true"/);
  });

  it("threadHref encodes the slug and drops the record when there is none", () => {
    assert.equal(threadHref("t1"), "/app/messages/t1");
    assert.equal(threadHref("t1", "a b&c"), "/app/messages/t1?record=a%20b%26c");
  });
});

describe("Messages — the conversation", () => {
  const msgs = [
    message("m1", "2026-09-12T14:30:00Z"),
    message("m2", "2026-09-12T16:05:00Z", { is_self: true }),
    message("m3", "2026-09-13T08:00:00Z"),
  ];

  it("groups messages under one separator per day, in order", () => {
    assert.deepEqual(
      dayGroups(msgs).map((g) => [g.day, g.messages.map((m) => m.id)]),
      [
        ["12 Sep 2026", ["m1", "m2"]],
        ["13 Sep 2026", ["m3"]],
      ],
    );
    const out = html(createElement(MessageList, { messages: msgs, supplierName: "Aboni Knitwear Limited" }));
    const separators = [...out.matchAll(/<h3[^>]*>([^<]*)<\/h3>/g)].map((m) => m[1]);
    assert.deepEqual(separators, ["12 Sep 2026", "13 Sep 2026"]);
    assert.ok(out.indexOf("Body m2") < out.indexOf("13 Sep 2026"), "a message sits under its own day");
  });

  it("each message carries its sent time from formatTime, in UTC", () => {
    const out = html(createElement(MessageList, { messages: msgs, supplierName: "Aboni Knitwear Limited" }));
    assert.match(out, /<time dateTime="2026-09-12T14:30:00Z">12 Sep 2026, 14:30<\/time>/);
    assert.match(out, /<time dateTime="2026-09-13T08:00:00Z">13 Sep 2026, 08:00<\/time>/);
    assert.doesNotMatch(out, /Sept|AM|PM/);
    assert.match(text(out), /You 12 Sep 2026, 16:05/, "the buyer's own message is 'You'");
    assert.match(text(out), /Aboni Knitwear Limited 13 Sep 2026, 08:00/);
  });

  it("an empty thread invites the first message", () => {
    assert.match(html(createElement(MessageList, { messages: [] })), /No messages yet/);
  });

  it("an arriving reply is announced politely, naming the supplier", () => {
    assert.equal(arrivalText(0, "Aboni"), null);
    assert.equal(arrivalText(1, "Aboni Knitwear Limited"), "New message from Aboni Knitwear Limited");
    assert.equal(arrivalText(3, "Aboni"), "3 new messages from Aboni");
    const out = html(createElement(ThreadRealtime, { threadId: thread().id, initialMessages: msgs, supplierName: "Aboni" }));
    assert.match(out, /<p role="status" aria-live="polite" class="sr-only"><\/p>/, "the live region is in the page before anything arrives");
  });

  it("the composer sends on ⌘/Ctrl+Enter, grows to six rows and shows no counter until 7,000 characters", () => {
    const out = html(createElement(ThreadRealtime, { threadId: thread().id, initialMessages: msgs, supplierName: "Aboni" }));
    assert.match(text(out), /⌘ \/ Ctrl \+ Enter to send/);
    assert.match(out, /<textarea[^>]*rows="2"[^>]*class="[^"]*max-h-\[9\.5rem\][^"]*resize-none/);
    assert.doesNotMatch(out, /\/ 8,000|0\/8000/, "a counter on an empty draft");
    assert.equal(COUNTER_FROM, 7000);
    assert.equal(counterText(0), null);
    assert.equal(counterText(7000), null);
    assert.equal(counterText(7001), "7,001 / 8,000");
  });
});

describe("Messages pages stay inside the dashboard kit", () => {
  const ROOT = process.cwd();
  const files = [
    "components/dashboard/inbox.tsx",
    "app/(app)/app/messages/page.tsx",
    "app/(app)/app/messages/[thread]/page.tsx",
    "app/(app)/app/messages/[thread]/thread-realtime.tsx",
  ];
  for (const f of files) {
    it(`${f} imports no components/ui, no Phosphor, no hex colour, and formats no date by hand`, () => {
      const src = readFileSync(path.join(ROOT, f), "utf8");
      assert.doesNotMatch(src, /from "@\/components\/ui\//);
      assert.doesNotMatch(src, /@phosphor-icons/);
      assert.doesNotMatch(src, /#[0-9a-fA-F]{6}\b/);
      assert.doesNotMatch(src, /toLocale(?:Date|Time)?String\(/);
    });
  }
});
